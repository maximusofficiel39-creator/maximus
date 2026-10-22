<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\SellerWalletController;
use App\Services\DiamanoPayService;
use App\Services\MaximusWalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Throwable;

final class MaximusWalletController extends Controller
{
    public function __construct(
        private readonly DiamanoPayService $diamanoPay,
        private readonly MaximusWalletService $wallet,
        private readonly SellerWalletController $sellerWallet,
    ) {}

    public function bootstrap(Request $request): JsonResponse
    {
        if (! $this->isMaximusAdmin($request)) {
            return $this->forbidden();
        }

        $this->sellerWallet->reconcilePaidSales();

        return response()->json($this->wallet->bootstrap());
    }

    public function updatePayoutAccount(Request $request): JsonResponse
    {
        if (! $this->isMaximusAdmin($request)) {
            return $this->forbidden();
        }

        $input = Validator::make($request->all(), [
            'provider' => ['required', 'in:WAVE'],
            'mobile' => ['required', 'string', 'min:8', 'max:40'],
            'beneficiaryName' => ['required', 'string', 'min:2', 'max:120'],
        ])->validate();

        return response()->json($this->wallet->updatePayoutAccount($input['mobile'], $input['beneficiaryName']));
    }

    public function requestWithdrawal(Request $request): JsonResponse
    {
        if (! $this->isMaximusAdmin($request)) {
            return $this->forbidden();
        }
        if (! $this->diamanoPay->isConfigured()) {
            return response()->json(['error' => 'Le retrait MAXIMUS n’est pas encore activé par la configuration DiamanoPay.'], 503);
        }

        $input = Validator::make($request->all(), [
            'amount' => ['required', 'integer', 'min:1000'],
            'provider' => ['nullable', 'in:WAVE'],
            'mobile' => ['required', 'string', 'min:8', 'max:40'],
            'beneficiaryName' => ['required', 'string', 'min:2', 'max:120'],
            'idempotencyKey' => ['nullable', 'string', 'max:120'],
        ])->validate();
        $idempotencyKey = trim((string) ($request->header('Idempotency-Key') ?: ($input['idempotencyKey'] ?? '')));

        try {
            $withdrawal = $this->wallet->requestWithdrawal($input, $idempotencyKey);
        } catch (Throwable $error) {
            $status = match ($error->getMessage()) {
                'MAXIMUS_SOLDE_INSUFFISANT' => 422,
                'IDEMPOTENCY_CONFLICT' => 409,
                default => 400,
            };

            return response()->json([
                'error' => match ($error->getMessage()) {
                    'MAXIMUS_SOLDE_INSUFFISANT' => 'Le solde disponible de MAXIMUS ne couvre pas ce retrait.',
                    'IDEMPOTENCY_CONFLICT' => 'Cette clé de demande a déjà été utilisée pour un autre retrait.',
                    default => 'La demande de retrait MAXIMUS n’a pas pu être créée.',
                },
            ], $status);
        }

        return response()->json(['withdrawal' => $this->withdrawal($withdrawal)], 201);
    }

    private function isMaximusAdmin(Request $request): bool
    {
        return ($request->attributes->get('authActor')['role'] ?? null) === 'maximus_admin';
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['error' => 'Cette action est réservée à l’administration MAXIMUS.'], 403);
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
}
