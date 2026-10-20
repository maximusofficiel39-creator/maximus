<?php

namespace Tests\Feature;

use App\Models\AuthUser;
use App\Support\MaximusAuth;
use App\Support\ModuleAuthorization;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class StockTest extends TestCase
{
    use RefreshDatabase;

    public function test_stock_core_bootstrap_omits_heavy_history_sections(): void
    {
        $this->asActor()
            ->getJson('/api/stock/bootstrap?scope=core')
            ->assertOk()
            ->assertJsonStructure(['products', 'categories', 'warehouses', 'locations', 'suppliers', 'balances'])
            ->assertJsonMissingPath('movements')
            ->assertJsonMissingPath('requests')
            ->assertJsonMissingPath('inventories')
            ->assertJsonMissingPath('inventoryLines');
    }

    public function test_stock_catalog_and_movements_preserve_the_json_contract(): void
    {
        $request = $this->asActor();
        $category = $request->postJson('/api/stock/categories', [
            'companyId' => 'kora',
            'name' => 'Épicerie',
        ])->assertCreated();
        $product = $request->postJson('/api/stock/products', [
            'companyId' => 'kora',
            'name' => 'Riz local',
            'category' => $category->json('name'),
            'sku' => 'KOR-RIZ-01',
        ])->assertCreated()
            ->assertJsonPath('sku', 'KOR-RIZ-01')
            ->assertJsonPath('category', 'Épicerie')
            ->assertJsonMissingPath('unit')
            ->assertJsonMissingPath('purchasePrice')
            ->assertJsonMissingPath('salePrice');

        $warehouse = $request->postJson('/api/stock/warehouses', [
            'companyId' => 'kora',
            'name' => 'Entrepôt principal',
        ])->assertCreated();

        $movement = [
            'companyId' => 'kora',
            'productId' => $product->json('id'),
            'warehouseId' => $warehouse->json('id'),
            'type' => 'ENTRÉE',
            'quantity' => 10,
            'userName' => 'Gestionnaire Stock',
            'reference' => '',
            'comment' => '',
        ];

        $request->postJson('/api/stock/movements', $movement)
            ->assertCreated()
            ->assertJsonPath('type', 'ENTRÉE')
            ->assertJsonPath('quantity', 10)
            ->assertJsonPath('reference', '')
            ->assertJsonPath('comment', '');

        $request->postJson('/api/stock/movements', array_merge($movement, [
            'type' => 'SORTIE',
            'quantity' => 11,
        ]))
            ->assertStatus(409)
            ->assertJsonPath('error', 'Stock insuffisant : le stock négatif est interdit.');

        $request->postJson('/api/stock/movements', array_merge($movement, [
            'type' => 'SORTIE',
            'quantity' => 3,
        ]))
            ->assertCreated()
            ->assertJsonPath('type', 'SORTIE')
            ->assertJsonPath('quantity', 3)
            ->assertJsonPath('reference', '')
            ->assertJsonPath('comment', '');

        $this->assertDatabaseHas('stock_balances', [
            'product_id' => $product->json('id'),
            'warehouse_id' => $warehouse->json('id'),
            'quantity' => 7,
        ]);
        $this->assertDatabaseCount('stock_audit_logs', 2);
        $this->assertDatabaseHas('stock_audit_logs', [
            'user_name' => 'Gestionnaire Stock',
        ]);
    }

    public function test_stock_product_image_upload_is_saved_and_served_from_the_company_scoped_route(): void
    {
        $request = $this->asActor();
        $category = $request->postJson('/api/stock/categories', [
            'companyId' => 'kora',
            'name' => 'Photos',
        ])->assertCreated();
        $product = $request->post('/api/stock/products', [
            'name' => 'Article avec photo',
            'category' => $category->json('name'),
            'sku' => 'PHOTO-001',
            'image' => UploadedFile::fake()->image('article.png', 24, 24),
        ], ['Accept' => 'application/json'])->assertCreated();

        $productId = $product->json('id');
        $imageUrl = '/api/stock/products/'.$productId.'/image';
        $product->assertJsonPath('imageUrl', $imageUrl);
        $this->assertNotEmpty(DB::table('stock_products')->where('id', $productId)->value('image_data'));
        $this->assertSame('image/png', DB::table('stock_products')->where('id', $productId)->value('image_mime'));

        $request->get($imageUrl)
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $request->post('/api/stock/products/'.$productId, [
            '_method' => 'PATCH',
            'brand' => 'Photo mise à jour',
            'image' => UploadedFile::fake()->image('article-modifie.png', 32, 32),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('brand', 'Photo mise à jour')
            ->assertJsonPath('imageUrl', $imageUrl);
        $this->assertNotEmpty(DB::table('stock_products')->where('id', $productId)->value('image_data'));
    }

    public function test_stock_categories_are_company_scoped_and_cannot_be_archived_while_in_use(): void
    {
        $request = $this->asActor();
        $category = $request->postJson('/api/stock/categories', [
            'companyId' => 'kora',
            'name' => 'Informatique',
        ])->assertCreated();

        $request->postJson('/api/stock/products', [
            'companyId' => 'kora',
            'name' => 'Ordinateur',
            'category' => 'Informatique',
            'sku' => 'INFO-001',
        ])->assertCreated();

        $request->deleteJson('/api/stock/categories/'.$category->json('id'), [
            'companyId' => 'kora',
        ])->assertStatus(409);

        $request->postJson('/api/stock/products', [
            'companyId' => 'kora',
            'name' => 'Mauvaise catégorie',
            'category' => 'Autre entreprise',
            'sku' => 'INFO-002',
        ])->assertUnprocessable();

        DB::table('stock_categories')->insert([
            'id' => 'category-other-company',
            'company_id' => 'another-company',
            'name' => 'Confidentiel',
            'archived' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $request->getJson('/api/stock/bootstrap?scope=core&companyId=kora')
            ->assertOk()
            ->assertJsonMissing(['name' => 'Confidentiel']);
        $request->deleteJson('/api/stock/categories/category-other-company?companyId=kora')
            ->assertNotFound();
    }

    public function test_stock_product_rejects_non_image_uploads(): void
    {
        $this->asActor()
            ->post('/api/stock/products', [
                'name' => 'Fichier interdit',
                'sku' => 'PHOTO-INVALID',
                'image' => UploadedFile::fake()->create('document.txt', 1, 'text/plain'),
            ], ['Accept' => 'application/json'])
            ->assertUnprocessable();

        $this->assertDatabaseMissing('stock_products', ['sku' => 'PHOTO-INVALID']);
    }

    public function test_stock_product_rejects_images_above_the_upload_limit(): void
    {
        $this->asActor()
            ->post('/api/stock/products', [
                'name' => 'Photo trop volumineuse',
                'sku' => 'PHOTO-TOO-LARGE',
                '_imageUploadExpected' => '1',
                'image' => UploadedFile::fake()->image('article.png', 24, 24)->size(1801),
            ], ['Accept' => 'application/json'])
            ->assertUnprocessable();

        $this->assertDatabaseMissing('stock_products', ['sku' => 'PHOTO-TOO-LARGE']);
    }

    public function test_inventory_validation_applies_only_the_difference(): void
    {
        $request = $this->asActor();
        DB::table('stock_products')->insert([
            'id' => 'product-1',
            'company_id' => 'kora',
            'name' => 'Café',
            'category' => 'Épicerie',
            'subcategory' => '',
            'brand' => '',
            'sku' => 'CAF-01',
            'barcode' => '',
            'image_url' => '',
            'unit' => 'sachet',
            'purchase_price' => 100,
            'sale_price' => 150,
            'min_stock' => 0,
            'max_stock' => 100,
            'supplier_id' => null,
            'description' => '',
            'archived' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('stock_warehouses')->insert([
            'id' => 'warehouse-1',
            'company_id' => 'kora',
            'name' => 'Principal',
            'manager' => '',
            'address' => '',
            'archived' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('stock_balances')->insert([
            'id' => 'balance-1',
            'company_id' => 'kora',
            'product_id' => 'product-1',
            'supplier_id' => null,
            'warehouse_id' => 'warehouse-1',
            'location_id' => null,
            'quantity' => 10,
            'updated_at' => now(),
        ]);

        $inventory = $request->postJson('/api/stock/inventories', [
            'companyId' => 'kora',
            'warehouseId' => 'warehouse-1',
            'notes' => 'Comptage du matin',
            'createdBy' => 'Gestionnaire Stock',
            'lines' => [['productId' => 'product-1', 'actualQuantity' => 12]],
        ])->assertCreated();

        $request->postJson('/api/stock/inventories/'.$inventory->json('id').'/validate', [
            'companyId' => 'kora',
        ])->assertOk()->assertJsonPath('status', 'VALIDÉ');

        $this->assertDatabaseHas('stock_balances', [
            'product_id' => 'product-1',
            'warehouse_id' => 'warehouse-1',
            'quantity' => 12,
        ]);
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => 'product-1',
            'type' => 'AJUSTEMENT+',
            'quantity' => 2,
        ]);
    }

    public function test_stock_rejects_a_company_different_from_the_actor(): void
    {
        $this->asActor()
            ->getJson('/api/stock/bootstrap?companyId=another-company')
            ->assertForbidden();
    }

    public function test_inventory_rejects_an_unknown_product_instead_of_silently_dropping_the_line(): void
    {
        $request = $this->asActor();
        DB::table('stock_warehouses')->insert([
            'id' => 'warehouse-invalid-line',
            'company_id' => 'kora',
            'name' => 'Entrepôt de test',
            'manager' => '',
            'address' => '',
            'archived' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $request->postJson('/api/stock/inventories', [
            'companyId' => 'kora',
            'warehouseId' => 'warehouse-invalid-line',
            'lines' => [['productId' => 'product-from-another-company', 'actualQuantity' => 4]],
        ])
            ->assertBadRequest()
            ->assertJsonPath('error', 'PRODUCT_NOT_FOUND');

        $this->assertDatabaseCount('stock_inventories', 0);
        $this->assertDatabaseCount('stock_inventory_lines', 0);
    }

    public function test_stock_request_requires_company_owned_active_references(): void
    {
        $this->asActor()
            ->postJson('/api/stock/requests', [
                'companyId' => 'kora',
                'productId' => 'product-from-another-company',
                'warehouseId' => 'warehouse-from-another-company',
                'quantity' => 1,
                'reason' => 'Référence invalide',
            ])
            ->assertNotFound();

        $this->assertDatabaseCount('stock_requests', 0);
    }

    public function test_stock_api_enforces_detailed_permissions_for_non_admin_accounts(): void
    {
        $request = $this->asActor('employee', ['stocks:products' => ['voir']]);

        $request->getJson('/api/stock/bootstrap?companyId=kora')
            ->assertOk();

        $request->postJson('/api/stock/products', [
            'companyId' => 'kora',
            'name' => 'Produit interdit',
            'sku' => 'FORBIDDEN-01',
        ])->assertForbidden();

        $this->assertDatabaseMissing('stock_products', ['sku' => 'FORBIDDEN-01']);
    }

    public function test_stock_feature_requires_the_permission_ladder_for_mutations(): void
    {
        $actor = fn (array $permissions): array => [
            'role' => 'employee',
            'companyId' => 'kora',
            'permissions' => ['stocks:products' => $permissions],
        ];

        $viewOnly = $actor(['voir']);
        $this->assertTrue(ModuleAuthorization::allows($viewOnly, 'stocks', 'view', 'products'));
        $this->assertFalse(ModuleAuthorization::allows($viewOnly, 'stocks', 'create', 'products'));
        $this->assertFalse(ModuleAuthorization::allows($viewOnly, 'stocks', 'modify', 'products'));
        $this->assertFalse(ModuleAuthorization::allows($viewOnly, 'stocks', 'delete', 'products'));

        $viewAndCreate = $actor(['voir', 'créer']);
        $this->assertTrue(ModuleAuthorization::allows($viewAndCreate, 'stocks', 'create', 'products'));
        $this->assertFalse(ModuleAuthorization::allows($viewAndCreate, 'stocks', 'modify', 'products'));

        $modifyWithoutCreate = $actor(['voir', 'modifier']);
        $this->assertFalse(ModuleAuthorization::allows($modifyWithoutCreate, 'stocks', 'modify', 'products'));

        $fullAccess = $actor(['voir', 'créer', 'modifier']);
        $this->assertTrue(ModuleAuthorization::allows($fullAccess, 'stocks', 'modify', 'products'));
        $this->assertTrue(ModuleAuthorization::allows($fullAccess, 'stocks', 'delete', 'products'));
    }

    private function asActor(string $role = 'company_admin', array $permissions = []): self
    {
        $user = AuthUser::query()->create([
            'id' => 'stock-admin',
            'email' => 'stock-admin@kora.demo',
            'password_hash' => 'not-used-in-this-test',
            'display_name' => 'Gestionnaire Stock',
            'role' => $role,
            'company_id' => 'kora',
            'employee_id' => $role === 'employee' ? 'stock-employee' : null,
            'sector_ids' => [],
            'permissions' => $permissions,
            'status' => 'ACTIF',
        ]);
        $token = MaximusAuth::issueSession($user);

        return $this
            ->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $token);
    }
}
