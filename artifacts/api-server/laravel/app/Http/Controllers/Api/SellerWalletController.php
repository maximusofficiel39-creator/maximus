<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DiamanoPayService;
use App\Services\EcommerceCommissionPolicy;
use App\Services\MaximusWalletService;
use App\Services\PayrollService;
use App\Services\SellerWalletFeePolicy;
use App\Services\SellerWalletMaturityPolicy;
use App\Support\ModuleAuthorization;
use App\Support\CompanyPaymentAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Throwable;

final class SellerWalletController extends Controller
{
    private const PAYMENT_SUCCESS_STATUSES = ['SUCCESS', 'SUCCEEDED', 'SUCCESSFUL', 'COMPLETED', 'PAID', 'SETTLED'];

    private const PAYMENT_FAILURE_STATUSES = ['FAILED', 'CANCELLED', 'CANCELED', 'DECLINED', 'REJECTED', 'EXPIRED', 'ERROR', 'DENIED'];

    public function __construct(
        private readonly DiamanoPayService $diamanoPay,
        private readonly EcommerceCommissionPolicy $commissionPolicy,
        private readonly MaximusWalletService $maximusWallet,
        private readonly PayrollService $payroll,
        private readonly SellerWalletFeePolicy $feePolicy,
        private readonly SellerWalletMaturityPolicy $maturityPolicy,
    ) {}

    public function bootstrap(Request $request): JsonResponse
    {
        if (! $this->canView($request)) {
            return response()->json(['error' => 'Cette action n’est pas autorisée pour votre rôle.'], 403);
        }

        $company = $this->company($request);
        $this->releaseMaturedFunds($company);
        $wallet = $this->wallet($company);

        return response()->json([
            'wallet' => $this->walletPayload($wallet),
            'withdrawals' => $this->withdrawals($company),
            'ledger' => $this->ledger($company),
            'maturityPolicy' => $this->maturityPolicy->payload(),
            'withdrawalFee' => $this->feePolicy->payload(),
        ]);
    }

    public function updatePayoutAccount(Request $request): JsonResponse
    {
        if (! $this->canModify($request)) {
            return response()->json(['error' => 'Cette action n’est pas autorisée pour votre rôle.'], 403);
        }

        $input = Validator::make($request->all(), [
            'provider' => ['required', 'in:WAVE'],
            'mobile' => ['required', 'string', 'min:8', 'max:40'],
            'beneficiaryName' => ['required', 'string', 'min:2', 'max:120'],
        ])->validate();

        $company = $this->company($request);
        $wallet = $this->wallet($company);
        DB::table('seller_wallets')->where('id', $wallet->id)->update([
            'payout_provider' => $input['provider'],
            'payout_mobile' => trim($input['mobile']),
            'payout_name' => trim($input['beneficiaryName']),
            'updated_at' => now(),
        ]);

        return response()->json($this->walletPayload($this->wallet($company)));
    }

    public function reconcilePayments(Request $request): JsonResponse
    {
        if (! $this->canModify($request)) {
            return response()->json(['error' => 'Cette action n’est pas autorisée pour votre rôle.'], 403);
        }
        if (! $this->diamanoPay->isConfigured()) {
            return response()->json(['error' => 'La vérification DiamanoPay n’est pas encore configurée.'], 503);
        }

        return response()->json([
            'sync' => $this->reconcilePendingPayments($this->company($request)),
            'wallet' => $this->walletPayload($this->wallet($this->company($request))),
        ]);
    }

    public function reconcilePaidSales(): int
    {
        $orders = DB::table('ecommerce_orders')
            ->where('payment_status', 'PAID')
            ->orderBy('created_at')
            ->get();
        $repaired = 0;

        foreach ($orders as $order) {
            $wasRepaired = DB::transaction(function () use ($order): bool {
                $locked = DB::table('ecommerce_orders')
                    ->where('id', $order->id)
                    ->lockForUpdate()
                    ->first();
                if (! $locked || $locked->payment_status !== 'PAID') {
                    return false;
                }

                $digitalStatusChanged = $this->deliverPaidDigitalOrder($locked);
                $commission = $this->commissionPolicy->calculate((int) $locked->total);
                $sellerLedgerExists = DB::table('seller_wallet_ledger')
                    ->where('company_id', $locked->company_id)
                    ->where('idempotency_key', 'sale:'.$locked->id)
                    ->exists();
                $maximusLedgerExists = (int) $commission['maximusCommission'] <= 0
                    || DB::table('maximus_wallet_ledger')
                        ->where('idempotency_key', 'sale-commission:'.$locked->id)
                        ->exists();
                if ($sellerLedgerExists && $maximusLedgerExists) {
                    return $digitalStatusChanged;
                }

                $availableAt = $locked->funds_available_at
                    ?? $this->maturityPolicy->availableAt(
                        (string) $locked->status,
                        $locked->paid_at ?? $locked->created_at,
                    );
                $this->creditPaidOrder($locked, ['reconciled' => true], $availableAt);

                return true;
            });

            if ($wasRepaired) {
                $repaired++;
            }
        }

        return $repaired;
    }

