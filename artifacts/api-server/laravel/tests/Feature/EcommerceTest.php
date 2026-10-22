<?php

namespace Tests\Feature;

use App\Models\AuthUser;
use App\Models\Company;
use App\Services\EcommerceDomainVerifier;
use App\Support\CompanyRegistry;
use App\Support\ModuleCatalog;
use App\Support\MaximusAuth;
use App\Support\ModuleAuthorization;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class EcommerceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['kora', 'other-company'] as $companyId) {
            DB::table('company_public_site_access')->updateOrInsert(
                ['company_id' => $companyId],
                [
                    'enabled' => true,
                    'updated_by' => 'ecommerce-test',
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        }
    }

    public function test_pos_requires_an_explicit_feature_grant(): void
    {
        $this->setEcommerceFeatures(['dashboard', 'catalogue', 'vente-physique']);

        $this->asActor()
            ->getJson('/api/ecommerce/pos-sales?companyId=kora')
            ->assertForbidden();
    }

    public function test_immobilier_annonces_permission_manages_one_property_and_keeps_private_fields_hidden(): void
    {
        $this->setImmobilierFeatures(['dashboard', 'biens', 'annonces']);
        $request = $this->asActor('employee', [
            'immobilier:menu:annonces' => ['voir', 'créer', 'modifier'],
        ]);

        $response = $request->postJson('/api/immobilier/properties?companyId=kora', [
            'reference' => 'IMM-ANN-01',
            'title' => 'Villa témoin',
            'description' => 'Description publique.',
            'publicationStatus' => 'PUBLISHED',
            'featured' => true,
            'propertyType' => 'VILLA',
            'transactionType' => 'SALE',
            'status' => 'AVAILABLE',
            'city' => 'Dakar',
            'price' => 45000000,
            'address' => 'Adresse privée',
            'internalNotes' => 'Note privée',
        ])
            ->assertCreated()
            ->assertJsonPath('property.title', 'Villa témoin')
            ->assertJsonPath('property.publicationStatus', 'PUBLISHED')
            ->assertJsonPath('property.address', '')
            ->assertJsonPath('property.internalNotes', '');

        $propertyId = (string) $response->json('property.id');

        $request->getJson('/api/immobilier/bootstrap?companyId=kora')
            ->assertOk()
            ->assertJsonPath('properties.0.id', $propertyId)
            ->assertJsonPath('properties.0.publicationStatus', 'PUBLISHED')
            ->assertJsonPath('properties.0.address', '')
            ->assertJsonPath('properties.0.internalNotes', '');

        $request->patchJson("/api/immobilier/properties/{$propertyId}?companyId=kora", [
            'title' => 'Villa témoin en brouillon',
            'publicationStatus' => 'DRAFT',
            'address' => 'Nouvelle adresse privée',
            'internalNotes' => 'Nouvelle note privée',
        ])
            ->assertOk()
            ->assertJsonPath('property.publicationStatus', 'DRAFT');

        $this->assertDatabaseCount('immobilier_properties', 1);
        $this->assertDatabaseCount('immobilier_listings', 0);
        $this->assertDatabaseHas('immobilier_properties', [
            'id' => $propertyId,
            'publication_status' => 'DRAFT',
            'address' => null,
            'internal_notes' => null,
        ]);
    }

    public function test_public_store_returns_only_published_immobilier_properties_without_private_fields(): void
    {
        Company::query()->create([
            'id' => 'kora',
            'name' => 'KORA',
            'manager' => 'Responsable KORA',
            'email' => 'kora@example.test',
            'status' => 'ACTIF',
            'requested_modules' => ['ecommerce', 'immobilier'],
        ]);
        $this->setEcommerceFeatures(['catalogue']);
        $this->setImmobilierFeatures(['dashboard', 'biens', 'annonces', 'vitrine-publique']);

        DB::table('ecommerce_stores')->insert([
            'id' => 'store-kora',
            'company_id' => 'kora',
            'slug' => 'kora-immobilier',
            'name' => 'KORA Immobilier',
            'description' => '',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primary_color' => '#203040',
            'accent_color' => '#d6a400',
            'logo_url' => '',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ([
            ['id' => 'property-published', 'publication_status' => 'PUBLISHED', 'publication_title' => 'Villa publiée', 'publication_slug' => 'villa-publiee'],
            ['id' => 'property-draft', 'publication_status' => 'DRAFT', 'publication_title' => 'Villa brouillon', 'publication_slug' => 'villa-brouillon'],
        ] as $property) {
            DB::table('immobilier_properties')->insert([
                ...$property,
                'company_id' => 'kora',
                'reference' => strtoupper($property['id']),
                'publication_description' => 'Texte visible au public.',
                'featured' => false,
                'property_type' => 'VILLA',
                'transaction_type' => 'SALE',
                'status' => 'AVAILABLE',
                'city' => 'Dakar',
                'neighborhood' => 'Plateau',
                'address' => 'Adresse privée',
                'price' => 45000000,
                'area_m2' => 120,
                'bedrooms' => 3,
                'bathrooms' => 2,
                'furnished' => false,
                'internal_notes' => 'Note interne',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->getJson('/api/shop/kora-immobilier')
            ->assertOk()
            ->assertJsonCount(1, 'immobilierProperties')
            ->assertJsonPath('immobilierProperties.0.id', 'property-published')
            ->assertJsonPath('immobilierProperties.0.title', 'Villa publiée')
            ->assertJsonPath('immobilierProperties.0.slug', 'villa-publiee')
            ->assertJsonMissingPath('immobilierProperties.0.address')
            ->assertJsonMissingPath('immobilierProperties.0.internalNotes');
    }

    public function test_company_profile_update_does_not_revoke_existing_pos_feature_grant(): void
    {
        $this->setEcommerceFeatures(['dashboard', 'catalogue', 'vente-comptoir']);
        $company = Company::query()->create([
            'id' => 'kora',
            'name' => 'KORA',
            'manager' => 'Responsable KORA',
            'email' => 'kora@example.test',
            'status' => 'ACTIF',
            'requested_modules' => ['ecommerce'],
        ]);
        $company->update([
            'requested_modules' => ['ecommerce'],
            'requested_module_features' => [
                'ecommerce' => ['dashboard', 'catalogue'],
            ],
            'requested_module_pack_ids' => ['ecommerce' => []],
            'requested_module_permissions' => ['ecommerce' => []],
        ]);
        $request = $this->asActor();

        $request->getJson('/api/ecommerce/pos-sales?companyId=kora')->assertOk();
        $request->patchJson('/api/companies/kora', [
            'name' => (string) $company->name,
            'manager' => (string) $company->manager,
            'email' => (string) $company->email,
            'phone' => (string) ($company->phone ?? ''),
            'country' => (string) ($company->country ?? ''),
            'sector' => (string) ($company->sector ?? ''),
        ])->assertOk();

        $request->getJson('/api/ecommerce/pos-sales?companyId=kora')->assertOk();
    }

    public function test_sales_report_combines_sources_scopes_company_and_groups_paid_revenue_by_currency(): void
    {
        $this->setEcommerceFeatures(['dashboard', 'catalogue', 'commandes', 'vente-comptoir', 'rapport-ventes']);
        $now = now();
        DB::table('ecommerce_stores')->updateOrInsert(
            ['id' => 'ecommerce-store-kora'],
            [
                'company_id' => 'kora',
                'slug' => 'kora-report-store',
                'name' => 'Boutique rapport',
                'description' => '',
                'status' => 'PUBLISHED',
                'currency' => 'USD',
                'primary_color' => '#D69E2E',
                'accent_color' => '#172033',
                'logo_url' => '',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        );
        $createOrder = static function (
            string $id,
            string $companyId,
            string $reference,
            int $total,
            string $status,
            string $paymentStatus,
            ?string $currency,
            $createdAt,
        ): void {
            DB::table('ecommerce_orders')->insert([
                'id' => $id,
                'company_id' => $companyId,
                'reference' => $reference,
                'customer_name' => 'Client '.$reference,
                'customer_email' => strtolower($reference).'@example.test',
                'customer_phone' => '',
                'shipping_address' => 'Dakar',
                'note' => '',
                'total' => $total,
                'currency' => $currency,
                'status' => $status,
                'payment_status' => $paymentStatus,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);
        };
        $createOrder('report-online-paid', 'kora', 'WEB-PAID', 10000, 'LIVRÉE', 'PAID', 'XOF', $now);
        $createOrder('report-online-unpaid', 'kora', 'WEB-UNPAID', 2000, 'NOUVELLE', 'UNPAID', 'USD', $now->copy()->subMinute());
        $createOrder('report-online-refunded', 'kora', 'WEB-REFUNDED', 3000, 'ANNULÉE', 'REFUNDED', null, $now->copy()->subMinutes(2));
        $createOrder('report-online-legacy-paid', 'kora', 'WEB-LEGACY', 4000, 'LIVRÉE', 'PAID', null, $now->copy()->subMinutes(2));
        $createOrder('report-online-past-paid', 'kora', 'WEB-PAST', 500, 'LIVRÉE', 'PAID', 'XOF', $now->copy()->subYear());
        $createOrder('report-other-company', 'other-company', 'WEB-OTHER', 99000, 'LIVRÉE', 'PAID', 'XOF', $now);

        DB::table('ecommerce_pos_sales')->insert([
            [
                'id' => 'report-pos-past-paid',
                'company_id' => 'kora',
                'reference' => 'POS-PAST',
                'idempotency_key' => 'report-pos-past-key',
                'customer_name' => 'Client comptoir historique',
                'currency' => 'EUR',
                'subtotal' => 10,
                'total' => 10,
                'amount_received' => 10,
                'change_due' => 0,
                'status' => 'PAID',
                'payment_method' => 'CASH',
                'created_at' => $now->copy()->subYear(),
                'updated_at' => $now->copy()->subYear(),
            ],
            [
                'id' => 'report-pos-paid',
                'company_id' => 'kora',
                'reference' => 'POS-PAID',
                'idempotency_key' => 'report-pos-paid-key',
                'customer_name' => 'Client comptoir',
                'currency' => 'EUR',
                'subtotal' => 25,
                'total' => 25,
                'amount_received' => 25,
                'change_due' => 0,
                'status' => 'PAID',
                'payment_method' => 'WAVE',
                'created_at' => $now->copy()->subMinutes(3),
                'updated_at' => $now->copy()->subMinutes(3),
            ],
            [
                'id' => 'report-pos-refunded',
                'company_id' => 'kora',
                'reference' => 'POS-REFUNDED',
                'idempotency_key' => 'report-pos-refunded-key',
                'customer_name' => 'Client remboursé',
                'currency' => 'XOF',
                'subtotal' => 500,
                'total' => 500,
                'amount_received' => 500,
                'change_due' => 0,
                'status' => 'REFUNDED',
                'payment_method' => 'CASH',
                'created_at' => $now->copy()->subMinutes(4),
                'updated_at' => $now->copy()->subMinutes(4),
            ],
        ]);
        DB::table('ecommerce_pos_sales')->insert([
            'id' => 'report-pos-other-company',
            'company_id' => 'other-company',
            'reference' => 'POS-OTHER',
            'idempotency_key' => 'report-pos-other-key',
            'customer_name' => 'Autre entreprise',
            'currency' => 'XOF',
            'subtotal' => 80000,
            'total' => 80000,
            'amount_received' => 80000,
            'change_due' => 0,
            'status' => 'PAID',
            'payment_method' => 'CASH',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $date = $now->toDateString();
        $request = $this->asActor();
        $response = $request
            ->getJson("/api/ecommerce/sales-report?companyId=kora&dateFrom={$date}&dateTo={$date}&perPage=2")
            ->assertOk()
            ->assertJsonPath('summary.totalSales', 6)
            ->assertJsonPath('summary.onlineSales', 4)
            ->assertJsonPath('summary.counterSales', 2)
            ->assertJsonPath('summary.paidSales', 3)
            ->assertJsonPath('summary.refundedSales', 2)
            ->assertJsonPath('pagination.total', 6)
            ->assertJsonPath('pagination.lastPage', 3)
            ->assertJsonFragment(['currency' => 'XOF', 'amount' => 10000])
            ->assertJsonFragment(['currency' => 'INCONNUE', 'amount' => 4000])
            ->assertJsonFragment(['currency' => 'EUR', 'amount' => 25])
            ->assertJsonMissing(['reference' => 'WEB-OTHER'])
            ->assertJsonMissing(['reference' => 'POS-OTHER']);

        $this->assertCount(2, $response->json('sales'));
        $request
            ->getJson('/api/ecommerce/bootstrap?companyId=kora')
            ->assertOk()
            ->assertJsonFragment(['currency' => 'XOF', 'total' => 10500, 'online' => 10500, 'counter' => 0])
            ->assertJsonFragment(['currency' => 'EUR', 'total' => 35, 'online' => 0, 'counter' => 35, 'todayTotal' => 25, 'todayCounter' => 25])
            ->assertJsonFragment(['currency' => 'INCONNUE', 'total' => 4000, 'online' => 4000, 'counter' => 0, 'todayTotal' => 4000, 'todayOnline' => 4000]);
        $request
            ->getJson("/api/ecommerce/sales-report?companyId=kora&dateFrom={$date}&dateTo={$date}&source=COUNTER")
            ->assertOk()
            ->assertJsonPath('summary.totalSales', 2)
            ->assertJsonPath('availableSources', ['ONLINE', 'COUNTER']);
    }

    public function test_sales_report_requires_its_own_company_feature_grant(): void
    {
        $this->setEcommerceFeatures(['dashboard', 'catalogue', 'commandes']);

        $this->asActor()
            ->getJson('/api/ecommerce/sales-report?companyId=kora')
            ->assertForbidden();
    }

    public function test_sales_report_sources_are_limited_to_company_enabled_features(): void
    {
        $this->setEcommerceFeatures(['dashboard', 'catalogue', 'commandes', 'rapport-ventes']);
        $request = $this->asActor();

        $request
            ->getJson('/api/ecommerce/sales-report?companyId=kora')
            ->assertOk()
            ->assertJsonPath('availableSources', ['ONLINE']);

        $request
            ->getJson('/api/ecommerce/sales-report?companyId=kora&source=COUNTER')
            ->assertForbidden();
    }

    public function test_sales_report_returns_an_empty_result_when_no_source_is_enabled(): void
    {
        $this->setEcommerceFeatures(['dashboard', 'catalogue', 'rapport-ventes']);

        $this->asActor()
            ->getJson('/api/ecommerce/sales-report?companyId=kora')
            ->assertOk()
            ->assertJsonPath('availableSources', [])
            ->assertJsonPath('summary.totalSales', 0)
            ->assertJsonPath('pagination.total', 0);
    }

    public function test_cash_pos_sale_decrements_shared_stock_once_and_reports_the_change(): void
    {
        $this->setEcommerceFeatures(['dashboard', 'catalogue', 'vente-physique', 'vente-comptoir']);
        DB::table('ecommerce_stores')->updateOrInsert(
            ['id' => 'ecommerce-store-kora'],
            [
                'company_id' => 'kora',
                'slug' => 'kora-boutique',
                'name' => 'Boutique KORA',
                'description' => '',
                'status' => 'PUBLISHED',
                'currency' => 'XOF',
                'primary_color' => '#D69E2E',
                'accent_color' => '#172033',
                'logo_url' => '',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );
        DB::table('ecommerce_products')->insert([
            'id' => 'ecommerce-pos-product',
            'company_id' => 'kora',
            'name' => 'Produit comptoir',
            'slug' => 'produit-comptoir',
            'sku' => 'POS-001',
            'description' => '',
            'category' => 'Général',
            'price' => 1000,
            'stock' => 5,
            'image_url' => '',
            'featured' => false,
            'status' => 'PUBLISHED',
            'product_type' => 'SALE',
            'fulfillment_type' => 'PHYSICAL',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $request = $this->asActor();
        $response = $request
            ->withHeader('Idempotency-Key', 'pos-test-sale-001')
            ->postJson('/api/ecommerce/pos-sales?companyId=kora', [
                'lines' => [['productId' => 'ecommerce-pos-product', 'quantity' => 2]],
                'amountReceived' => 3000,
                'customerName' => 'Client comptoir',
            ])
            ->assertCreated()
            ->assertJsonPath('sale.total', 2000)
            ->assertJsonPath('sale.amountReceived', 3000)
            ->assertJsonPath('sale.changeDue', 1000)
            ->assertJsonPath('sale.paymentMethod', 'CASH')
            ->assertJsonPath('sale.paymentReference', null)
            ->assertJsonPath('sale.items.0.quantity', 2)
            ->assertJsonPath('sale.items.0.stockBefore', 5)
            ->assertJsonPath('sale.items.0.stockAfter', 3);

        $saleId = $response->json('sale.id');
        $this->assertDatabaseHas('ecommerce_products', ['id' => 'ecommerce-pos-product', 'stock' => 3]);
        $this->assertDatabaseHas('ecommerce_pos_sales', ['id' => $saleId, 'status' => 'PAID']);
        $this->assertDatabaseHas('ecommerce_pos_sale_items', ['sale_id' => $saleId, 'product_id' => 'ecommerce-pos-product']);
        $this->assertDatabaseHas('ecommerce_pos_stock_movements', [
            'company_id' => 'kora',
            'sale_id' => $saleId,
            'product_id' => 'ecommerce-pos-product',
            'movement_type' => 'VENTE',
            'quantity' => 2,
            'stock_before' => 5,
            'stock_after' => 3,
        ]);
        $this->assertDatabaseCount('seller_wallet_ledger', 0);
        $this->assertDatabaseCount('maximus_wallet_ledger', 0);

        $request
            ->withHeader('Idempotency-Key', 'pos-test-sale-001')
            ->postJson('/api/ecommerce/pos-sales?companyId=kora', [
                'lines' => [['productId' => 'ecommerce-pos-product', 'quantity' => 2]],
                'amountReceived' => 3000,
                'customerName' => 'Client comptoir',
            ])
            ->assertCreated()
            ->assertJsonPath('sale.id', $saleId);

        $this->assertDatabaseHas('ecommerce_products', ['id' => 'ecommerce-pos-product', 'stock' => 3]);
        $this->assertDatabaseCount('ecommerce_pos_sales', 1);
        $this->assertDatabaseCount('ecommerce_pos_stock_movements', 1);

        $request->getJson('/api/ecommerce/pos-sales?companyId=kora')
            ->assertOk()
            ->assertJsonPath('summary.todaySalesCount', 1)
            ->assertJsonPath('summary.todayRevenue', 2000)
            ->assertJsonPath('summary.todayCashReceived', 3000)
            ->assertJsonPath('summary.todayMobileMoneyReceived', 0)
            ->assertJsonPath('summary.todayChangeGiven', 1000);
    }

    public function test_pos_mobile_money_needs_confirmation_but_no_provider_reference_and_records_inventory_once(): void
    {
        $this->setEcommerceFeatures(['dashboard', 'catalogue', 'vente-physique', 'vente-comptoir']);
        DB::table('ecommerce_products')->insert([
            'id' => 'ecommerce-pos-mobile-product',
            'company_id' => 'kora',
            'name' => 'Produit mobile',
            'slug' => 'produit-mobile',
            'sku' => 'POS-MOBILE-001',
            'description' => '',
            'category' => 'Général',
            'price' => 1000,
            'stock' => 5,
            'image_url' => '',
            'featured' => false,
            'status' => 'PUBLISHED',
            'product_type' => 'SALE',
            'fulfillment_type' => 'PHYSICAL',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $request = $this->asActor();
        $request
            ->withHeader('Idempotency-Key', 'pos-mobile-unconfirmed')
            ->postJson('/api/ecommerce/pos-sales?companyId=kora', [
                'lines' => [['productId' => 'ecommerce-pos-mobile-product', 'quantity' => 1]],
                'paymentMethod' => 'WAVE',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('paymentConfirmed');
        $this->assertDatabaseHas('ecommerce_products', ['id' => 'ecommerce-pos-mobile-product', 'stock' => 5]);
        $this->assertDatabaseCount('ecommerce_pos_sales', 0);
        $this->assertDatabaseCount('ecommerce_pos_stock_movements', 0);

        foreach ([
            ['method' => 'WAVE', 'stockBefore' => 5, 'stockAfter' => 4],
            ['method' => 'ORANGE_MONEY', 'stockBefore' => 4, 'stockAfter' => 3],
        ] as $index => $payment) {
            $payload = [
                'lines' => [['productId' => 'ecommerce-pos-mobile-product', 'quantity' => 1]],
                'paymentMethod' => $payment['method'],
                'paymentConfirmed' => true,
            ];
            $idempotencyKey = 'pos-mobile-payment-'.$index;
            $response = $request
                ->withHeader('Idempotency-Key', $idempotencyKey)
                ->postJson('/api/ecommerce/pos-sales?companyId=kora', $payload)
                ->assertCreated()
                ->assertJsonPath('sale.paymentMethod', $payment['method'])
                ->assertJsonPath('sale.paymentReference', null)
                ->assertJsonPath('sale.amountReceived', 1000)
                ->assertJsonPath('sale.changeDue', 0)
                ->assertJsonPath('sale.items.0.stockBefore', $payment['stockBefore'])
                ->assertJsonPath('sale.items.0.stockAfter', $payment['stockAfter']);
            $saleId = $response->json('sale.id');

            $request
                ->withHeader('Idempotency-Key', $idempotencyKey)
                ->postJson('/api/ecommerce/pos-sales?companyId=kora', $payload)
                ->assertCreated()
                ->assertJsonPath('sale.id', $saleId);

            $conflictingPayload = $payload;
            $conflictingPayload['paymentMethod'] = $payment['method'] === 'WAVE' ? 'ORANGE_MONEY' : 'WAVE';
            $request
                ->withHeader('Idempotency-Key', $idempotencyKey)
                ->postJson('/api/ecommerce/pos-sales?companyId=kora', $conflictingPayload)
                ->assertConflict()
                ->assertJsonPath('error', 'La clé d’idempotence a déjà été utilisée pour une autre vente.');
        }

        $this->assertDatabaseHas('ecommerce_products', ['id' => 'ecommerce-pos-mobile-product', 'stock' => 3]);
        $this->assertDatabaseCount('ecommerce_pos_sales', 2);
        $this->assertDatabaseCount('ecommerce_pos_stock_movements', 2);
        $this->assertDatabaseCount('seller_wallet_ledger', 0);
        $this->assertDatabaseCount('maximus_wallet_ledger', 0);

        $request
            ->getJson('/api/ecommerce/pos-sales?companyId=kora')
            ->assertOk()
            ->assertJsonPath('summary.todaySalesCount', 2)
            ->assertJsonPath('summary.todayRevenue', 2000)
            ->assertJsonPath('summary.todayCashReceived', 0)
            ->assertJsonPath('summary.todayMobileMoneyReceived', 2000)
            ->assertJsonPath('summary.todayChangeGiven', 0);
    }

    public function test_counter_cash_is_credited_only_after_maximus_confirms_a_deposit(): void
    {
        $this->setEcommerceFeatures(['dashboard', 'catalogue', 'vente-physique', 'vente-comptoir', 'finances']);
        \App\Support\CompanyPaymentAccess::ensure('kora', 'ACTIF');
        DB::table('company_payment_settings')->where('company_id', 'kora')->update(['status' => 'ACTIF']);
        DB::table('ecommerce_products')->insert([
            'id' => 'deposit-test-product', 'company_id' => 'kora', 'name' => 'Produit dépôt',
            'slug' => 'produit-depot', 'sku' => 'DEP-001', 'description' => '', 'category' => 'Général',
            'price' => 1500, 'stock' => 4, 'image_url' => '', 'featured' => false, 'status' => 'PUBLISHED',
            'product_type' => 'SALE', 'fulfillment_type' => 'PHYSICAL', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $companyActor = $this->asActor();
        $saleId = $companyActor
            ->withHeader('Idempotency-Key', 'pos-deposit-sale-01')
            ->postJson('/api/ecommerce/pos-sales?companyId=kora', [
                'lines' => [['productId' => 'deposit-test-product', 'quantity' => 2]],
                'amountReceived' => 4000,
            ])->assertCreated()->json('sale.id');
        $companyActor->getJson('/api/ecommerce/wallet?companyId=kora')
            ->assertOk()
            ->assertJsonPath('counterCashSales.0.id', $saleId);
        $deposit = $companyActor
            ->withHeader('Idempotency-Key', 'counter-deposit-01')
            ->postJson('/api/ecommerce/wallet/counter-deposits?companyId=kora', [
                'saleIds' => [$saleId],
                'reference' => 'WAVE-DEP-0001',
            ])->assertCreated()->assertJsonPath('deposit.amount', 3000)->json('deposit');

        $this->assertDatabaseCount('seller_wallet_ledger', 0);
        $companyActor->getJson('/api/ecommerce/wallet?companyId=kora')
            ->assertOk()
            ->assertJsonPath('counterCashSales', []);
        $maximusActor = $this->asActor('maximus_admin');
        $maximusActor
            ->getJson('/api/platform-settings/maximus-wallet/counter-deposits')
            ->assertOk()
            ->assertJsonPath('deposits.0.id', $deposit['id']);
        $maximusActor
            ->postJson('/api/platform-settings/maximus-wallet/counter-deposits/'.$deposit['id'].'/review', [
                'decision' => 'APPROVE',
                'note' => 'Transfert reçu et vérifié.',
            ])
            ->assertOk()
            ->assertJsonPath('deposit.status', 'APPROVED');
        $maximusActor->postJson('/api/platform-settings/maximus-wallet/counter-deposits/'.$deposit['id'].'/review', [
            'decision' => 'APPROVE',
        ])->assertStatus(409);

        $this->assertDatabaseHas('seller_wallets', ['company_id' => 'kora', 'available_balance' => 3000, 'total_credited' => 3000]);
        $this->assertDatabaseHas('seller_wallet_ledger', [
            'company_id' => 'kora',
            'type' => 'POS_CASH_DEPOSIT',
            'amount' => 3000,
            'reference_id' => $deposit['id'],
            'idempotency_key' => 'pos-cash-deposit:'.$deposit['id'],
        ]);
        $this->assertDatabaseCount('seller_wallet_ledger', 1);
    }

    public function test_ecommerce_requires_a_session_and_company_context(): void
    {
        $this->getJson('/api/ecommerce/bootstrap?companyId=kora')->assertUnauthorized();

        $this->asActor()
            ->getJson('/api/ecommerce/bootstrap?companyId=another-company')
            ->assertForbidden();
    }

    public function test_pos_expenses_are_tenant_scoped_and_separate_from_gross_revenue(): void
    {
        $this->setEcommerceFeatures(['dashboard', 'depenses', 'investissements']);
        DB::table('ecommerce_stores')->updateOrInsert(
            ['id' => 'ecommerce-store-kora'],
            [
                'company_id' => 'kora',
                'slug' => 'kora-boutique',
                'name' => 'Boutique KORA',
                'description' => '',
                'status' => 'PUBLISHED',
                'currency' => 'XOF',
                'primary_color' => '#D69E2E',
                'accent_color' => '#172033',
                'logo_url' => '',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );

        $request = $this->asActor();
        $today = now()->toDateString();
        $yesterday = now()->subDay()->toDateString();
        $todayResponse = $request->postJson('/api/ecommerce/pos-expenses?companyId=kora', [
            'type' => 'INVESTMENT',
            'amount' => 500,
            'description' => 'Équipement',
            'expenseDate' => $today,
        ])->assertCreated()->assertJsonPath('expense.type', 'INVESTMENT');
        $this->assertDatabaseHas('ecommerce_pos_expenses', [
            'id' => $todayResponse->json('expense.id'),
            'company_id' => 'kora',
            'currency' => 'XOF',
            'amount' => 500,
        ]);
        $request->postJson('/api/ecommerce/pos-expenses?companyId=kora', [
            'type' => 'PERSONAL',
            'amount' => 200,
            'expenseDate' => $yesterday,
        ])->assertCreated();

        DB::table('ecommerce_pos_expenses')->insert([
            'id' => 'other-company-expense',
            'company_id' => 'other-company',
            'type' => 'PERSONAL',
            'description' => '',
            'amount' => 9000,
            'currency' => 'XOF',
            'expense_date' => $today,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $request->getJson('/api/ecommerce/pos-expenses?companyId=kora&type=INVESTMENT')
            ->assertOk()
            ->assertJsonPath('currency', 'XOF')
            ->assertJsonPath('expenseSummary.total', 700)
            ->assertJsonPath('expenseSummary.todayTotal', 500)
            ->assertJsonPath('expenseSummary.investmentTotal', 500)
            ->assertJsonPath('expenseSummary.personalTotal', 200)
            ->assertJsonPath('expenseSummary.netToday', -500)
            ->assertJsonMissing(['id' => 'other-company-expense']);
        $request->getJson('/api/ecommerce/pos-sales?companyId=kora')->assertForbidden();

        $this->setEcommerceFeatures(['dashboard', 'catalogue', 'vente-physique', 'vente-comptoir']);
        $request
            ->getJson('/api/ecommerce/pos-expenses?companyId=kora&type=PERSONAL')
            ->assertForbidden();
    }

    public function test_expense_and_investment_categories_are_tenant_scoped_and_use_separate_features(): void
    {
        $this->setEcommerceFeatures(['dashboard', 'depenses', 'investissements']);
        $request = $this->asActor();
        $expenseCategory = $request->postJson('/api/ecommerce/expense-categories?companyId=kora', [
            'kind' => 'EXPENSE',
            'name' => 'Transport',
        ])->assertCreated()->json('category');
        $investmentCategory = $request->postJson('/api/ecommerce/expense-categories?companyId=kora', [
            'kind' => 'INVESTMENT',
            'name' => 'Équipement',
        ])->assertCreated()->json('category');

        $request->getJson('/api/ecommerce/expense-categories?companyId=kora&kind=EXPENSE')
            ->assertOk()
            ->assertJsonCount(1, 'categories')
            ->assertJsonPath('categories.0.id', $expenseCategory['id']);
        $request->postJson('/api/ecommerce/pos-expenses?companyId=kora', [
            'type' => 'PERSONAL',
            'categoryId' => $expenseCategory['id'],
            'amount' => 1200,
            'expenseDate' => now()->toDateString(),
        ])->assertCreated()->assertJsonPath('expense.categoryName', 'Transport');
        $request->postJson('/api/ecommerce/pos-expenses?companyId=kora', [
            'type' => 'INVESTMENT',
            'categoryId' => $investmentCategory['id'],
            'amount' => 25000,
            'expenseDate' => now()->toDateString(),
        ])->assertCreated()->assertJsonPath('expense.categoryName', 'Équipement');

        $this->setEcommerceFeatures(['dashboard', 'depenses']);
        $request->getJson('/api/ecommerce/expense-categories?companyId=kora&kind=INVESTMENT')
            ->assertForbidden();
        $request->postJson('/api/ecommerce/expense-categories?companyId=kora', [
            'kind' => 'INVESTMENT',
            'name' => 'Véhicule',
        ])->assertForbidden();
    }

    public function test_expense_category_actions_follow_the_view_create_modify_ladder(): void
    {
        $this->setEcommerceFeatures(['dashboard', 'depenses', 'investissements']);
        $request = $this->asActor('employee', [
            'ecommerce:menu:depenses' => ['voir', 'créer'],
        ]);
        $category = $request->postJson('/api/ecommerce/expense-categories?companyId=kora', [
            'kind' => 'EXPENSE',
            'name' => 'Transport',
        ])->assertCreated()->json('category');

        $request->getJson('/api/ecommerce/expense-categories?companyId=kora&kind=EXPENSE')->assertOk();
        $request->patchJson('/api/ecommerce/expense-categories/'.$category['id'].'?companyId=kora', [
            'name' => 'Déplacements',
        ])->assertForbidden();
    }

    public function test_disabled_ecommerce_module_is_rejected_by_the_server(): void
    {
        DB::table('maximus_company_modules')
            ->where('company_id', 'kora')
            ->where('module_id', 'ecommerce')
            ->update(['status' => 'INACTIF']);

        $this->asActor()
            ->getJson('/api/ecommerce/bootstrap?companyId=kora')
            ->assertForbidden()
            ->assertJsonPath('moduleId', 'ecommerce');
    }

    public function test_detailed_catalogue_permissions_allow_reading_but_not_creating(): void
    {
        $request = $this->asActor('employee', [
            'ecommerce:menu:catalogue' => ['voir'],
        ]);

        $request->getJson('/api/ecommerce/bootstrap?companyId=kora')->assertOk();
        $this->assertDatabaseMissing('ecommerce_stores', ['id' => 'ecommerce-store-kora']);

        $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Produit interdit',
            'slug' => 'produit-interdit',
            'sku' => 'FORBIDDEN-01',
            'price' => 1000,
            'stock' => 1,
        ])->assertForbidden();

        $this->assertDatabaseMissing('ecommerce_products', ['sku' => 'FORBIDDEN-01']);
    }

    public function test_ecommerce_crud_requires_the_permission_ladder_on_the_same_feature(): void
    {
        $actor = fn (array $permissions): array => [
            'role' => 'employee',
            'companyId' => 'kora',
            'permissions' => ['ecommerce:menu:catalogue' => $permissions],
        ];

        $viewOnly = $actor(['voir']);
        $this->assertTrue(ModuleAuthorization::allows($viewOnly, 'ecommerce', 'view', 'catalogue'));
        $this->assertFalse(ModuleAuthorization::allows($viewOnly, 'ecommerce', 'create', 'catalogue'));
        $this->assertFalse(ModuleAuthorization::allows($viewOnly, 'ecommerce', 'modify', 'catalogue'));
        $this->assertFalse(ModuleAuthorization::allows($viewOnly, 'ecommerce', 'delete', 'catalogue'));

        $viewAndCreate = $actor(['voir', 'créer']);
        $this->assertTrue(ModuleAuthorization::allows($viewAndCreate, 'ecommerce', 'create', 'catalogue'));
        $this->assertFalse(ModuleAuthorization::allows($viewAndCreate, 'ecommerce', 'modify', 'catalogue'));
        $this->assertFalse(ModuleAuthorization::allows($viewAndCreate, 'ecommerce', 'delete', 'catalogue'));

        $modifyWithoutCreate = $actor(['voir', 'modifier']);
        $this->assertFalse(ModuleAuthorization::allows($modifyWithoutCreate, 'ecommerce', 'modify', 'catalogue'));
        $this->assertFalse(ModuleAuthorization::allows($modifyWithoutCreate, 'ecommerce', 'delete', 'catalogue'));

        $fullAccess = $actor(['voir', 'créer', 'modifier']);
        $this->assertTrue(ModuleAuthorization::allows($fullAccess, 'ecommerce', 'modify', 'catalogue'));
        $this->assertTrue(ModuleAuthorization::allows($fullAccess, 'ecommerce', 'delete', 'catalogue'));
    }

    public function test_detailed_settings_permission_allows_store_logo_upload(): void
    {
        Storage::fake('public');
        $request = $this->asActor('employee', [
            'ecommerce:menu:parametres' => ['voir', 'créer', 'modifier'],
        ]);

        $response = $request->post('/api/ecommerce/store/logo?companyId=kora', [
            'image' => UploadedFile::fake()->image('logo-boutique.png'),
        ])->assertOk();

        $logoUrl = $response->json('logoUrl');
        $this->assertStringStartsWith('/api/store-logos/kora/', $logoUrl);
        $this->assertDatabaseHas('ecommerce_stores', [
            'id' => 'ecommerce-store-kora',
            'logo_url' => $logoUrl,
        ]);
    }

    public function test_order_attachment_setting_is_saved_and_published_in_the_public_shop(): void
    {
        $this->asActor()
            ->patchJson('/api/ecommerce/store?companyId=kora', [
                'name' => 'Boutique KORA',
                'slug' => 'kora-documents',
                'description' => 'Boutique de test',
                'status' => 'PUBLISHED',
                'currency' => 'XOF',
                'primaryColor' => '#D69E2E',
                'accentColor' => '#172033',
                'allowOrderAttachments' => true,
            ])
            ->assertOk()
            ->assertJsonPath('allowOrderAttachments', true);

        $this->getJson('/api/shop/kora-documents')
            ->assertOk()
            ->assertJsonPath('store.allowOrderAttachments', true);
    }

    public function test_categories_are_persistent_and_products_are_linked_to_them(): void
    {
        $request = $this->asActor();
        $category = $request->postJson('/api/ecommerce/categories?companyId=kora', [
            'name' => 'Épicerie fine',
            'description' => 'Produits sélectionnés',
            'sortOrder' => 2,
        ])->assertCreated()
            ->assertJsonPath('name', 'Épicerie fine')
            ->assertJsonPath('slug', 'epicerie-fine')
            ->json();

        $request->getJson('/api/ecommerce/bootstrap?companyId=kora')
            ->assertOk()
            ->assertJsonPath('categories.0.id', $category['id']);

        $product = $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Coffret dégustation',
            'sku' => 'COFFRET-01',
            'categoryId' => $category['id'],
            'price' => 15000,
            'stock' => 4,
        ])->assertCreated()
            ->assertJsonPath('slug', 'coffret-degustation')
            ->assertJsonPath('categoryId', $category['id'])
            ->assertJsonPath('category', 'Épicerie fine')
            ->json();

        $request->patchJson('/api/ecommerce/categories/'.$category['id'].'?companyId=kora', [
            'name' => 'Épicerie premium',
        ])->assertOk();

        $request->deleteJson('/api/ecommerce/categories/'.$category['id'].'?companyId=kora')
            ->assertOk();

        $this->assertDatabaseHas('ecommerce_products', [
            'id' => $product['id'],
            'category_id' => null,
            'category' => 'Général',
        ]);
        $this->assertDatabaseMissing('ecommerce_categories', ['id' => $category['id']]);
    }

    public function test_product_and_category_slugs_are_generated_and_scoped_to_the_company(): void
    {
        $request = $this->asActor();
        $category = $request->postJson('/api/ecommerce/categories?companyId=kora', [
            'name' => 'Accessoires',
        ])->assertCreated()->assertJsonPath('slug', 'accessoires')->json();

        $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Sac Atlas',
            'sku' => 'ATLAS-01',
            'categoryId' => $category['id'],
            'price' => 12000,
            'stock' => 3,
        ])->assertCreated()->assertJsonPath('slug', 'sac-atlas');

        DB::table('ecommerce_products')->insert([
            'id' => 'other-company-product',
            'company_id' => 'other-company',
            'name' => 'Sac Atlas',
            'slug' => 'sac-atlas',
            'sku' => 'OTHER-ATLAS-01',
            'description' => '',
            'category' => 'Général',
            'price' => 12000,
            'compare_at_price' => null,
            'stock' => 3,
            'image_url' => '',
            'featured' => false,
            'status' => 'DRAFT',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Sac Atlas entreprise',
            'sku' => 'ATLAS-02',
            'slug' => 'sac-atlas',
            'price' => 12000,
            'stock' => 3,
        ])->assertCreated()->assertJsonPath('slug', 'sac-atlas-2');
    }

    public function test_same_store_name_keeps_each_company_isolated_with_a_unique_public_slug(): void
    {
        $first = $this->asActor()
            ->patchJson('/api/ecommerce/store?companyId=kora', [
                'name' => 'Boutique commune',
                'slug' => 'boutique-commune',
                'description' => 'Catalogue de la première entreprise',
                'status' => 'PUBLISHED',
                'currency' => 'XOF',
                'primaryColor' => '#D69E2E',
                'accentColor' => '#172033',
            ])
            ->assertOk()
            ->json();

        CompanyRegistry::ensureActive('other-company', 'Autre entreprise');
        ModuleCatalog::ensureCompanyAccess('other-company');
        $otherUser = AuthUser::query()->create([
            'id' => 'ecommerce-other-company',
            'email' => 'ecommerce-other-company@demo.test',
            'password_hash' => 'not-used-in-this-test',
            'display_name' => 'Autre boutiquier',
            'role' => 'company_admin',
            'company_id' => 'other-company',
            'employee_id' => null,
            'sector_ids' => [],
            'permissions' => [],
            'status' => 'ACTIF',
        ]);
        $otherRequest = $this
            ->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, MaximusAuth::issueSession($otherUser));

        $second = $otherRequest
            ->patchJson('/api/ecommerce/store?companyId=other-company', [
                'name' => 'Boutique commune',
                'slug' => 'boutique-commune',
                'description' => 'Catalogue de la deuxième entreprise',
                'status' => 'PUBLISHED',
                'currency' => 'XOF',
                'primaryColor' => '#123456',
                'accentColor' => '#654321',
            ])
            ->assertOk()
            ->assertJsonPath('slug', 'boutique-commune-2')
            ->json();

        $this->assertNotSame($first['id'], $second['id']);
        $this->assertDatabaseHas('ecommerce_stores', [
            'id' => $first['id'],
            'company_id' => 'kora',
            'name' => 'Boutique commune',
            'description' => 'Catalogue de la première entreprise',
            'slug' => 'boutique-commune',
        ]);
        $this->assertDatabaseHas('ecommerce_stores', [
            'id' => $second['id'],
            'company_id' => 'other-company',
            'name' => 'Boutique commune',
            'description' => 'Catalogue de la deuxième entreprise',
            'slug' => 'boutique-commune-2',
        ]);

        $this->getJson('/api/shop/boutique-commune')
            ->assertOk()
            ->assertJsonPath('store.description', 'Catalogue de la première entreprise');
        $this->getJson('/api/shop/boutique-commune-2')
            ->assertOk()
            ->assertJsonPath('store.description', 'Catalogue de la deuxième entreprise');
    }

    public function test_published_shop_recalculates_total_and_decrements_stock_transactionally(): void
    {
        $request = $this->asActor();
        $request->patchJson('/api/ecommerce/store?companyId=kora', [
            'name' => 'Boutique KORA',
            'slug' => 'kora-boutique-test',
            'description' => 'Boutique publique',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primaryColor' => '#D69E2E',
            'accentColor' => '#172033',
        ])->assertOk();

        $product = $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Café local',
            'slug' => 'cafe-local',
            'sku' => 'CAFE-01',
            'description' => 'Café torréfié.',
            'category' => 'Épicerie',
            'price' => 2500,
            'compareAtPrice' => 3000,
            'stock' => 3,
            'status' => 'PUBLISHED',
        ])->assertCreated();

        $this->getJson('/api/shop/kora-boutique-test')
            ->assertOk()
            ->assertJsonPath('products.0.price', 2500)
            ->assertJsonPath('products.0.slug', 'cafe-local')
            ->assertJsonMissingPath('store.id')
            ->assertJsonMissingPath('store.companyId')
            ->assertJsonMissingPath('products.0.id')
            ->assertJsonMissingPath('products.0.companyId');

        $this->postJson('/api/shop/kora-boutique-test/orders', [
            'customerName' => 'Client Test',
            'customerEmail' => 'client@example.test',
            'customerPhone' => '+221700000000',
            'shippingAddress' => 'Dakar, Sénégal',
            'items' => [['productSlug' => $product->json('slug'), 'quantity' => 2]],
        ])->assertCreated()
            ->assertJsonPath('total', 5000);

        $this->assertDatabaseHas('ecommerce_products', [
            'id' => $product->json('id'),
            'stock' => 1,
        ]);
        $this->assertDatabaseCount('ecommerce_orders', 1);
        $this->assertDatabaseCount('ecommerce_order_items', 1);

        $this->postJson('/api/shop/kora-boutique-test/orders', [
            'customerName' => 'Client Test',
            'customerEmail' => 'client@example.test',
            'shippingAddress' => 'Dakar, Sénégal',
            'items' => [['productSlug' => $product->json('slug'), 'quantity' => 2]],
        ])->assertStatus(409);

        $this->assertDatabaseCount('ecommerce_orders', 1);
    }

    public function test_public_order_cannot_use_a_product_from_another_company(): void
    {
        $request = $this->asActor();
        $request->patchJson('/api/ecommerce/store?companyId=kora', [
            'name' => 'Boutique KORA',
            'slug' => 'kora-isolation-test',
            'description' => '',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primaryColor' => '#D69E2E',
            'accentColor' => '#172033',
        ])->assertOk();

        DB::table('ecommerce_products')->insert([
            'id' => 'foreign-product',
            'company_id' => 'other-company',
            'name' => 'Produit autre entreprise',
            'slug' => 'produit-autre',
            'sku' => 'OTHER-01',
            'description' => '',
            'category' => 'Général',
            'price' => 999,
            'compare_at_price' => null,
            'stock' => 10,
            'image_url' => '',
            'featured' => false,
            'status' => 'PUBLISHED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/shop/kora-isolation-test/orders', [
            'customerName' => 'Client Test',
            'customerEmail' => 'client@example.test',
            'shippingAddress' => 'Dakar, Sénégal',
            'items' => [['productSlug' => 'produit-autre', 'quantity' => 1]],
        ])->assertStatus(400);

        $this->assertDatabaseCount('ecommerce_orders', 0);
    }

    public function test_catalogue_accepts_the_complete_product_form_payload_and_updates_a_product(): void
    {
        $request = $this->asActor();
        $payload = [
            'name' => 'Sacoche Atlas',
            'sku' => 'ATLAS-FORM-01',
            'description' => 'Une sacoche de démonstration.',
            'category' => 'Divers',
            'categoryId' => null,
            'price' => 12500,
            'compareAtPrice' => 15000,
            'stock' => 8,
            'imageUrl' => '',
            'featured' => true,
            'status' => 'PUBLISHED',
        ];

        $product = $request->postJson('/api/ecommerce/products?companyId=kora', $payload)
            ->assertCreated()
            ->assertJsonPath('name', 'Sacoche Atlas')
            ->assertJsonPath('price', 12500)
            ->assertJsonPath('compareAtPrice', 15000)
            ->assertJsonPath('status', 'PUBLISHED')
            ->json();

        $request->patchJson('/api/ecommerce/products/'.$product['id'].'?companyId=kora', [
            ...$payload,
            'name' => 'Sacoche Atlas Premium',
            'sku' => 'ATLAS-FORM-02',
        ])->assertOk()
            ->assertJsonPath('name', 'Sacoche Atlas Premium')
            ->assertJsonPath('sku', 'ATLAS-FORM-02');
    }

    public function test_public_order_is_idempotent_and_order_status_follows_allowed_transitions(): void
    {
        $request = $this->asActor();
        $request->patchJson('/api/ecommerce/store?companyId=kora', [
            'name' => 'Boutique commandes',
            'slug' => 'commandes-transition-test',
            'description' => '',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primaryColor' => '#D69E2E',
            'accentColor' => '#172033',
        ])->assertOk();
        $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Produit transition',
            'slug' => 'produit-transition',
            'sku' => 'TRANSITION-01',
            'price' => 1800,
            'stock' => 4,
            'status' => 'PUBLISHED',
        ])->assertCreated();

        $payload = [
            'customerName' => 'Client Transition',
            'customerEmail' => 'transition@example.test',
            'shippingAddress' => 'Dakar, Sénégal',
            'items' => [['productSlug' => 'produit-transition', 'quantity' => 1]],
        ];
        $first = $this->withHeader('Idempotency-Key', 'checkout-transition-1')
            ->postJson('/api/shop/commandes-transition-test/orders', $payload)
            ->assertCreated()
            ->assertJsonPath('total', 1800);
        $this->withHeader('Idempotency-Key', 'checkout-transition-1')
            ->postJson('/api/shop/commandes-transition-test/orders', $payload)
            ->assertOk()
            ->assertJson($first->json());
        $state = DB::table('maximus_app_states')->where('scope', 'workspace')->first();
        $notifications = json_decode((string) $state->payload, true)['notifications'] ?? [];
        $this->assertCount(1, array_filter(
            $notifications,
            fn (array $notification): bool => ($notification['id'] ?? null) === 'ecommerce-order-'.$first->json('id'),
        ));

        $order = DB::table('ecommerce_orders')->where('reference', $first->json('reference'))->first();
        $this->assertNotNull($order);
        $this->assertSame('XOF', (string) $order->currency);
        DB::table('ecommerce_stores')->where('company_id', 'kora')->update(['currency' => 'USD']);
        $this->assertDatabaseHas('ecommerce_orders', [
            'id' => $order->id,
            'currency' => 'XOF',
        ]);
        $this->assertDatabaseCount('ecommerce_orders', 1);
        $request->patchJson('/api/ecommerce/orders/'.$order->id.'/status?companyId=kora', ['status' => 'CONFIRMÉE'])
            ->assertOk()
            ->assertJsonPath('status', 'CONFIRMÉE');
        $request->patchJson('/api/ecommerce/orders/'.$order->id.'/status?companyId=kora', ['status' => 'LIVRÉE'])
            ->assertStatus(422);
        $request->patchJson('/api/ecommerce/orders/'.$order->id.'/status?companyId=kora', ['status' => 'ANNULÉE'])
            ->assertOk()
            ->assertJsonPath('status', 'ANNULÉE');
        $this->assertDatabaseHas('ecommerce_products', ['slug' => 'produit-transition', 'stock' => 3]);
    }

    public function test_public_order_by_slug_rejects_an_inactive_company(): void
    {
        CompanyRegistry::ensureActive('kora', 'Entreprise KORA');
        $request = $this->asActor();
        $request->patchJson('/api/ecommerce/store?companyId=kora', [
            'name' => 'Boutique inactive',
            'slug' => 'boutique-inactive-test',
            'description' => '',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primaryColor' => '#D69E2E',
            'accentColor' => '#172033',
        ])->assertOk();
        $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Produit inactif',
            'slug' => 'produit-inactif',
            'sku' => 'INACTIVE-01',
            'price' => 1000,
            'stock' => 2,
            'status' => 'PUBLISHED',
        ])->assertCreated();

        DB::table('companies')->where('id', 'kora')->update(['status' => 'SUSPENDU']);

        $this->getJson('/api/shop/boutique-inactive-test')->assertNotFound();
        $this->postJson('/api/shop/boutique-inactive-test/orders', [
            'customerName' => 'Client Inactif',
            'customerEmail' => 'inactive@example.test',
            'shippingAddress' => 'Dakar',
            'items' => [['productSlug' => 'produit-inactif', 'quantity' => 1]],
        ])->assertNotFound();
    }

    public function test_company_admin_can_upload_and_replace_a_product_image(): void
    {
        Storage::fake('public');
        $request = $this->asActor();
        $product = $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Produit avec photo',
            'slug' => 'produit-photo',
            'sku' => 'PHOTO-01',
            'price' => 1200,
            'stock' => 4,
        ])->assertCreated();

        $first = $request->post('/api/ecommerce/products/'.$product->json('id').'/image?companyId=kora', [
            'image' => UploadedFile::fake()->image('premiere-photo.jpg')->size(6000),
        ])->assertOk();
        $firstUrl = $first->json('imageUrl');
        $this->assertStringStartsWith('/api/product-images/kora/', $firstUrl);
        $firstPath = 'ecommerce/products/kora/'.basename($firstUrl);
        Storage::disk('public')->assertMissing($firstPath);
        $this->assertDatabaseHas('ecommerce_products', [
            'id' => $product->json('id'),
            'image_url' => $firstUrl,
        ]);
        $this->assertNotEmpty(DB::table('ecommerce_products')->where('id', $product->json('id'))->value('image_data'));
        Storage::disk('public')->delete($firstPath);
        $this->get($firstUrl)->assertOk()->assertHeader('Content-Type', 'image/jpeg');

        $second = $request->post('/api/ecommerce/products/'.$product->json('id').'/image?companyId=kora', [
            'image' => UploadedFile::fake()->image('seconde-photo.png'),
        ])->assertOk();
        $secondUrl = $second->json('imageUrl');
        $this->assertNotSame($firstUrl, $secondUrl);
        $preservedGallery = $second->json('gallery');
        $this->assertCount(1, $preservedGallery);
        $this->assertStringStartsWith('/api/gallery-images/kora/', $preservedGallery[0]);
        $this->get($preservedGallery[0])->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        Storage::disk('public')->assertMissing($firstPath);
        Storage::disk('public')->assertMissing('ecommerce/products/kora/'.basename($secondUrl));
        $this->assertDatabaseHas('ecommerce_products', [
            'id' => $product->json('id'),
            'image_url' => $secondUrl,
        ]);
        $this->assertNotEmpty(DB::table('ecommerce_products')->where('id', $product->json('id'))->value('image_data'));
    }

    public function test_create_only_users_cannot_add_media_to_existing_catalogue_or_location_records(): void
    {
        Storage::fake('public');
        $request = $this->asActor('employee', [
            'ecommerce:menu:catalogue' => ['voir', 'créer'],
            'ecommerce:menu:location' => ['voir', 'créer'],
        ]);

        $product = $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Produit sans média',
            'slug' => 'produit-sans-media',
            'sku' => 'NO-MEDIA-01',
            'price' => 1200,
            'stock' => 1,
        ])->assertCreated();

        $request->post('/api/ecommerce/products/'.$product->json('id').'/image?companyId=kora', [
            'image' => UploadedFile::fake()->image('interdit.jpg'),
        ])->assertForbidden();

        $rental = $request->postJson('/api/ecommerce/rentals?companyId=kora', [
            'name' => 'Location sans média',
            'category' => 'Citadine',
            'price' => 15000,
            'billingUnit' => 'JOUR',
            'availability' => 1,
        ])->assertCreated();

        $request->post('/api/ecommerce/rentals/'.$rental->json('id').'/image?companyId=kora', [
            'image' => UploadedFile::fake()->image('interdit-location.jpg'),
        ])->assertForbidden();
    }

    public function test_company_admin_can_upload_a_store_logo_without_using_the_company_logo(): void
    {
        Storage::fake('public');
        DB::table('companies')->where('id', 'kora')->update(['profile_photo' => '/api/company-images/kora/entreprise.jpg']);
        $request = $this->asActor();

        $request->getJson('/api/ecommerce/bootstrap?companyId=kora')
            ->assertOk()
            ->assertJsonPath('store.logoUrl', '');

        $response = $request->post('/api/ecommerce/store/logo?companyId=kora', [
            'image' => UploadedFile::fake()->image('logo-boutique.png'),
        ])->assertOk();

        $logoUrl = $response->json('logoUrl');
        $this->assertStringStartsWith('/api/store-logos/kora/', $logoUrl);
        $this->assertDatabaseHas('ecommerce_stores', [
            'id' => 'ecommerce-store-kora',
            'logo_url' => $logoUrl,
        ]);
        $this->assertNotEmpty(DB::table('ecommerce_stores')->where('id', 'ecommerce-store-kora')->value('logo_data'));

        $logoPath = 'ecommerce/stores/kora/'.basename($logoUrl);
        Storage::disk('public')->assertMissing($logoPath);
        $this->get($logoUrl)->assertOk()->assertHeader('Content-Type', 'image/png');

        $request->patchJson('/api/ecommerce/store?companyId=kora', [
            'name' => 'Boutique Kora',
            'slug' => 'kora-boutique',
            'description' => 'Boutique publique',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primaryColor' => '#D69E2E',
            'accentColor' => '#172033',
        ])->assertOk();
        $this->getJson('/api/shop/kora-boutique')
            ->assertOk()
            ->assertJsonPath('store.logoUrl', $logoUrl);

        Storage::disk('public')->delete($logoPath);
        $this->get($logoUrl)->assertOk()->assertHeader('Content-Type', 'image/png');
    }

    public function test_company_gallery_images_are_stored_per_owner_and_exposed_to_public_shop(): void
    {
        Storage::fake('public');
        $request = $this->asActor();
        $request->patchJson('/api/ecommerce/store?companyId=kora', [
            'name' => 'Boutique galerie',
            'slug' => 'boutique-galerie',
            'description' => 'Boutique avec plusieurs visuels',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primaryColor' => '#D69E2E',
            'accentColor' => '#172033',
        ])->assertOk();

        $product = $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Sac galerie',
            'sku' => 'GALLERY-01',
            'price' => 18000,
            'stock' => 3,
            'status' => 'PUBLISHED',
        ])->assertCreated();

        $hero = $request->post('/api/ecommerce/store/hero-images?companyId=kora', [
            'images' => [
                UploadedFile::fake()->image('hero-une.jpg'),
                UploadedFile::fake()->image('hero-deux.png'),
            ],
        ])->assertOk();
        $heroUrls = $hero->json('heroImages');
        $this->assertCount(2, $heroUrls);
        $this->assertStringStartsWith('/api/gallery-images/kora/', $heroUrls[0]);
        $this->get($heroUrls[0])->assertOk();

        $productResponse = $request->post('/api/ecommerce/products/'.$product->json('id').'/gallery?companyId=kora', [
            'images' => [
                UploadedFile::fake()->image('sac-face.jpg'),
                UploadedFile::fake()->image('sac-profil.webp'),
            ],
        ])->assertOk();
        $productGallery = $productResponse->json('gallery');
        $this->assertCount(2, $productGallery);
        $this->assertStringStartsWith('/api/gallery-images/kora/', $productGallery[0]);
        $this->assertDatabaseHas('ecommerce_gallery_images', [
            'company_id' => 'kora',
            'owner_type' => 'product',
            'owner_id' => $product->json('id'),
            'collection' => 'gallery',
        ]);

        $this->getJson('/api/shop/boutique-galerie')
            ->assertOk()
            ->assertJsonPath('store.heroImages.0', $heroUrls[0])
            ->assertJsonPath('products.0.gallery.0', $productGallery[0]);

        $this->asActor('employee')->delete('/api/ecommerce/products/'.$product->json('id').'/gallery/'.basename($productGallery[0]).'?companyId=another-company')
            ->assertForbidden();
    }

    public function test_public_shop_exposes_all_published_sale_products_including_out_of_stock_items(): void
    {
        $request = $this->asActor();
        $request->patchJson('/api/ecommerce/store?companyId=kora', [
            'name' => 'Boutique multi-produits',
            'slug' => 'boutique-multi-produits',
            'description' => 'Plusieurs références publiées',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primaryColor' => '#D69E2E',
            'accentColor' => '#172033',
        ])->assertOk();

        $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Produit public un',
            'slug' => 'produit-public-un',
            'sku' => 'PUBLIC-01',
            'price' => 1200,
            'stock' => 4,
            'status' => 'PUBLISHED',
        ])->assertCreated();
        $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Produit public deux',
            'slug' => 'produit-public-deux',
            'sku' => 'PUBLIC-02',
            'price' => 2400,
            'stock' => 7,
            'status' => 'PUBLISHED',
        ])->assertCreated();
        $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Produit brouillon',
            'slug' => 'produit-brouillon',
            'sku' => 'PUBLIC-03',
            'price' => 3600,
            'stock' => 7,
            'status' => 'DRAFT',
        ])->assertCreated();
        $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Produit temporairement indisponible',
            'slug' => 'produit-indisponible',
            'sku' => 'PUBLIC-04',
            'price' => 4800,
            'stock' => 0,
            'status' => 'PUBLISHED',
        ])->assertCreated();

        $this->getJson('/api/shop/boutique-multi-produits')
            ->assertOk()
            ->assertJsonCount(3, 'products')
            ->assertJsonFragment(['slug' => 'produit-public-un'])
            ->assertJsonFragment(['slug' => 'produit-public-deux'])
            ->assertJsonFragment(['slug' => 'produit-indisponible', 'stock' => 0])
            ->assertJsonMissing(['slug' => 'produit-brouillon']);
    }

    public function test_company_admin_can_upload_a_rental_image_and_keep_its_category(): void
    {
        Storage::fake('public');
        $request = $this->asActor();
        $category = $request->postJson('/api/ecommerce/categories?companyId=kora', [
            'name' => 'Habitat',
        ])->assertCreated()->json();
        $rental = $request->postJson('/api/ecommerce/rentals?companyId=kora', [
            'name' => 'Maison avec photo',
            'categoryId' => $category['id'],
            'price' => 18000,
            'billingUnit' => 'SEMAINE',
            'availability' => 2,
            'status' => 'PUBLISHED',
        ])->assertCreated()
            ->assertJsonPath('categoryId', $category['id'])
            ->assertJsonPath('category', 'Habitat')
            ->json();

        $response = $request->post('/api/ecommerce/rentals/'.$rental['id'].'/image?companyId=kora', [
            'image' => UploadedFile::fake()->image('maison.jpg'),
        ])->assertOk();

        $imageUrl = $response->json('imageUrl');
        $this->assertStringStartsWith('/api/rental-images/kora/', $imageUrl);
        $this->assertNotEmpty(DB::table('ecommerce_rentals')->where('id', $rental['id'])->value('image_data'));
        $this->assertDatabaseHas('ecommerce_rentals', [
            'id' => $rental['id'],
            'category_id' => $category['id'],
            'image_url' => $imageUrl,
        ]);
        Storage::disk('public')->assertMissing('ecommerce/rentals/kora/'.basename($imageUrl));
        $this->getJson($imageUrl)->assertOk()->assertHeader('Content-Type', 'image/jpeg');
    }

    public function test_company_admin_can_register_verify_and_remove_a_custom_domain(): void
    {
        $request = $this->asActor();
        $created = $request->postJson('/api/ecommerce/domains?companyId=kora', [
            'domain' => 'https://boutique.kora.test/',
        ])->assertCreated()
            ->assertJsonPath('domain', 'boutique.kora.test')
            ->assertJsonPath('status', 'PENDING')
            ->assertJsonPath('verificationName', '_maximus-verification.boutique.kora.test');

        $domainId = $created->json('id');
        $request->postJson('/api/ecommerce/domains/'.$domainId.'/verify?companyId=kora')
            ->assertStatus(422)
            ->assertJsonPath('domain.status', 'PENDING');

        $request->deleteJson('/api/ecommerce/domains/'.$domainId.'?companyId=kora')
            ->assertOk()
            ->assertJson(['ok' => true]);
        $this->assertDatabaseHas('ecommerce_domains', [
            'id' => $domainId,
            'status' => 'ARCHIVED',
        ]);
        $this->assertNotNull(DB::table('ecommerce_domains')->where('id', $domainId)->value('deleted_at'));
    }

    public function test_active_custom_domain_serves_only_its_published_company_store(): void
    {
        $request = $this->asActor();
        $request->patchJson('/api/ecommerce/store?companyId=kora', [
            'name' => 'Boutique domaine KORA',
            'slug' => 'kora-domaine-test',
            'description' => 'Boutique publiée sur son domaine.',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primaryColor' => '#D69E2E',
            'accentColor' => '#172033',
        ])->assertOk();

        $product = $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Produit domaine',
            'slug' => 'produit-domaine',
            'sku' => 'DOMAIN-01',
            'price' => 1800,
            'stock' => 2,
            'status' => 'PUBLISHED',
        ])->assertCreated();

        DB::table('ecommerce_domains')->insert([
            'id' => 'domain-active-kora',
            'company_id' => 'kora',
            'domain' => 'boutique-active.kora.test',
            'target_host' => 'maximus.test',
            'verification_token' => 'maximus-test-token',
            'status' => 'ACTIVE',
            'last_error' => '',
            'verified_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->getJson('http://boutique-active.kora.test/api/shop-domain')
            ->assertOk()
            ->assertJsonPath('products.0.slug', 'produit-domaine')
            ->assertJsonMissingPath('store.companyId')
            ->assertJsonMissingPath('products.0.id');

        $this->postJson('http://boutique-active.kora.test/api/shop-domain/orders', [
                'customerName' => 'Client Domaine',
                'customerEmail' => 'domain@example.test',
                'shippingAddress' => 'Dakar, Sénégal',
                'items' => [['productSlug' => $product->json('slug'), 'quantity' => 1]],
            ])
            ->assertCreated()
            ->assertJsonPath('total', 1800);

        $this->assertDatabaseHas('ecommerce_products', [
            'id' => $product->json('id'),
            'company_id' => 'kora',
            'stock' => 1,
        ]);

        $this->getJson('http://unknown-domain.test/api/shop-domain')
            ->assertNotFound()
            ->assertJsonPath('code', 'PUBLIC_SITE_UNAVAILABLE');
    }

    public function test_active_custom_domain_is_disabled_when_dns_proof_disappears_and_can_be_reverified(): void
    {
        $request = $this->asActor();
        $request->patchJson('/api/ecommerce/store?companyId=kora', [
            'name' => 'Boutique revalidation DNS',
            'slug' => 'dns-revalidation-test',
            'description' => 'Boutique de test de propriété DNS.',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primaryColor' => '#D69E2E',
            'accentColor' => '#172033',
        ])->assertOk();

        $domain = 'dns-revalidation.kora.test';
        $token = 'dns-revalidation-token';
        DB::table('ecommerce_domains')->insert([
            'id' => 'domain-dns-revalidation',
            'company_id' => 'kora',
            'domain' => $domain,
            'target_host' => 'maximus.test',
            'verification_token' => $token,
            'status' => 'ACTIVE',
            'last_error' => '',
            'verified_at' => now()->subHour(),
            'created_at' => now()->subHour(),
            'updated_at' => now()->subHour(),
        ]);

        app()->instance(
            EcommerceDomainVerifier::class,
            new EcommerceDomainVerifier(static fn (string $name, int $type): array => []),
        );

        $this->getJson('http://'.$domain.'/api/shop-domain')
            ->assertNotFound()
            ->assertJsonPath('code', 'PUBLIC_SITE_UNAVAILABLE');
        $this->assertDatabaseHas('ecommerce_domains', [
            'id' => 'domain-dns-revalidation',
            'status' => 'PENDING',
        ]);

        app()->instance(
            EcommerceDomainVerifier::class,
            new EcommerceDomainVerifier(
                static function (string $name, int $type) use ($domain, $token): array {
                    return $type === DNS_TXT && $name === '_maximus-verification.'.$domain
                        ? [['txt' => $token]]
                        : [];
                },
            ),
        );

        $request->postJson('/api/ecommerce/domains/domain-dns-revalidation/verify?companyId=kora')
            ->assertOk()
            ->assertJsonPath('status', 'ACTIVE');

        $this->getJson('http://'.$domain.'/api/shop-domain')
            ->assertOk()
            ->assertJsonPath('store.slug', 'dns-revalidation-test');
    }

    public function test_public_manifests_have_an_isolated_pwa_start_path_per_store(): void
    {
        DB::table('ecommerce_stores')->insert([
            'id' => 'ecommerce-store-kora-manifest',
            'company_id' => 'kora',
            'slug' => 'kora-boutique',
            'name' => 'Boutique Kora',
            'description' => '',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primary_color' => '#123456',
            'accent_color' => '#654321',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('ecommerce_stores')->insert([
            'id' => 'ecommerce-store-other',
            'company_id' => 'other-company',
            'slug' => 'autre-boutique',
            'name' => 'Autre boutique',
            'description' => '',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primary_color' => '#123456',
            'accent_color' => '#654321',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $first = $this->getJson('/api/shop/kora-boutique/manifest.webmanifest')
            ->assertOk()
            ->json();
        $second = $this->getJson('/api/shop/autre-boutique/manifest.webmanifest')
            ->assertOk()
            ->json();

        $this->assertSame('/client-app/shop/kora-boutique/', $first['id']);
        $this->assertSame('/client-app/shop/kora-boutique/accueil', $first['start_url']);
        $this->assertSame($first['id'], $first['scope']);
        $this->assertSame('/client-app/shop/autre-boutique/', $second['id']);
        $this->assertSame('/client-app/shop/autre-boutique/accueil', $second['start_url']);
        $this->assertNotSame($first['id'], $second['id']);
    }

    public function test_sale_and_rental_products_keep_an_explicit_public_distinction(): void
    {
        $request = $this->asActor();
        $request->patchJson('/api/ecommerce/store?companyId=kora', [
            'name' => 'Boutique types',
            'slug' => 'boutique-types',
            'description' => 'Ventes et locations',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primaryColor' => '#D69E2E',
            'accentColor' => '#172033',
        ])->assertOk();

        $sale = $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Sac à vendre',
            'sku' => 'SALE-01',
            'price' => 5000,
            'stock' => 3,
            'status' => 'PUBLISHED',
            'productType' => 'SALE',
        ])->assertCreated()->assertJsonPath('productType', 'SALE')->json();
        $rental = $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Tente à louer',
            'sku' => 'RENTAL-01',
            'price' => 15000,
            'stock' => 2,
            'category' => 'Événement',
            'status' => 'PUBLISHED',
            'productType' => 'RENTAL',
            'rentalPeriod' => 'JOUR',
        ])->assertCreated()->assertJsonPath('productType', 'RENTAL')->assertJsonPath('rentalPeriod', 'JOUR')->json();

        $this->assertDatabaseHas('ecommerce_products', ['id' => $sale['id'], 'product_type' => 'SALE', 'rental_period' => null]);
        $this->assertDatabaseHas('ecommerce_products', ['id' => $rental['id'], 'product_type' => 'RENTAL', 'rental_period' => 'JOUR']);
        $this->getJson('/api/shop/boutique-types')
            ->assertOk()
            ->assertJsonPath('products.0.slug', $sale['slug'])
            ->assertJsonMissingPath('products.1')
            ->assertJsonFragment(['name' => 'Tente à louer', 'category' => 'Événement', 'billingUnit' => 'JOUR'])
            ->assertJsonFragment(['slug' => $sale['slug'], 'productType' => 'SALE', 'rentalPeriod' => null]);
    }

    public function test_delivery_requests_are_scoped_and_status_can_be_managed_by_the_company(): void
    {
        $request = $this->asActor();
        $request->patchJson('/api/ecommerce/store?companyId=kora', [
            'name' => 'Boutique livraison',
            'slug' => 'boutique-livraison',
            'description' => 'Services de livraison',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primaryColor' => '#D69E2E',
            'accentColor' => '#172033',
        ])->assertOk();

        $created = $this->postJson('/api/shop/boutique-livraison/delivery-requests', [
            'requesterName' => 'Client Livraison',
            'requesterEmail' => 'livraison@example.test',
            'requesterPhone' => '770000000',
            'address' => 'Dakar, Sénégal',
            'serviceType' => 'STANDARD',
            'desiredDate' => now()->addDay()->toDateString(),
            'note' => 'Appeler avant de passer',
        ])->assertCreated()
            ->assertJsonPath('status', 'DEMANDEE')
            ->assertJsonPath('serviceType', 'STANDARD');

        $requestId = $created->json('id');
        $this->assertDatabaseHas('ecommerce_delivery_requests', [
            'id' => $requestId,
            'company_id' => 'kora',
            'requester_email' => 'livraison@example.test',
        ]);

        DB::table('ecommerce_delivery_requests')->insert([
            'id' => 'delivery-other-company',
            'company_id' => 'other-company',
            'reference' => 'LIV-OTHER',
            'requester_name' => 'Autre entreprise',
            'requester_email' => 'other@example.test',
            'requester_phone' => '',
            'address' => 'Autre adresse',
            'service_type' => 'STANDARD',
            'desired_date' => null,
            'note' => '',
            'status' => 'DEMANDEE',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $request->getJson('/api/ecommerce/bootstrap?companyId=kora')
            ->assertOk()
            ->assertJsonPath('deliveryRequests.0.id', $requestId)
            ->assertJsonMissing(['reference' => 'LIV-OTHER']);
        $request->patchJson('/api/ecommerce/delivery-requests/'.$requestId.'/status?companyId=kora', ['status' => 'CONFIRMEE'])
            ->assertOk()
            ->assertJsonPath('status', 'CONFIRMEE');
        $this->assertDatabaseHas('ecommerce_delivery_requests', ['id' => $requestId, 'status' => 'CONFIRMEE']);
    }

    public function test_company_can_manage_delivery_zones_and_public_requests_use_an_active_zone(): void
    {
        $request = $this->asActor();
        $request->patchJson('/api/ecommerce/store?companyId=kora', [
            'name' => 'Boutique zones',
            'slug' => 'boutique-zones',
            'description' => 'Livraison par secteur',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primaryColor' => '#D69E2E',
            'accentColor' => '#172033',
        ])->assertOk();

        $zone = $request->postJson('/api/ecommerce/delivery-zones?companyId=kora', [
            'name' => 'Dakar centre',
            'description' => 'Plateau, Médina et alentours',
            'fee' => 1500,
            'estimatedMinutes' => 90,
            'isActive' => true,
            'sortOrder' => 1,
        ])->assertCreated()
            ->assertJsonPath('name', 'Dakar centre')
            ->assertJsonPath('fee', 1500)
            ->json();

        $zoneId = $zone['id'];
        $request->getJson('/api/ecommerce/bootstrap?companyId=kora')
            ->assertOk()
            ->assertJsonPath('deliveryZones.0.id', $zoneId);
        $this->getJson('/api/shop/boutique-zones')
            ->assertOk()
            ->assertJsonPath('deliveryZones.0.name', 'Dakar centre')
            ->assertJsonPath('deliveryZones.0.fee', 1500);

        $product = $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Produit livré par zone',
            'sku' => 'ZONE-DELIVERY-01',
            'category' => 'Épicerie',
            'price' => 5000,
            'stock' => 2,
            'status' => 'PUBLISHED',
        ])->assertCreated()->json();
        $this->postJson('/api/shop/boutique-zones/orders', [
            'customerName' => 'Client Zone',
            'customerEmail' => 'order-zone@example.test',
            'shippingAddress' => 'Plateau, Dakar',
            'items' => [['productSlug' => $product['slug'], 'quantity' => 1]],
        ])->assertStatus(400)
            ->assertJsonPath('error', 'Veuillez sélectionner une zone de livraison.');
        $this->postJson('/api/shop/boutique-zones/orders', [
            'customerName' => 'Client Zone',
            'customerEmail' => 'order-zone@example.test',
            'shippingAddress' => 'Plateau, Dakar',
            'deliveryZoneId' => $zoneId,
            'items' => [['productSlug' => $product['slug'], 'quantity' => 1]],
        ])->assertCreated()
            ->assertJsonPath('total', 6500)
            ->assertJsonPath('deliveryZoneId', $zoneId)
            ->assertJsonPath('deliveryZoneName', 'Dakar centre')
            ->assertJsonPath('deliveryZoneFee', 1500);
        $this->assertDatabaseHas('ecommerce_orders', [
            'delivery_zone_id' => $zoneId,
            'delivery_zone_name' => 'Dakar centre',
            'delivery_zone_fee' => 1500,
            'total' => 6500,
        ]);

        $this->postJson('/api/shop/boutique-zones/delivery-requests', [
            'requesterName' => 'Client Zone',
            'requesterEmail' => 'zone@example.test',
            'address' => 'Plateau, Dakar',
            'serviceType' => 'STANDARD',
        ])->assertStatus(422);

        $created = $this->postJson('/api/shop/boutique-zones/delivery-requests', [
            'requesterName' => 'Client Zone',
            'requesterEmail' => 'zone@example.test',
            'address' => 'Plateau, Dakar',
            'deliveryZoneId' => $zoneId,
            'serviceType' => 'STANDARD',
        ])->assertCreated()
            ->assertJsonPath('deliveryZoneId', $zoneId)
            ->assertJsonPath('deliveryZoneName', 'Dakar centre')
            ->assertJsonPath('deliveryZoneFee', 1500);

        $this->assertDatabaseHas('ecommerce_delivery_requests', [
            'id' => $created->json('id'),
            'delivery_zone_id' => $zoneId,
            'delivery_zone_name' => 'Dakar centre',
            'delivery_zone_fee' => 1500,
        ]);

        $request->patchJson('/api/ecommerce/delivery-zones/'.$zoneId.'?companyId=kora', [
            'isActive' => false,
        ])->assertOk()->assertJsonPath('isActive', false);
        $this->getJson('/api/shop/boutique-zones')
            ->assertOk()
            ->assertJsonCount(0, 'deliveryZones');
        $this->postJson('/api/shop/boutique-zones/delivery-requests', [
            'requesterName' => 'Client Zone',
            'requesterEmail' => 'zone-2@example.test',
            'address' => 'Plateau, Dakar',
            'deliveryZoneId' => $zoneId,
            'serviceType' => 'STANDARD',
        ])->assertStatus(422);
    }

    public function test_public_delivery_service_is_hidden_and_blocked_without_the_company_feature(): void
    {
        DB::table('maximus_company_modules')
            ->where('company_id', 'kora')
            ->where('module_id', 'ecommerce')
            ->update(['feature_ids' => json_encode(['location'])]);
        $request = $this->asActor();
        $request->patchJson('/api/ecommerce/store?companyId=kora', [
            'name' => 'Boutique sans livraison',
            'slug' => 'boutique-sans-livraison',
            'description' => 'Boutique',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primaryColor' => '#D69E2E',
            'accentColor' => '#172033',
        ])->assertOk();

        $this->getJson('/api/shop/boutique-sans-livraison')
            ->assertOk()
            ->assertJsonPath('store.enabledFeatures.livraisons', false)
            ->assertJsonPath('store.enabledFeatures.location', true);
        $this->postJson('/api/shop/boutique-sans-livraison/delivery-requests', [
            'requesterName' => 'Client',
            'requesterEmail' => 'client@example.test',
            'address' => 'Dakar',
            'serviceType' => 'STANDARD',
        ])->assertForbidden();
    }

    public function test_public_shop_exposes_transport_when_the_transport_feature_is_active(): void
    {
        DB::table('maximus_company_modules')->updateOrInsert(
            ['company_id' => 'kora', 'module_id' => 'transport'],
            [
                'id' => 'company-module-kora-transport',
                'status' => 'ACTIF',
                'feature_ids' => json_encode(['overview', 'trips', 'drivers', 'vehicles']),
                'configuration' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );

        $this->asActor()
            ->patchJson('/api/ecommerce/store?companyId=kora', [
                'name' => 'Boutique Transport',
                'slug' => 'boutique-transport',
                'description' => 'Boutique Taxi',
                'status' => 'PUBLISHED',
                'currency' => 'XOF',
                'primaryColor' => '#D69E2E',
                'accentColor' => '#172033',
            ])
            ->assertOk();

        $this->getJson('/api/shop/boutique-transport')
            ->assertOk()
            ->assertJsonPath('store.enabledFeatures.transport', true);
    }

    public function test_rentals_are_autonomous_persistent_and_exposed_only_when_published(): void
    {
        $request = $this->asActor();
        $request->patchJson('/api/ecommerce/store?companyId=kora', [
            'name' => 'Boutique locations',
            'slug' => 'boutique-locations',
            'description' => 'Locations autonomes',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primaryColor' => '#D69E2E',
            'accentColor' => '#172033',
        ])->assertOk();

        $product = $request->postJson('/api/ecommerce/products?companyId=kora', [
            'name' => 'Maison catalogue',
            'sku' => 'SALE-RENTAL-BOUNDARY',
            'price' => 1000,
            'stock' => 1,
            'status' => 'PUBLISHED',
        ])->assertCreated();
        $rental = $request->postJson('/api/ecommerce/rentals?companyId=kora', [
            'name' => 'Maison autonome',
            'description' => 'Une offre indépendante.',
            'category' => 'Habitat',
            'price' => 25000,
            'billingUnit' => 'SEMAINE',
            'availability' => 2,
            'status' => 'PUBLISHED',
        ])->assertCreated()
            ->assertJsonPath('isAvailable', true)
            ->assertJsonPath('billingUnit', 'SEMAINE')
            ->json();
        $draft = $request->postJson('/api/ecommerce/rentals?companyId=kora', [
            'name' => 'Brouillon privé',
            'price' => 3000,
            'billingUnit' => 'JOUR',
            'availability' => 1,
            'status' => 'DRAFT',
        ])->assertCreated()->json();

        $request->patchJson('/api/ecommerce/rentals/'.$rental['id'].'?companyId=kora', [
            'description' => 'Description modifiée.',
            'price' => 27000,
        ])->assertOk()->assertJsonPath('price', 27000);
        $request->patchJson('/api/ecommerce/rentals/'.$rental['id'].'/availability?companyId=kora', [
            'availability' => 0,
        ])->assertOk()->assertJsonPath('isAvailable', false);

        $request->getJson('/api/ecommerce/bootstrap?companyId=kora')
            ->assertOk()
            ->assertJsonFragment(['id' => $rental['id'], 'name' => 'Maison autonome', 'availability' => 0])
            ->assertJsonFragment(['id' => $draft['id'], 'status' => 'DRAFT']);
        $this->assertDatabaseHas('ecommerce_rentals', [
            'id' => $rental['id'],
            'company_id' => 'kora',
            'price' => 27000,
            'availability' => 0,
        ]);

        $this->getJson('/api/shop/boutique-locations')
            ->assertOk()
            ->assertJsonCount(1, 'rentals')
            ->assertJsonPath('rentals.0.name', 'Maison autonome')
            ->assertJsonPath('rentals.0.availability', 0)
            ->assertJsonPath('rentals.0.id', $rental['id'])
            ->assertJsonMissingPath('rentals.0.companyId');
    }

    public function test_rentals_are_isolated_by_company_and_archiving_hides_them_publicly(): void
    {
        $request = $this->asActor();
        $rental = $request->postJson('/api/ecommerce/rentals?companyId=kora', [
            'name' => 'Location KORA',
            'price' => 5000,
            'billingUnit' => 'JOUR',
            'availability' => 4,
            'status' => 'PUBLISHED',
        ])->assertCreated()->json();

        DB::table('ecommerce_rentals')->insert([
            'id' => 'rental-other-company',
            'company_id' => 'other-company',
            'name' => 'Location autre entreprise',
            'description' => '',
            'category' => 'Général',
            'price' => 9000,
            'billing_unit' => 'JOUR',
            'availability' => 3,
            'status' => 'PUBLISHED',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $request->patchJson('/api/ecommerce/rentals/rental-other-company?companyId=kora', ['price' => 1])
            ->assertNotFound();
        $request->getJson('/api/ecommerce/bootstrap?companyId=kora')
            ->assertOk()
            ->assertJsonFragment(['id' => $rental['id'], 'name' => 'Location KORA'])
            ->assertJsonMissing(['id' => 'rental-other-company']);

        $request->deleteJson('/api/ecommerce/rentals/'.$rental['id'].'?companyId=kora')
            ->assertOk()
            ->assertJsonPath('status', 'ARCHIVED');
        $this->assertDatabaseHas('ecommerce_rentals', ['id' => $rental['id'], 'status' => 'ARCHIVED']);
    }

    private function asActor(string $role = 'company_admin', array $permissions = []): self
    {
        $user = AuthUser::query()->create([
            'id' => 'ecommerce-'.strtolower($role),
            'email' => 'ecommerce-'.strtolower($role).'@kora.demo',
            'password_hash' => 'not-used-in-this-test',
            'display_name' => 'Gestionnaire E-commerce',
            'role' => $role,
            'company_id' => 'kora',
            'employee_id' => $role === 'employee' ? 'ecommerce-employee' : null,
            'sector_ids' => [],
            'permissions' => $permissions,
            'status' => 'ACTIF',
        ]);

        return $this
            ->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, MaximusAuth::issueSession($user));
    }

    /**
     * @param array<int, string> $featureIds
     */
    private function setEcommerceFeatures(array $featureIds): void
    {
        DB::table('maximus_company_modules')->updateOrInsert(
            ['company_id' => 'kora', 'module_id' => 'ecommerce'],
            [
                'id' => 'company-module-kora-ecommerce',
                'status' => 'ACTIF',
                'feature_ids' => json_encode($featureIds),
                'configuration' => json_encode(['featureScope' => 'explicit']),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );
    }

    /**
     * @param array<int, string> $featureIds
     */
    private function setImmobilierFeatures(array $featureIds): void
    {
        DB::table('maximus_company_modules')->updateOrInsert(
            ['company_id' => 'kora', 'module_id' => 'immobilier'],
            [
                'id' => 'company-module-kora-immobilier',
                'status' => 'ACTIF',
                'feature_ids' => json_encode($featureIds),
                'configuration' => json_encode(['featureScope' => 'explicit']),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );
    }
}