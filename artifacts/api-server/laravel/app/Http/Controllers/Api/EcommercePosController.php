<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ModuleAuthorization;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use RuntimeException;

final class EcommercePosController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($denied = $this->authorizePos($request, 'view')) {
            return $denied;
        }

        $companyId = (string) $request->attributes->get('companyId');
        if ($companyId === '') {
            return response()->json(['error' => 'Entreprise requise.'], 400);
        }

        $currency = (string) (DB::table('ecommerce_stores')
            ->where('company_id', $companyId)
            ->value('currency') ?? 'XOF');
        $today = now()->startOfDay();
        $todaySales = DB::table('ecommerce_pos_sales')
            ->where('company_id', $companyId)
            ->where('status', 'PAID')
            ->where('created_at', '>=', $today);

        $summary = [
            'currency' => $currency,
            'todaySalesCount' => (clone $todaySales)->count(),
            'todayRevenue' => (int) (clone $todaySales)->sum('total'),
            'todayCashReceived' => (int) (clone $todaySales)->where('payment_method', 'CASH')->sum('amount_received'),
            'todayMobileMoneyReceived' => (int) (clone $todaySales)
                ->whereIn('payment_method', ['WAVE', 'ORANGE_MONEY'])
                ->sum('amount_received'),
            'todayChangeGiven' => (int) (clone $todaySales)->sum('change_due'),
        ];

        $sales = DB::table('ecommerce_pos_sales')
            ->where('company_id', $companyId)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();
        return response()->json([
            'sales' => $this->salesWithItems($companyId, $sales->all()),
            'summary' => $summary,
        ]);
    }

    public function createExpense(Request $request): JsonResponse
    {
        if ($denied = $this->authorizeExpenses($request, 'create')) {
            return $denied;
        }

        $companyId = (string) $request->attributes->get('companyId');
        if ($companyId === '') {
            return response()->json(['error' => 'Entreprise requise.'], 400);
        }

        $input = Validator::make($request->all(), [
            'type' => ['required', 'in:INVESTMENT,PERSONAL'],
            'amount' => ['required', 'integer', 'min:1', 'max:2147483647'],
            'description' => ['nullable', 'string', 'max:500'],
            'expenseDate' => ['required', 'date_format:Y-m-d'],
        ])->validate();
        $actor = $request->attributes->get('authActor', []);
        $row = [
            'id' => (string) Str::uuid(),
            'company_id' => $companyId,
            'created_by' => is_array($actor) && isset($actor['userId']) ? (string) $actor['userId'] : null,
            'type' => $input['type'],
            'description' => trim((string) ($input['description'] ?? '')),
            'amount' => (int) $input['amount'],
            'currency' => (string) (DB::table('ecommerce_stores')->where('company_id', $companyId)->value('currency') ?? 'XOF'),
            'expense_date' => $input['expenseDate'],
            'created_at' => now(),
            'updated_at' => now(),
        ];
        DB::table('ecommerce_pos_expenses')->insert($row);

        return response()->json(['expense' => $this->expense((object) $row)], 201);
    }

    public function expenses(Request $request): JsonResponse
    {
        if ($denied = $this->authorizeExpenses($request, 'view')) {
            return $denied;
        }

        $companyId = (string) $request->attributes->get('companyId');
        if ($companyId === '') {
            return response()->json(['error' => 'Entreprise requise.'], 400);
        }

        $currency = (string) (DB::table('ecommerce_stores')
            ->where('company_id', $companyId)
            ->value('currency') ?? 'XOF');
        $expenses = DB::table('ecommerce_pos_expenses')
            ->where('company_id', $companyId)
            ->orderByDesc('expense_date')
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();
        $expenseTotals = DB::table('ecommerce_pos_expenses')
            ->where('company_id', $companyId)
            ->where('currency', $currency)
            ->selectRaw('COALESCE(SUM(amount), 0) AS total')
            ->selectRaw('COALESCE(SUM(CASE WHEN expense_date = ? THEN amount ELSE 0 END), 0) AS today_total', [now()->toDateString()])
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'INVESTMENT' THEN amount ELSE 0 END), 0) AS investment_total")
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'PERSONAL' THEN amount ELSE 0 END), 0) AS personal_total")
            ->first();
        $grossTotal = (int) DB::table('ecommerce_pos_sales')
            ->where('company_id', $companyId)
            ->where('currency', $currency)
            ->where('status', 'PAID')
            ->sum('total')
            + (int) DB::table('ecommerce_orders')
                ->where('company_id', $companyId)
                ->where('currency', $currency)
                ->where('status', '!=', 'ANNULÉE')
                ->where('payment_status', 'PAID')
                ->sum('total');
        $todayCounterRevenue = (int) DB::table('ecommerce_pos_sales')
            ->where('company_id', $companyId)
            ->where('currency', $currency)
            ->where('status', 'PAID')
            ->whereDate('created_at', now()->toDateString())
            ->sum('total');

        return response()->json([
            'currency' => $currency,
            'expenses' => $expenses->map(fn (object $expense): array => $this->expense($expense))->values(),
            'expenseSummary' => [
                'total' => (int) $expenseTotals->total,
                'todayTotal' => (int) $expenseTotals->today_total,
                'investmentTotal' => (int) $expenseTotals->investment_total,
                'personalTotal' => (int) $expenseTotals->personal_total,
                'netToday' => $todayCounterRevenue - (int) $expenseTotals->today_total,
                'netTotal' => $grossTotal - (int) $expenseTotals->total,
            ],
        ]);
    }

    private function expense(object $row): array
    {
        return [
            'id' => (string) $row->id,
            'type' => (string) $row->type,
            'description' => (string) $row->description,
            'amount' => (int) $row->amount,
            'currency' => (string) $row->currency,
            'expenseDate' => (string) $row->expense_date,
            'createdAt' => (string) $row->created_at,
        ];
    }
    public function store(Request $request): JsonResponse
    {
        if ($denied = $this->authorizePos($request, 'create')) {
            return $denied;
        }

        $companyId = (string) $request->attributes->get('companyId');
        if ($companyId === '') {
            return response()->json(['error' => 'Entreprise requise.'], 400);
        }

        $idempotencyKey = trim((string) $request->header('Idempotency-Key', ''));
        if ($idempotencyKey === '' || strlen($idempotencyKey) > 128) {
            return response()->json(['error' => 'Une clé d’idempotence valide est requise.'], 422);
        }

        $paymentMethodHint = strtoupper(trim((string) $request->input('paymentMethod', 'CASH')));
        $paymentMethodForRules = in_array($paymentMethodHint, ['WAVE', 'ORANGE_MONEY'], true)
            ? $paymentMethodHint
            : 'CASH';

        $input = Validator::make($request->all(), [
            'lines' => ['required', 'array', 'min:1', 'max:100'],
            'lines.*.productId' => ['required', 'string', 'max:255'],
            'lines.*.quantity' => ['required', 'integer', 'min:1', 'max:9999'],
            'paymentMethod' => ['sometimes', 'string', 'in:CASH,WAVE,ORANGE_MONEY'],
            'amountReceived' => [$paymentMethodForRules === 'CASH' ? 'required' : 'nullable', 'integer', 'min:0'],
            'paymentReference' => ['nullable', 'string', 'max:180'],
            'paymentConfirmed' => [$paymentMethodForRules === 'CASH' ? 'nullable' : 'accepted'],
            'customerName' => ['nullable', 'string', 'max:180'],
        ])->validate();
        $paymentMethod = (string) ($input['paymentMethod'] ?? 'CASH');
        $paymentReference = $paymentMethod === 'CASH' || ! isset($input['paymentReference'])
            ? null
            : (trim((string) $input['paymentReference']) ?: null);

        $quantities = [];
        foreach ($input['lines'] as $line) {
            $productId = (string) $line['productId'];
            $quantities[$productId] = ($quantities[$productId] ?? 0) + (int) $line['quantity'];
            if ($quantities[$productId] > 9999) {
                return response()->json(['error' => 'La quantité demandée est trop élevée.'], 422);
            }
        }
        ksort($quantities);

        try {
            $sale = DB::transaction(function () use ($request, $companyId, $idempotencyKey, $input, $quantities, $paymentMethod, $paymentReference): array {
                $existing = DB::table('ecommerce_pos_sales')
                    ->where('company_id', $companyId)
                    ->where('idempotency_key', $idempotencyKey)
                    ->lockForUpdate()
                    ->first();
                if ($existing) {
                    if (! $this->matchesExistingSaleRequest(
                        $existing,
                        $companyId,
                        $input,
                        $quantities,
                        $paymentMethod,
                        $paymentReference,
                    )) {
                        throw new RuntimeException('IDEMPOTENCY_KEY_CONFLICT');
                    }

                    return $this->saleWithItems($companyId, $existing);
                }

                $actor = $request->attributes->get('authActor', []);
                if (! is_array($actor) || ! ModuleAuthorization::allows($actor, 'ecommerce', 'create', 'vente-physique')) {
                    throw new RuntimeException('PHYSICAL_SALES_NOT_AUTHORIZED');
                }

                $lines = [];
                $stockMovementSnapshots = [];
                $subtotal = 0;
                foreach ($quantities as $productId => $quantity) {
                    $product = DB::table('ecommerce_products')
                        ->where('company_id', $companyId)
                        ->where('id', $productId)
                        ->where('status', 'PUBLISHED')
                        ->where(function ($query): void {
                            $query->whereNull('product_type')->orWhere('product_type', 'SALE');
                        })
                        ->where(function ($query): void {
                            $query->whereNull('fulfillment_type')->orWhere('fulfillment_type', 'PHYSICAL');
                        })
                        ->lockForUpdate()
                        ->first();

                    if (! $product) {
                        throw new RuntimeException('PRODUCT_NOT_AVAILABLE');
                    }
                    if ((int) $product->stock < $quantity) {
                        throw new RuntimeException('INSUFFICIENT_STOCK');
                    }

                    $unitPrice = (int) $product->price;
                    $lineTotal = $unitPrice * $quantity;
                    $stockBefore = (int) $product->stock;
                    $stockAfter = $stockBefore - $quantity;
                    $subtotal += $lineTotal;
                    $saleItemId = (string) Str::uuid();
                    $lines[] = [
                        'id' => $saleItemId,
                        'company_id' => $companyId,
                        'product_id' => (string) $product->id,
                        'product_name' => (string) $product->name,
                        'sku' => (string) ($product->sku ?? ''),
                        'unit_price' => $unitPrice,
                        'quantity' => $quantity,
                        'line_total' => $lineTotal,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                    $stockMovementSnapshots[] = [
                        'id' => (string) Str::uuid(),
                        'sale_item_id' => $saleItemId,
                        'product_id' => (string) $product->id,
                        'product_name' => (string) $product->name,
                        'sku' => (string) ($product->sku ?? ''),
                        'movement_type' => 'VENTE',
                        'quantity' => $quantity,
                        'stock_before' => $stockBefore,
                        'stock_after' => $stockAfter,
                    ];
                    DB::table('ecommerce_products')
                        ->where('company_id', $companyId)
                        ->where('id', $productId)
                        ->update([
                            'stock' => $stockAfter,
                            'updated_at' => now(),
                        ]);
                }

                if ($paymentMethod === 'CASH') {
                    $amountReceived = (int) $input['amountReceived'];
                    if ($amountReceived < $subtotal) {
                        throw new RuntimeException('CASH_AMOUNT_TOO_LOW');
                    }
                    $changeDue = $amountReceived - $subtotal;
                } else {
                    $amountReceived = $subtotal;
                    $changeDue = 0;
                }

                $saleId = (string) Str::uuid();
                $currency = (string) (DB::table('ecommerce_stores')
                    ->where('company_id', $companyId)
                    ->value('currency') ?? 'XOF');
                $saleRow = [
                    'id' => $saleId,
                    'company_id' => $companyId,
                    'reference' => 'POS-'.now()->format('ymd').'-'.strtoupper(Str::substr(str_replace('-', '', $saleId), 0, 8)),
                    'cashier_id' => isset($actor['userId']) ? (string) $actor['userId'] : null,
                    'idempotency_key' => $idempotencyKey,
                    'customer_name' => trim((string) ($input['customerName'] ?? '')) ?: 'Client comptoir',
                    'payment_method' => $paymentMethod,
                    'payment_reference' => $paymentReference,
                    'currency' => $currency,
                    'subtotal' => $subtotal,
                    'total' => $subtotal,
                    'amount_received' => $amountReceived,
                    'change_due' => $changeDue,
                    'status' => 'PAID',
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
                DB::table('ecommerce_pos_sales')->insert($saleRow);
                foreach ($lines as &$line) {
                    $line['sale_id'] = $saleId;
                }
                unset($line);
                DB::table('ecommerce_pos_sale_items')->insert($lines);
                $movementRows = array_map(
                    static fn (array $movement): array => [
                        ...$movement,
                        'company_id' => $companyId,
                        'sale_id' => $saleId,
                        'reference' => $saleRow['reference'],
                        'cashier_id' => $saleRow['cashier_id'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ],
                    $stockMovementSnapshots,
                );
                DB::table('ecommerce_pos_stock_movements')->insert($movementRows);

                return $this->saleWithItems($companyId, (object) $saleRow);
            });
        } catch (RuntimeException $exception) {
            return match ($exception->getMessage()) {
                'PRODUCT_NOT_AVAILABLE' => response()->json(['error' => 'Un produit n’est plus disponible à la vente.'], 409),
                'INSUFFICIENT_STOCK' => response()->json(['error' => 'Le stock a changé. Réduisez la quantité puis réessayez.'], 409),
                'CASH_AMOUNT_TOO_LOW' => response()->json(['error' => 'Le montant reçu ne couvre pas le total de la vente.'], 422),
                'PHYSICAL_SALES_NOT_AUTHORIZED' => response()->json(['error' => 'La vente de produits physiques n’est pas autorisée pour cette entreprise.'], 403),
                'IDEMPOTENCY_KEY_CONFLICT' => response()->json(['error' => 'La clé d’idempotence a déjà été utilisée pour une autre vente.'], 409),
                default => throw $exception,
            };
        } catch (QueryException $exception) {
            $existing = DB::table('ecommerce_pos_sales')
                ->where('company_id', $companyId)
                ->where('idempotency_key', $idempotencyKey)
                ->first();
            if (! $existing) {
                throw $exception;
            }
            if (! $this->matchesExistingSaleRequest(
                $existing,
                $companyId,
                $input,
                $quantities,
                $paymentMethod,
                $paymentReference,
            )) {
                return response()->json(['error' => 'La clé d’idempotence a déjà été utilisée pour une autre vente.'], 409);
            }
            $sale = $this->saleWithItems($companyId, $existing);
        }

        return response()->json(['sale' => $sale], 201);
    }

    private function authorizePos(Request $request, string $action): ?JsonResponse
    {
        $actor = $request->attributes->get('authActor', []);
        if (! is_array($actor) || ! ModuleAuthorization::allows($actor, 'ecommerce', $action, 'vente-comptoir')) {
            return response()->json(['error' => 'La fonctionnalité Vente comptoir n’est pas autorisée pour ce compte.'], 403);
        }

        return null;
    }

    private function authorizeExpenses(Request $request, string $action): ?JsonResponse
    {
        $actor = $request->attributes->get('authActor', []);
        if (! is_array($actor) || ! ModuleAuthorization::allows($actor, 'ecommerce', $action, 'depenses')) {
            return response()->json(['error' => 'La fonctionnalité Dépenses n’est pas autorisée pour ce compte.'], 403);
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $input
     * @param  array<string, int>  $quantities
     */
    private function matchesExistingSaleRequest(
        object $sale,
        string $companyId,
        array $input,
        array $quantities,
        string $paymentMethod,
        ?string $paymentReference,
    ): bool {
        $customerName = trim((string) ($input['customerName'] ?? '')) ?: 'Client comptoir';
        if ((string) $sale->customer_name !== $customerName
            || (string) ($sale->payment_method ?? 'CASH') !== $paymentMethod
            || ($sale->payment_reference !== null ? (string) $sale->payment_reference : null) !== $paymentReference) {
            return false;
        }

        if ($paymentMethod === 'CASH' && (int) $sale->amount_received !== (int) $input['amountReceived']) {
            return false;
        }

        $storedLines = DB::table('ecommerce_pos_sale_items')
            ->where('company_id', $companyId)
            ->where('sale_id', $sale->id)
            ->orderBy('product_id')
            ->get(['product_id', 'quantity'])
            ->map(static fn (object $line): array => [
                'product_id' => (string) $line->product_id,
                'quantity' => (int) $line->quantity,
            ])
            ->all();

        $requestedLines = [];
        foreach ($quantities as $productId => $quantity) {
            $requestedLines[] = [
                'product_id' => (string) $productId,
                'quantity' => (int) $quantity,
            ];
        }

        return $storedLines === $requestedLines;
    }

    /**
     * @param  array<int, object>  $sales
     * @return array<int, array<string, mixed>>
     */
    private function salesWithItems(string $companyId, array $sales): array
    {
        if ($sales === []) {
            return [];
        }

        $items = DB::table('ecommerce_pos_sale_items')
            ->where('company_id', $companyId)
            ->whereIn('sale_id', array_map(static fn (object $sale): string => (string) $sale->id, $sales))
            ->orderBy('created_at')
            ->get()
            ->all();
        $items = $this->withStockSnapshots($companyId, $items);
        $itemsBySale = collect($items)->groupBy('sale_id');

        return array_map(
            fn (object $sale): array => $this->formatSale($sale, $itemsBySale->get($sale->id, collect())->all()),
            $sales,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function saleWithItems(string $companyId, object $sale): array
    {
        $items = DB::table('ecommerce_pos_sale_items')
            ->where('company_id', $companyId)
            ->where('sale_id', $sale->id)
            ->orderBy('created_at')
            ->get()
            ->all();

        return $this->formatSale($sale, $this->withStockSnapshots($companyId, $items));
    }

    /**
     * @param  array<int, object>  $items
     * @return array<int, object>
     */
    private function withStockSnapshots(string $companyId, array $items): array
    {
        if ($items === []) {
            return [];
        }

        $movements = DB::table('ecommerce_pos_stock_movements')
            ->where('company_id', $companyId)
            ->whereIn('sale_item_id', array_map(static fn (object $item): string => (string) $item->id, $items))
            ->get()
            ->keyBy('sale_item_id');

        foreach ($items as $item) {
            $movement = $movements->get((string) $item->id);
            $item->stock_before = $movement ? (int) $movement->stock_before : null;
            $item->stock_after = $movement ? (int) $movement->stock_after : null;
        }

        return $items;
    }

    /**
     * @param  array<int, object>  $items
     * @return array<string, mixed>
     */
    private function formatSale(object $sale, array $items): array
    {
        return [
            'id' => (string) $sale->id,
            'reference' => (string) $sale->reference,
            'customerName' => (string) $sale->customer_name,
            'paymentMethod' => (string) ($sale->payment_method ?? 'CASH'),
            'paymentReference' => $sale->payment_reference !== null ? (string) $sale->payment_reference : null,
            'currency' => (string) $sale->currency,
            'subtotal' => (int) $sale->subtotal,
            'total' => (int) $sale->total,
            'amountReceived' => (int) $sale->amount_received,
            'changeDue' => (int) $sale->change_due,
            'status' => (string) $sale->status,
            'createdAt' => (string) $sale->created_at,
            'items' => array_map(static fn (object $item): array => [
                'id' => (string) $item->id,
                'productId' => (string) $item->product_id,
                'productName' => (string) $item->product_name,
                'sku' => (string) $item->sku,
                'unitPrice' => (int) $item->unit_price,
                'quantity' => (int) $item->quantity,
                'lineTotal' => (int) $item->line_total,
                'stockBefore' => $item->stock_before !== null ? (int) $item->stock_before : null,
                'stockAfter' => $item->stock_after !== null ? (int) $item->stock_after : null,
            ], $items),
        ];
    }
}