    public function refreshOrderPaymentStatus(object $order): void
    {
        if ($order->payment_status === 'PAID') {
            DB::transaction(function () use ($order): void {
                $locked = DB::table('ecommerce_orders')
                    ->where('id', $order->id)
                    ->lockForUpdate()
                    ->first();
                if ($locked) {
                    $this->deliverPaidDigitalOrder($locked);
                }
            });

            return;
        }
        if ($order->payment_status !== 'PENDING' || trim((string) ($order->payment_charge_id ?? '')) === '') {
            return;
        }
        if (! $this->diamanoPay->isConfigured()) {
            return;
        }

        try {
            $providerResponse = $this->diamanoPay->chargeStatus((string) $order->payment_charge_id);
            $this->applyPaymentProviderStatus($order->id, $providerResponse);
        } catch (Throwable $error) {
            report($error);
        }
    }

    public function requestWithdrawal(Request $request): JsonResponse
    {
        if (! $this->canModify($request)) {
            return response()->json(['error' => 'Cette action n’est pas autorisée pour votre rôle.'], 403);
        }
        if (! CompanyPaymentAccess::isEnabled($this->company($request))) {
            return response()->json([
                'error' => 'Les systèmes de paiement de cette entreprise sont désactivés.',
                'code' => 'COMPANY_PAYMENT_DISABLED',
            ], 403);
        }
        if (! $this->diamanoPay->isConfigured()) {
            return response()->json(['error' => 'Le retrait n’est pas encore activé par la configuration DiamanoPay.'], 503);
        }

        $input = Validator::make($request->all(), [
            'amount' => ['required', 'integer', 'min:1000'],
            'provider' => ['nullable', 'in:WAVE'],
            'mobile' => ['nullable', 'string', 'min:8', 'max:40'],
            'beneficiaryName' => ['nullable', 'string', 'min:2', 'max:120'],
            'idempotencyKey' => ['nullable', 'string', 'max:120'],
        ])->validate();

        $company = $this->company($request);
        $this->releaseMaturedFunds($company);
        $requestedAmount = (int) $input['amount'];
        $withdrawalFee = $this->feePolicy->fixedAmount();
        $idempotencyKey = trim((string) ($request->header('Idempotency-Key') ?: ($input['idempotencyKey'] ?? '')));
        $created = null;
        $createdFresh = false;

        try {
            $created = DB::transaction(function () use ($company, $input, $requestedAmount, $withdrawalFee, $idempotencyKey, &$createdFresh): object {
                $wallet = DB::table('seller_wallets')->where('company_id', $company)->lockForUpdate()->first();
                $existing = $idempotencyKey === ''
                    ? null
                    : DB::table('seller_withdrawals')->where('company_id', $company)->where('idempotency_key', $idempotencyKey)->first();
                if ($existing) {
                    if ((int) $existing->amount !== $requestedAmount || (int) $existing->fee !== $withdrawalFee) {
                        throw new \RuntimeException('IDEMPOTENCY_CONFLICT');
                    }

                    return $existing;
                }
                $totalDebit = $requestedAmount + $withdrawalFee;
                if (! $wallet || (int) $wallet->available_balance < $totalDebit) {
                    throw new \RuntimeException('SOLDE_INSUFFISANT');
                }

                $provider = $input['provider'] ?? $wallet->payout_provider;
                $mobile = trim((string) ($input['mobile'] ?? $wallet->payout_mobile));
                $name = trim((string) ($input['beneficiaryName'] ?? $wallet->payout_name));
                if ($mobile === '' || $name === '') {
                    throw new \RuntimeException('COMPTE_RETRAIT_INCOMPLET');
                }

                $id = 'withdrawal-'.Str::uuid();
                DB::table('seller_withdrawals')->insert([
                    'id' => $id,
                    'wallet_id' => $wallet->id,
                    'company_id' => $company,
                    'amount' => $requestedAmount,
                    'fee' => $withdrawalFee,
                    'net_amount' => $requestedAmount,
                    'provider' => $provider,
                    'mobile' => $mobile,
                    'beneficiary_name' => $name,
                    'status' => 'PROCESSING',
                    'provider_payout_id' => null,
                    'idempotency_key' => $idempotencyKey !== '' ? $idempotencyKey : null,
                    'failure_reason' => '',
                    'requested_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $createdFresh = true;
                DB::table('seller_wallets')->where('id', $wallet->id)->update([
                    'available_balance' => DB::raw('available_balance - '.$totalDebit),
                    'reserved_balance' => DB::raw('reserved_balance + '.$totalDebit),
                    'updated_at' => now(),
                ]);
                $this->ledgerInsert($wallet, 'WITHDRAWAL_RESERVED', 'AVAILABLE', 'DEBIT', $totalDebit, $id, 'withdrawal:'.$id.':available');
                $this->ledgerInsert($wallet, 'WITHDRAWAL_RESERVED', 'RESERVED', 'CREDIT', $totalDebit, $id, 'withdrawal:'.$id.':reserved');

                return DB::table('seller_withdrawals')->where('id', $id)->first();
            });
        } catch (Throwable $error) {
            $insufficient = $error->getMessage() === 'SOLDE_INSUFFISANT';
            $fee = $this->feePolicy->fixedAmount();
            $available = (int) (DB::table('seller_wallets')->where('company_id', $company)->value('available_balance') ?? 0);

            return response()->json([
                'error' => match ($error->getMessage()) {
                    'SOLDE_INSUFFISANT' => 'Le solde disponible ne couvre pas le montant demandé et les frais de retrait.',
                    'IDEMPOTENCY_CONFLICT' => 'Cette clé de demande a déjà été utilisée pour un autre retrait.',
                    'COMPTE_RETRAIT_INCOMPLET' => 'Configurez le nom et le numéro mobile de retrait avant de demander un retrait.',
                    default => 'La demande de retrait n’a pas pu être créée.',
                },
                'fee' => $insufficient ? $fee : null,
                'requestedAmount' => $insufficient ? $requestedAmount : null,
                'totalDebit' => $insufficient ? $requestedAmount + $fee : null,
                'maximumAmount' => $insufficient ? max(0, $available - $fee) : null,
            ], in_array($error->getMessage(), ['SOLDE_INSUFFISANT', 'COMPTE_RETRAIT_INCOMPLET'], true) ? 422 : ($error->getMessage() === 'IDEMPOTENCY_CONFLICT' ? 409 : 400));
        }

        if ($created === null || ! $createdFresh) {
            return response()->json(['withdrawal' => $this->withdrawal($created)], 200);
        }

        try {
            $providerResponse = $this->diamanoPay->payout([
                'amount' => (int) $created->amount,
                'provider' => $created->provider,
                'mobile' => $created->mobile,
                'name' => $created->beneficiary_name,
            ], 'withdrawal:'.$created->id);
            $this->applyWithdrawalProviderStatus($created->id, $providerResponse);
        } catch (Throwable $error) {
            DB::transaction(function () use ($created): void {
                $withdrawal = DB::table('seller_withdrawals')->where('id', $created->id)->lockForUpdate()->first();
                if (! $withdrawal || $withdrawal->status !== 'PROCESSING') {
                    return;
                }
                $wallet = DB::table('seller_wallets')->where('id', $withdrawal->wallet_id)->lockForUpdate()->first();
                if ($wallet) {
                    $this->releaseReservedWithdrawal($wallet, $withdrawal, 'Le retrait DiamanoPay a échoué.');
                }
                DB::table('seller_withdrawals')->where('id', $withdrawal->id)->update([
                    'status' => 'FAILED',
                    'failure_reason' => 'Le retrait DiamanoPay a échoué.',
                    'processed_at' => now(),
                    'updated_at' => now(),
                ]);
            });
        }

        return response()->json(['withdrawal' => $this->withdrawal(DB::table('seller_withdrawals')->where('id', $created->id)->first())], 201);
    }

    public function webhook(Request $request): JsonResponse
    {
        $body = $request->getContent();
        if (! $this->diamanoPay->verifyWebhook($body, $request->header('X-Diamanopay-Signature'))) {
            return response()->json(['error' => 'Signature webhook invalide.'], 401);
        }

        $payload = json_decode($body, true);
        if (! is_array($payload)) {
            return response()->json(['error' => 'Payload webhook invalide.'], 422);
        }
        $data = $this->providerData($payload);
        $providerId = $this->providerId($data);
        if ($providerId === '') {
            return response()->json(['received' => true]);
        }

        $withdrawal = DB::table('seller_withdrawals')->where('provider_payout_id', $providerId)->first();
        if ($withdrawal) {
            try {
                $this->applyWithdrawalProviderStatus($withdrawal->id, $data);
            } catch (Throwable $error) {
                report($error);

                return response()->json(['error' => 'Le webhook de retrait n’a pas pu être traité.'], 500);
            }

            return response()->json(['received' => true]);
        }

        $maximusWithdrawal = $this->maximusWallet->withdrawalByProviderId($providerId);
        if ($maximusWithdrawal) {
            try {
                $this->maximusWallet->applyProviderStatus($maximusWithdrawal->id, $data);
            } catch (Throwable $error) {
                report($error);

                return response()->json(['error' => 'Le webhook de retrait MAXIMUS n’a pas pu être traité.'], 500);
            }

            return response()->json(['received' => true]);
        }

        if ($this->payroll->applyTopupStatus($providerId, $data)) {
            return response()->json(['received' => true]);
        }

        $payrollItem = $this->payroll->itemByProviderId($providerId);
        if ($payrollItem) {
            try {
                $this->payroll->applyPayoutStatus($payrollItem->id, $data);
            } catch (Throwable $error) {
                report($error);

                return response()->json(['error' => 'Le webhook de virement Paie n’a pas pu être traité.'], 500);
            }

            return response()->json(['received' => true]);
        }

        $order = DB::table('ecommerce_orders')->where('payment_charge_id', $providerId)->first();
        if (! $order) {
            return response()->json(['received' => true]);
        }

        try {
            $this->applyPaymentProviderStatus($order->id, $data);
        } catch (Throwable $error) {
            report($error);

            return response()->json(['error' => 'Le webhook n’a pas pu être traité.'], 500);
        }

        return response()->json(['received' => true]);
    }

    private function applyWithdrawalProviderStatus(string $withdrawalId, array $providerResponse): void
    {
        $providerResponse = $this->providerData($providerResponse);
        $providerStatus = $this->providerStatus($providerResponse, 'PENDING');
        $providerId = $this->providerId($providerResponse);
        $success = in_array($providerStatus, ['SUCCESS', 'SUCCEEDED', 'SUCCESSFUL', 'COMPLETED', 'SETTLED', 'PAID'], true);
        $failure = in_array($providerStatus, ['FAILED', 'CANCELLED', 'CANCELED', 'DECLINED', 'REJECTED', 'EXPIRED', 'ERROR', 'DENIED'], true);

        DB::transaction(function () use ($withdrawalId, $providerId, $success, $failure, $providerStatus): void {
            $withdrawal = DB::table('seller_withdrawals')->where('id', $withdrawalId)->lockForUpdate()->first();
            if (! $withdrawal || $withdrawal->status !== 'PROCESSING') {
                return;
            }
            $wallet = DB::table('seller_wallets')->where('id', $withdrawal->wallet_id)->lockForUpdate()->first();
            if (! $wallet) {
                throw new \RuntimeException('WALLET_NOT_FOUND');
            }

            if ($success) {
                DB::table('seller_wallets')->where('id', $wallet->id)->update([
                    'reserved_balance' => DB::raw('reserved_balance - '.$this->withdrawalTotal($withdrawal)),
                    'updated_at' => now(),
                ]);
                $this->ledgerInsert($wallet, 'WITHDRAWAL_PAID', 'RESERVED', 'DEBIT', (int) $withdrawal->amount, $withdrawal->id, 'withdrawal:'.$withdrawal->id.':paid');
                if ((int) $withdrawal->fee > 0) {
                    $this->ledgerInsert($wallet, 'WITHDRAWAL_FEE', 'RESERVED', 'DEBIT', (int) $withdrawal->fee, $withdrawal->id, 'withdrawal:'.$withdrawal->id.':fee');
                }
                DB::table('seller_withdrawals')->where('id', $withdrawal->id)->update([
                    'status' => 'SUCCEEDED',
                    'provider_payout_id' => $providerId !== '' ? $providerId : $withdrawal->provider_payout_id,
                    'processed_at' => now(),
                    'updated_at' => now(),
                ]);

                return;
            }

            if ($failure) {
                $this->releaseReservedWithdrawal($wallet, $withdrawal, 'Le retrait DiamanoPay a échoué.');
                DB::table('seller_withdrawals')->where('id', $withdrawal->id)->update([
                    'status' => 'FAILED',
                    'provider_payout_id' => $providerId !== '' ? $providerId : $withdrawal->provider_payout_id,
                    'failure_reason' => 'Le retrait DiamanoPay a échoué ('.$providerStatus.').',
                    'processed_at' => now(),
                    'updated_at' => now(),
                ]);

                return;
            }

            DB::table('seller_withdrawals')->where('id', $withdrawal->id)->update([
                'status' => 'PROCESSING',
                'provider_payout_id' => $providerId !== '' ? $providerId : $withdrawal->provider_payout_id,
                'updated_at' => now(),
            ]);
        });
    }

    private function applyPaymentProviderStatus(string $orderId, array $providerResponse): void
    {
        $data = $this->providerData($providerResponse);
        $status = $this->providerStatus($data);
        if (! in_array($status, [...self::PAYMENT_SUCCESS_STATUSES, ...self::PAYMENT_FAILURE_STATUSES], true)) {
            return;
        }

        DB::transaction(function () use ($orderId, $status, $data): void {
            $locked = DB::table('ecommerce_orders')->where('id', $orderId)->lockForUpdate()->first();
            if (! $locked) {
                return;
            }

            if (in_array($status, self::PAYMENT_SUCCESS_STATUSES, true) && ! in_array($locked->payment_status, ['PAID', 'REFUNDED'], true)) {
                $locationReservation = DB::table('ecommerce_car_reservations')
                    ->where('order_id', $locked->id)->lockForUpdate()->first();
                if ($locationReservation) {
                    $expired = $locationReservation->status !== 'PENDING_PAYMENT'
                        || ($locationReservation->hold_expires_at
                            && now()->greaterThan($locationReservation->hold_expires_at));
                    $conflict = DB::table('ecommerce_car_reservations')
                        ->where('rental_id', $locationReservation->rental_id)
                        ->where('id', '!=', $locationReservation->id)
                        ->whereIn('status', ['CONFIRMED', 'IN_PROGRESS'])
                        ->where('starts_at', '<', $locationReservation->ends_at)
                        ->where('ends_at', '>', $locationReservation->starts_at)
                        ->exists();
                    if ($expired || $conflict) {
                        DB::table('ecommerce_car_reservations')->where('id', $locationReservation->id)
                            ->update(['status' => $conflict ? 'UNAVAILABLE' : 'PAYMENT_FAILED', 'updated_at' => now()]);
                        DB::table('ecommerce_orders')->where('id', $locked->id)->update([
                            'payment_status' => 'FAILED',
                            'payment_failure_reason' => 'La réservation n’est plus disponible.',
                            'updated_at' => now(),
                        ]);
                        return;
                    }
                }
                $paidAt = $locked->paid_at ?? now();
                $paidOrder = clone $locked;
                if ($this->isDigitalOrder($locked) && $locked->status !== 'ANNULÉE') {
                    $paidOrder->status = 'LIVRÉE';
                }
                $availableAt = $this->maturityPolicy->availableAt($paidOrder->status, $paidAt);
                $this->creditPaidOrder($paidOrder, $data, $availableAt);
                DB::table('ecommerce_orders')->where('id', $locked->id)->update([
                    'status' => $paidOrder->status,
                    'payment_status' => 'PAID',
                    'paid_at' => $paidAt,
                    'funds_available_at' => $locked->funds_available_at ?? $availableAt,
                    'payment_failure_reason' => '',
                    'updated_at' => now(),
                ]);
                // Location reservations share the regular ecommerce payment lifecycle.
                // Keep this idempotent so repeated webhook deliveries cannot duplicate
                // confirmation or invoice generation.
                $reservation = $locationReservation;
                if ($reservation) {
                    $detail = json_decode((string) $reservation->total_detail, true) ?: [];
                    $car = DB::table('ecommerce_rentals')->where('id', $reservation->rental_id)->first();
                    $store = DB::table('ecommerce_stores')->where('company_id', $reservation->company_id)->first();
                    $esc = static fn (mixed $value): string => htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
                    $html = '<!doctype html><html><head><meta charset="utf-8"><title>Facture '.$esc($reservation->id).
                        '</title><style>body{font:14px sans-serif;max-width:800px;margin:2rem auto}table{width:100%;border-collapse:collapse}td,th{padding:.5rem;border-bottom:1px solid #ddd;text-align:left}</style></head><body>'.
                        '<h1>Facture de réservation</h1><p><strong>'. $esc($store->name ?? 'Boutique') .'</strong></p>'.
                        '<p>Référence : '.$esc($reservation->id).' · Statut : PAYÉE</p><h2>Client</h2><p>'.$esc($locked->customer_name).' · '.$esc($locked->customer_email).' · '.$esc($locked->customer_phone).'</p>'.
                        '<h2>Véhicule</h2><p>'.$esc($car->name ?? '').' '.$esc($car->brand ?? '').' '.$esc($car->model ?? '').'</p>'.
                        '<h2>Période et trajet</h2><p>Du '.$esc($reservation->starts_at).' au '.$esc($reservation->ends_at).'<br>'.
                        $esc($reservation->departure).' → '.$esc($reservation->destination).' · '.$esc($reservation->distance_km).' km</p>'.
                        '<table><tr><th>Détail</th><th>Montant (XOF)</th></tr><tr><td>Jours</td><td>'.$esc($detail['daily'] ?? 0).
                        '</td></tr><tr><td>Distance</td><td>'.$esc($detail['distance'] ?? 0).'</td></tr><tr><td>Frais</td><td>'.$esc($detail['fees'] ?? 0).
                        '</td></tr><tr><td>Caution</td><td>'.$esc($detail['deposit'] ?? 0).'</td></tr><tr><th>Total payé</th><th>'.$esc($detail['total'] ?? $locked->total).
                        '</th></tr></table></body></html>';
                    DB::table('ecommerce_car_reservations')->where('id', $reservation->id)->update([
                        'status' => 'CONFIRMED',
                        'invoice_html' => $reservation->invoice_html ?: $html,
                        'updated_at' => now(),
                    ]);
                }

                return;
            }

            if (in_array($status, self::PAYMENT_FAILURE_STATUSES, true) && ! in_array($locked->payment_status, ['PAID', 'REFUNDED'], true)) {
                $reason = $this->providerFailureReason($data);
                DB::table('ecommerce_orders')->where('id', $locked->id)->update([
                    'payment_status' => 'FAILED',
                    'payment_failure_reason' => $reason,
                    'updated_at' => now(),
                ]);
                DB::table('ecommerce_car_reservations')->where('order_id', $locked->id)
                    ->whereNotIn('status', ['COMPLETED', 'CANCELLED'])
                    ->update(['status' => 'PAYMENT_FAILED', 'updated_at' => now()]);
                $this->restoreOrderStock($locked);
            }
        });
    }

    private function reconcilePendingPayments(string $company): array
    {
        $orders = DB::table('ecommerce_orders')
            ->where('company_id', $company)
            ->where('payment_status', 'PENDING')
            ->whereNotNull('payment_charge_id')
            ->where('payment_charge_id', '<>', '')
            ->orderBy('updated_at')
            ->limit(25)
            ->get();
        $checked = 0;
        $updated = 0;
        $failed = 0;

        foreach ($orders as $order) {
            $checked++;
            try {
                $before = (string) $order->payment_status;
                $providerResponse = $this->diamanoPay->chargeStatus((string) $order->payment_charge_id);
                $this->applyPaymentProviderStatus($order->id, $providerResponse);
                $after = (string) (DB::table('ecommerce_orders')->where('id', $order->id)->value('payment_status') ?? $before);
                if ($after !== $before) {
                    $updated++;
                }
            } catch (Throwable $error) {
                $failed++;
                report($error);
            }
        }

        return [
            'checked' => $checked,
            'updated' => $updated,
            'failed' => $failed,
        ];
    }

    private function providerData(array $payload): array
    {
        $nested = is_array($payload['data'] ?? null) ? $payload['data'] : [];

        return array_merge($payload, $nested);
    }

    private function providerId(array $payload): string
    {
        return trim((string) (
            $payload['id']
            ?? $payload['charge_id']
            ?? $payload['chargeId']
            ?? $payload['payout_id']
            ?? $payload['payoutId']
            ?? $payload['transaction_id']
            ?? $payload['transactionId']
            ?? ''
        ));
    }

    private function providerStatus(array $payload, string $fallback = ''): string
    {
        return strtoupper(trim((string) (
            $payload['status']
            ?? $payload['payment_status']
            ?? $payload['paymentStatus']
            ?? $payload['state']
            ?? $fallback
        )));
    }

    private function providerFailureReason(array $payload): string
    {
        $reason = trim((string) (
            $payload['failure_reason']
            ?? $payload['failureReason']
            ?? $payload['reason']
            ?? $payload['message']
            ?? ''
        ));

        $normalized = Str::lower($reason);
        if ($normalized !== '' && str_contains($normalized, 'solde insuffisant')) {
            return $reason;
        }
        if ($normalized !== '' && (
            str_contains($normalized, 'insuff')
            || str_contains($normalized, 'insufficient')
            || str_contains($normalized, 'funds')
            || str_contains($normalized, 'solde')
        )) {
            return 'Solde Wave insuffisant.';
        }
        if ($normalized !== '' && (str_contains($normalized, 'cancel') || str_contains($normalized, 'annul'))) {
            return 'Paiement Wave annulé.';
        }
        if ($normalized !== '') {
            return $reason;
        }

        return 'Le paiement DiamanoPay a échoué.';
    }

    public function releaseOrderFunds(object $order): void
    {
        if ($order->payment_status !== 'PAID') {
            return;
        }
        $credit = DB::table('seller_wallet_ledger')
            ->where('company_id', $order->company_id)
            ->where('reference_type', 'ORDER')
            ->where('reference_id', $order->id)
            ->where('type', 'SALE_CREDIT')
            ->whereNull('released_at')
            ->whereNull('reversed_at')
            ->lockForUpdate()
            ->first();
        if (! $credit) {
            return;
        }

        $wallet = DB::table('seller_wallets')->where('id', $credit->wallet_id)->lockForUpdate()->first();
        if (! $wallet || (int) $wallet->pending_balance < (int) $credit->amount) {
            return;
        }
        DB::table('seller_wallets')->where('id', $wallet->id)->update([
            'pending_balance' => DB::raw('pending_balance - '.(int) $credit->amount),
            'available_balance' => DB::raw('available_balance + '.(int) $credit->amount),
            'updated_at' => now(),
        ]);
        DB::table('seller_wallet_ledger')->where('id', $credit->id)->update(['released_at' => now(), 'updated_at' => now()]);
        $this->ledgerInsert($wallet, 'SALE_RELEASE', 'AVAILABLE', 'CREDIT', (int) $credit->amount, $order->id, 'sale-release:'.$order->id);
    }

    public function reverseOrderFunds(object $order): void
    {
        if (! in_array($order->payment_status, ['PAID', 'REFUNDED'], true)) {
            return;
        }
        $credit = DB::table('seller_wallet_ledger')
            ->where('company_id', $order->company_id)
            ->where('reference_type', 'ORDER')
            ->where('reference_id', $order->id)
            ->where('type', 'SALE_CREDIT')
            ->whereNull('reversed_at')
            ->lockForUpdate()
            ->first();
        if (! $credit) {
            return;
        }
        $wallet = DB::table('seller_wallets')->where('id', $credit->wallet_id)->lockForUpdate()->first();
        if (! $wallet) {
            return;
        }
        $bucket = $credit->released_at ? 'AVAILABLE' : 'PENDING';
        $column = $bucket === 'AVAILABLE' ? 'available_balance' : 'pending_balance';
        DB::table('seller_wallets')->where('id', $wallet->id)->update([
            $column => DB::raw($column.' - '.(int) $credit->amount),
            'updated_at' => now(),
        ]);
        DB::table('seller_wallet_ledger')->where('id', $credit->id)->update(['reversed_at' => now(), 'updated_at' => now()]);
        $this->ledgerInsert($wallet, 'SALE_REVERSAL', $bucket, 'DEBIT', (int) $credit->amount, $order->id, 'sale-reversal:'.$order->id);
        $this->maximusWallet->reverseCommission((string) $order->company_id, (string) $order->id);
    }

    public function restoreOrderStock(object $order): void
    {
        if ($order->stock_restored_at !== null) {
            return;
        }
        $items = DB::table('ecommerce_order_items')->where('order_id', $order->id)->get();
        foreach ($items as $item) {
            if ($item->product_id && ($item->fulfillment_type ?? 'PHYSICAL') === 'PHYSICAL') {
                DB::table('ecommerce_products')->where('id', $item->product_id)->increment('stock', (int) $item->quantity, ['updated_at' => now()]);
            }
        }
        DB::table('ecommerce_orders')->where('id', $order->id)->update(['stock_restored_at' => now(), 'updated_at' => now()]);
    }

    private function isDigitalOrder(object $order): bool
    {
        $items = DB::table('ecommerce_order_items')
            ->where('order_id', $order->id)
            ->pluck('fulfillment_type');

        return $items->isNotEmpty()
            && $items->every(fn (mixed $fulfillmentType): bool => ($fulfillmentType ?? 'PHYSICAL') === 'DIGITAL');
    }

    private function deliverPaidDigitalOrder(object $order): bool
    {
        if ($order->payment_status !== 'PAID'
            || $order->status === 'ANNULÉE'
            || ! $this->isDigitalOrder($order)) {
            return false;
        }

        if ($order->status !== 'LIVRÉE') {
            DB::table('ecommerce_orders')->where('id', $order->id)->update([
                'status' => 'LIVRÉE',
                'updated_at' => now(),
            ]);
            $order->status = 'LIVRÉE';
        }
        $this->releaseOrderFunds($order);

        return true;
    }

    private function creditPaidOrder(object $order, array $data, mixed $availableAt = null): void
    {
        $key = 'sale:'.$order->id;
        $commission = $this->commissionPolicy->calculate((int) $order->total);
        if (! DB::table('seller_wallet_ledger')->where('company_id', $order->company_id)->where('idempotency_key', $key)->exists()) {
            $wallet = $this->wallet($order->company_id);
            $available = $order->status === 'LIVRÉE';
            $sellerAmount = (int) $commission['sellerNet'];
            DB::table('seller_wallets')->where('id', $wallet->id)->update([
                $available ? 'available_balance' : 'pending_balance' => DB::raw(($available ? 'available_balance' : 'pending_balance').' + '.$sellerAmount),
                'total_credited' => DB::raw('total_credited + '.$sellerAmount),
                'updated_at' => now(),
            ]);
            $this->ledgerInsert($wallet, 'SALE_CREDIT', $available ? 'AVAILABLE' : 'PENDING', 'CREDIT', $sellerAmount, $order->id, $key, $availableAt, [
                ...$data,
                'grossAmount' => (int) $commission['grossAmount'],
                'providerFee' => (int) $commission['providerFee'],
                'maximusCommission' => (int) $commission['maximusCommission'],
                'sellerNet' => $sellerAmount,
            ]);
        }
        $this->maximusWallet->creditCommission((string) $order->company_id, (string) $order->id, $commission, $data);
    }

    private function releaseMaturedFunds(string $company): void
    {
        DB::transaction(function () use ($company): void {
            $wallet = DB::table('seller_wallets')->where('company_id', $company)->lockForUpdate()->first();
            if (! $wallet) {
                return;
            }
            $credits = DB::table('seller_wallet_ledger')
                ->where('company_id', $company)
                ->where('type', 'SALE_CREDIT')
                ->where('bucket', 'PENDING')
                ->whereNull('released_at')
                ->whereNull('reversed_at')
                ->whereNotNull('available_at')
                ->where('available_at', '<=', now())
                ->lockForUpdate()
                ->get();
            foreach ($credits as $credit) {
                $order = DB::table('ecommerce_orders')->where('id', $credit->reference_id)->first();
                if ($order) {
                    $this->releaseOrderFunds($order);
                }
            }
        });
    }

    private function releaseReservedWithdrawal(object $wallet, object $withdrawal, string $reason): void
    {
        DB::table('seller_wallets')->where('id', $wallet->id)->update([
            'reserved_balance' => DB::raw('reserved_balance - '.$this->withdrawalTotal($withdrawal)),
            'available_balance' => DB::raw('available_balance + '.$this->withdrawalTotal($withdrawal)),
            'updated_at' => now(),
        ]);
        $totalDebit = $this->withdrawalTotal($withdrawal);
        $this->ledgerInsert($wallet, 'WITHDRAWAL_RELEASED', 'RESERVED', 'DEBIT', $totalDebit, $withdrawal->id, 'withdrawal:'.$withdrawal->id.':release');
        $this->ledgerInsert($wallet, 'WITHDRAWAL_RELEASED', 'AVAILABLE', 'CREDIT', $totalDebit, $withdrawal->id, 'withdrawal:'.$withdrawal->id.':available');
    }

    private function ledgerInsert(object $wallet, string $type, string $bucket, string $direction, int $amount, string $referenceId, string $idempotencyKey, mixed $availableAt = null, ?array $metadata = null): void
    {
        if (DB::table('seller_wallet_ledger')->where('company_id', $wallet->company_id)->where('idempotency_key', $idempotencyKey)->exists()) {
            return;
        }
        DB::table('seller_wallet_ledger')->insert([
            'id' => 'ledger-'.Str::uuid(),
            'wallet_id' => $wallet->id,
            'company_id' => $wallet->company_id,
            'type' => $type,
            'bucket' => $bucket,
            'direction' => $direction,
            'amount' => $amount,
            'reference_type' => str_starts_with($type, 'SALE_') ? 'ORDER' : 'WITHDRAWAL',
            'reference_id' => $referenceId,
            'idempotency_key' => $idempotencyKey,
            'available_at' => $availableAt,
            'released_at' => null,
            'reversed_at' => null,
            'metadata' => $metadata ? json_encode($metadata, JSON_THROW_ON_ERROR) : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function wallet(string $company): object
    {
        $wallet = DB::table('seller_wallets')->where('company_id', $company)->first();
        if ($wallet) {
            return $wallet;
        }
        $id = 'wallet-'.$company;
        DB::table('seller_wallets')->insert([
            'id' => $id,
            'company_id' => $company,
            'currency' => 'XOF',
            'pending_balance' => 0,
            'available_balance' => 0,
            'reserved_balance' => 0,
            'total_credited' => 0,
            'payout_provider' => 'WAVE',
            'payout_mobile' => '',
            'payout_name' => '',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return DB::table('seller_wallets')->where('id', $id)->first();
    }

    private function walletPayload(object $wallet): array
    {
        return [
            'companyId' => $wallet->company_id,
            'currency' => $wallet->currency,
            'pendingBalance' => (int) $wallet->pending_balance,
            'availableBalance' => (int) $wallet->available_balance,
            'reservedBalance' => (int) $wallet->reserved_balance,
            'totalCredited' => (int) $wallet->total_credited,
            'payoutProvider' => $wallet->payout_provider,
            'payoutMobile' => $wallet->payout_mobile,
            'payoutName' => $wallet->payout_name,
        ];
    }

    private function withdrawals(string $company): array
    {
        return DB::table('seller_withdrawals')->where('company_id', $company)->orderByDesc('created_at')->limit(50)->get()->map(fn (object $row): array => $this->withdrawal($row))->all();
    }

    private function withdrawal(?object $row): ?array
    {
        if (! $row) {
            return null;
        }

        return [
            'id' => $row->id,
            'amount' => (int) $row->amount,
            'fee' => (int) $row->fee,
            'netAmount' => (int) $row->net_amount,
            'totalDebit' => (int) $row->amount + (int) $row->fee,
            'provider' => $row->provider,
            'mobile' => $row->mobile,
            'beneficiaryName' => $row->beneficiary_name,
            'status' => $row->status,
            'providerPayoutId' => $row->provider_payout_id,
            'failureReason' => $row->failure_reason,
            'requestedAt' => $row->requested_at,
            'processedAt' => $row->processed_at,
        ];
    }

    private function ledger(string $company): array
    {
        return DB::table('seller_wallet_ledger')->where('company_id', $company)->orderByDesc('created_at')->limit(100)->get()->map(fn (object $row): array => [
            'id' => $row->id,
            'type' => $row->type,
            'bucket' => $row->bucket,
            'direction' => $row->direction,
            'amount' => (int) $row->amount,
            'referenceType' => $row->reference_type,
            'referenceId' => $row->reference_id,
            'availableAt' => $row->available_at,
            'releasedAt' => $row->released_at,
            'reversedAt' => $row->reversed_at,
            'createdAt' => $row->created_at,
        ])->all();
    }

    private function canView(Request $request): bool
    {
        $actor = $request->attributes->get('authActor');

        return is_array($actor) && ModuleAuthorization::allows($actor, 'ecommerce', 'view', 'finances');
    }

    private function canModify(Request $request): bool
    {
        $actor = $request->attributes->get('authActor');

        return is_array($actor) && ModuleAuthorization::allows($actor, 'ecommerce', 'modify', 'finances');
    }

    private function company(Request $request): string
    {
        return (string) $request->attributes->get('companyId');
    }

    private function withdrawalTotal(object $withdrawal): int
    {
        return max(0, (int) $withdrawal->amount + (int) $withdrawal->fee);
    }
}
