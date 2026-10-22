<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\EcommerceCustomerAuth;
use App\Support\CompanyRegistry;
use App\Support\ModuleAuthorization;
use App\Support\ModuleCatalog;
use App\Services\EcommerceDomainVerifier;
use App\Services\AppNotificationService;
use App\Services\PublicSiteDomainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Throwable;

class EcommerceController extends Controller
{
    public function __construct(
        private readonly EcommerceDomainVerifier $domainVerifier,
        private readonly PublicSiteDomainService $publicSiteDomains,
        private readonly AppNotificationService $appNotifications,
    ) {
    }

    private const STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
    private const MANUAL_ORDER_NOTE_MARKER = '[MAXIMUS-MANUAL-ORDER]';
    private const ORDER_STATUSES = ['NOUVELLE', 'CONFIRMÉE', 'EN PRÉPARATION', 'EXPÉDIÉE', 'LIVRÉE', 'ANNULÉE'];
    private const PRODUCT_TYPES = ['SALE', 'RENTAL'];
    private const RENTAL_PERIODS = ['JOUR', 'SEMAINE', 'MOIS'];
    private const FULFILLMENT_TYPES = ['PHYSICAL', 'DIGITAL'];
    private const RENTAL_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
    private const DELIVERY_REQUEST_STATUSES = ['DEMANDEE', 'CONFIRMEE', 'EN_COURS', 'LIVREE', 'ANNULEE'];
    private const ORDER_TRANSITIONS = [
        'NOUVELLE' => ['NOUVELLE', 'CONFIRMÉE', 'ANNULÉE'],
        'CONFIRMÉE' => ['CONFIRMÉE', 'EN PRÉPARATION', 'ANNULÉE'],
        'EN PRÉPARATION' => ['EN PRÉPARATION', 'EXPÉDIÉE', 'ANNULÉE'],
        'EXPÉDIÉE' => ['EXPÉDIÉE', 'LIVRÉE'],
        'LIVRÉE' => ['LIVRÉE'],
        'ANNULÉE' => ['ANNULÉE'],
    ];

    public function bootstrap(Request $request): JsonResponse
    {
        if (! $this->allowed($request, 'view')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $store = $this->ensureStore($company);

        return response()->json([
            'store' => $this->store($store),
            'domains' => $this->domains($company),
            'categories' => $this->categories($company),
            'products' => DB::table('ecommerce_products')
                ->where('company_id', $company)
                ->where('status', '!=', 'ARCHIVED')
                ->orderByDesc('featured')
                ->orderBy('name')
                ->get()
                ->map(fn ($row) => $this->product($row))
                ->values(),
            'rentals' => $this->listRentals($company, true),
            'orders' => $this->orders($company),
            'revenueSummary' => $this->revenueSummary($company),
            'deliveryZones' => $this->listDeliveryZones($company),
            'deliveryRequests' => $this->listDeliveryRequests($company),
        ]);
    }

    public function updateStore(Request $request): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'parametres')) {
            return $this->forbidden();
        }

        $input = Validator::make($request->all(), [
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:120'],
            'slug' => ['sometimes', 'required', 'string', 'min:3', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'status' => ['sometimes', 'in:DRAFT,PUBLISHED,SUSPENDED'],
            'currency' => ['sometimes', 'in:XOF,EUR,USD'],
            'primaryColor' => ['sometimes', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'accentColor' => ['sometimes', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'logoUrl' => ['sometimes', 'nullable', 'string', 'max:500'],
            'allowOrderAttachments' => ['sometimes', 'boolean'],
        ])->validate();
        if ($request->attributes->get('demoMode') === true
            && ($input['status'] ?? null) === 'PUBLISHED') {
            return response()->json([
                'error' => 'Une boutique de démonstration ne peut pas être publiée sur le site public.',
                'code' => 'DEMO_STORE_PUBLISH_BLOCKED',
            ], 403);
        }
        $company = $this->company($request);
        $row = $this->ensureStore($company);
        $storeValues = [
            'slug' => array_key_exists('slug', $input)
                ? $this->uniqueStoreSlug($input['slug'], (string) $row->id)
                : (string) $row->slug,
            'name' => (string) ($input['name'] ?? $row->name),
            'description' => (string) ($input['description'] ?? $row->description ?? ''),
            'status' => (string) ($input['status'] ?? $row->status),
            'currency' => (string) ($input['currency'] ?? $row->currency ?? 'XOF'),
            'primary_color' => (string) ($input['primaryColor'] ?? $row->primary_color ?? '#D69E2E'),
            'accent_color' => (string) ($input['accentColor'] ?? $row->accent_color ?? '#172033'),
            'logo_url' => array_key_exists('logoUrl', $input) ? ($input['logoUrl'] ?? '') : ($row->logo_url ?? ''),
            'allow_order_attachments' => (bool) ($input['allowOrderAttachments'] ?? $row->allow_order_attachments ?? false),
            'updated_at' => now(),
        ];
        if (DB::table('ecommerce_stores')->where('id', $row->id)->where('company_id', $company)->exists()) {
            DB::table('ecommerce_stores')->where('id', $row->id)->where('company_id', $company)->update($storeValues);
        } else {
            DB::table('ecommerce_stores')->insert(array_merge([
                'id' => $row->id,
                'company_id' => $company,
                'created_at' => now(),
            ], $storeValues));
        }

        return response()->json($this->store(
            DB::table('ecommerce_stores')
                ->where('id', $row->id)
                ->where('company_id', $company)
                ->first(),
        ));
    }

    public function uploadStoreLogo(Request $request): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'parametres')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $store = $this->ensureStore($company);
        $input = Validator::make($request->all(), [
            'image' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ])->validate();

        $contents = $input['image']->get();
        if (! is_string($contents) || $contents === '') {
            return response()->json(['error' => 'Le logo n’a pas pu être lu après son envoi.'], 500);
        }

        $extension = strtolower($input['image']->getClientOriginalExtension() ?: 'bin');
        $filename = Str::uuid()->toString().'.'.$extension;
        $logoUrl = '/api/store-logos/'.rawurlencode($company).'/'.rawurlencode($filename);
        $logoValues = [
            'logo_url' => $logoUrl,
            'logo_data' => base64_encode($contents),
            'logo_mime' => $input['image']->getMimeType() ?: 'application/octet-stream',
            'updated_at' => now(),
        ];
        if (DB::table('ecommerce_stores')->where('id', $store->id)->exists()) {
            DB::table('ecommerce_stores')->where('id', $store->id)->update($logoValues);
        } else {
            DB::table('ecommerce_stores')->insert(array_merge([
                'id' => $store->id,
                'company_id' => $store->company_id,
                'slug' => $store->slug,
                'name' => $store->name,
                'description' => $store->description,
                'status' => $store->status,
                'currency' => $store->currency,
                'primary_color' => $store->primary_color,
                'accent_color' => $store->accent_color,
                'created_at' => now(),
            ], $logoValues));
        }
        $this->deleteStoredImage($store->logo_url ?? '', $logoUrl);

        return response()->json($this->store(DB::table('ecommerce_stores')->where('id', $store->id)->first()));
    }

    public function uploadStoreHeroImages(Request $request): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'parametres')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $store = $this->ensureStore($company);
        $this->storeGalleryImages($request, $company, 'store', (string) $store->id, 'hero', 12, 10240);

        return response()->json($this->store(DB::table('ecommerce_stores')->where('id', $store->id)->where('company_id', $company)->first()));
    }

    public function deleteStoreHeroImage(Request $request, string $imageId): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'parametres')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $store = $this->ensureStore($company);
        $deleted = $this->deleteGalleryImage($company, $imageId, 'store', (string) $store->id, 'hero');
        if (! $deleted) {
            return response()->json(['error' => 'Image de bannière introuvable.'], 404);
        }

        return response()->json($this->store(DB::table('ecommerce_stores')->where('id', $store->id)->where('company_id', $company)->first()));
    }

    public function createCategory(Request $request): JsonResponse
    {
        if (! $this->allowed($request, 'create', 'catalogue')) {
            return $this->forbidden();
        }

        $input = Validator::make($request->all(), [
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'slug' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:300'],
            'isActive' => ['sometimes', 'boolean'],
            'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:100000'],
        ])->validate();
        $company = $this->company($request);
        $slug = $this->uniqueCategorySlug((string) ($input['slug'] ?? ''), (string) $input['name'], $company);

        $row = [
            'id' => $this->id('category'),
            'company_id' => $company,
            'name' => trim($input['name']),
            'slug' => $slug,
            'description' => trim((string) ($input['description'] ?? '')),
            'is_active' => (bool) ($input['isActive'] ?? true),
            'sort_order' => (int) ($input['sortOrder'] ?? 0),
            'created_at' => now(),
            'updated_at' => now(),
        ];
        DB::table('ecommerce_categories')->insert($row);

        return response()->json($this->category((object) $row), 201);
    }

    public function updateCategory(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'catalogue')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $existing = DB::table('ecommerce_categories')->where('id', $id)->where('company_id', $company)->first();
        if (! $existing) {
            return response()->json(['error' => 'Catégorie introuvable.'], 404);
        }
        $input = Validator::make($request->all(), [
            'name' => ['sometimes', 'string', 'min:2', 'max:80'],
            'slug' => ['sometimes', 'nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:300'],
            'isActive' => ['sometimes', 'boolean'],
            'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:100000'],
        ])->validate();
        $slug = array_key_exists('slug', $input)
            ? $this->uniqueCategorySlug((string) ($input['slug'] ?? ''), (string) ($input['name'] ?? $existing->name), $company, $id)
            : $existing->slug;
        $changes = [];
        if (array_key_exists('name', $input)) $changes['name'] = trim($input['name']);
        if (array_key_exists('slug', $input)) $changes['slug'] = $slug;
        if (array_key_exists('description', $input)) $changes['description'] = trim((string) ($input['description'] ?? ''));
        if (array_key_exists('isActive', $input)) $changes['is_active'] = (bool) $input['isActive'];
        if (array_key_exists('sortOrder', $input)) $changes['sort_order'] = (int) $input['sortOrder'];
        $changes['updated_at'] = now();
        DB::table('ecommerce_categories')->where('id', $id)->update($changes);

        return response()->json($this->category(DB::table('ecommerce_categories')->where('id', $id)->first()));
    }

    public function deleteCategory(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'delete', 'catalogue')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $category = DB::table('ecommerce_categories')->where('id', $id)->where('company_id', $company)->first();
        if (! $category) {
            return response()->json(['error' => 'Catégorie introuvable.'], 404);
        }
        DB::table('ecommerce_products')->where('category_id', $id)->update([
            'category_id' => null,
            'category' => 'Général',
            'updated_at' => now(),
        ]);
        DB::table('ecommerce_categories')->where('id', $id)->delete();

        return response()->json(['ok' => true]);
    }

    public function createDomain(Request $request): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'parametres')) {
            return $this->forbidden();
        }

        $input = Validator::make($request->all(), [
            'domain' => ['required', 'string', 'max:253'],
        ])->validate();
        $domain = $this->publicSiteDomains->normalize($input['domain']);
        if (! $domain) {
            return response()->json(['error' => 'Saisissez un nom de domaine valide, sans http:// ni chemin.'], 422);
        }

        $company = $this->company($request);
        if ($this->publicSiteDomains->exists($domain)) {
            return response()->json(['error' => 'Ce domaine est déjà rattaché à une boutique.'], 422);
        }

        return response()->json($this->publicSiteDomains->create($request, $company, $domain), 201);
    }

    public function verifyDomain(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'parametres')) {
            return $this->forbidden();
        }

        $result = $this->publicSiteDomains->verify($this->company($request), $id);
        if (! $result) {
            return response()->json(['error' => 'Domaine introuvable.'], 404);
        }
        if (! $result['verified']) {
            return response()->json([
                'error' => 'Le domaine n’est pas encore vérifié. Ajoutez l’enregistrement DNS indiqué puis réessayez.',
                'domain' => $result['domain'],
            ], 422);
        }

        return response()->json($result['domain']);
    }

    public function deleteDomain(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'parametres')) {
            return $this->forbidden();
        }

        if (! $this->publicSiteDomains->archive($this->company($request), $id)) {
            return response()->json(['error' => 'Domaine introuvable.'], 404);
        }

        return response()->json(['ok' => true]);
    }

    public function createProduct(Request $request): JsonResponse
    {
        if (! $this->allowed($request, 'create', 'catalogue')) {
            return $this->forbidden();
        }

        $input = $this->productInput($request);
        $input = $this->normalizeProductType($input);
        if (! $this->allowsProductFulfillment($this->company($request), (string) ($input['fulfillmentType'] ?? 'PHYSICAL'))) {
            return $this->forbidden('Ce type de vente n’est pas autorisé pour cette entreprise.');
        }
        $input = $this->normalizeFulfillment($input);
        if (($input['fulfillmentType'] ?? 'PHYSICAL') === 'DIGITAL' && ($input['status'] ?? 'DRAFT') === 'PUBLISHED') {
            return response()->json(['error' => 'Joignez le fichier numérique avant de publier ce produit.'], 422);
        }
        if (array_key_exists('imageUrl', $input)) {
            $input['imageUrl'] = $input['imageUrl'] ?? '';
        }
        $company = $this->company($request);
        $input = $this->normalizeProductCategory($input, $company);
        $input = $this->requireProductCategory($input);
        $input['slug'] = $this->uniqueProductSlug(
            (string) ($input['slug'] ?? ''),
            (string) $input['name'],
            (string) $input['sku'],
            $company,
        );
        if (DB::table('ecommerce_products')->where('company_id', $company)->where('sku', $input['sku'])->exists()) {
            return response()->json(['error' => 'Ce SKU existe déjà dans cette boutique.'], 422);
        }

        $row = array_merge([
            'description' => '',
            'category' => 'Général',
            'category_id' => null,
            'compare_at_price' => null,
            'image_url' => '',
            'featured' => false,
            'product_type' => 'SALE',
            'rental_period' => null,
            'fulfillment_type' => 'PHYSICAL',
            'digital_file_path' => null,
            'digital_file_name' => null,
            'digital_file_mime' => null,
            'digital_file_size' => null,
            'status' => 'DRAFT',
            'id' => $this->id('product'),
            'company_id' => $company,
            'created_at' => now(),
            'updated_at' => now(),
        ], $this->snake($input));
        DB::table('ecommerce_products')->insert($row);

        return response()->json($this->product((object) $row), 201);
    }

    public function updateProduct(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'catalogue')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $query = DB::table('ecommerce_products')->where('id', $id)->where('company_id', $company);
        $existing = $query->first();
        if (! $existing) {
            return response()->json(['error' => 'Produit e-commerce introuvable.'], 404);
        }
        $existingFulfillment = (string) ($existing->fulfillment_type ?? 'PHYSICAL');
        if (! $this->allowsProductFulfillment($company, $existingFulfillment)) {
            return $this->forbidden('Ce type de vente n’est pas autorisé pour cette entreprise.');
        }
        $input = $this->productInput($request, true);
        $input = $this->normalizeProductType($input, true);
        $input = $this->normalizeFulfillment($input, true, $existingFulfillment);
        if (array_key_exists('fulfillmentType', $input)
            && ! $this->allowsProductFulfillment($company, (string) $input['fulfillmentType'])) {
            return $this->forbidden('Ce type de vente n’est pas autorisé pour cette entreprise.');
        }
        $nextFulfillment = (string) ($input['fulfillmentType'] ?? $existingFulfillment);
        $nextStatus = (string) ($input['status'] ?? $existing->status);
        if ($nextFulfillment === 'DIGITAL' && $nextStatus === 'PUBLISHED' && empty($existing->digital_file_path)) {
            return response()->json(['error' => 'Joignez le fichier numérique avant de publier ce produit.'], 422);
        }
        if (array_key_exists('imageUrl', $input)) {
            $input['imageUrl'] = $input['imageUrl'] ?? '';
        }
        $input = $this->normalizeProductCategory($input, $company);
        $input = $this->requireProductCategory(
            $input,
            (string) ($existing->category ?? ''),
            (string) ($existing->product_type ?? 'SALE'),
        );
        if (array_key_exists('slug', $input)) {
            $input['slug'] = $this->uniqueProductSlug(
                (string) ($input['slug'] ?? ''),
                (string) ($input['name'] ?? $existing->name),
                (string) ($input['sku'] ?? $existing->sku),
                $company,
                $id,
            );
        }
        if (isset($input['sku']) && DB::table('ecommerce_products')->where('company_id', $company)->where('sku', $input['sku'])->where('id', '!=', $id)->exists()) {
            return response()->json(['error' => 'Ce SKU existe déjà dans cette boutique.'], 422);
        }
        $changes = $this->snake($input);
        $changes['updated_at'] = now();
        $query->update($changes);

        return response()->json($this->product(DB::table('ecommerce_products')->where('id', $id)->first()));
    }

    public function uploadProductImage(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'catalogue')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $product = DB::table('ecommerce_products')
            ->where('id', $id)
            ->where('company_id', $company)
            ->first();
        if (! $product) {
            return response()->json(['error' => 'Produit e-commerce introuvable.'], 404);
        }

        $input = Validator::make($request->all(), [
            'image' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ])->validate();
        $contents = $input['image']->get();
        if (! is_string($contents) || $contents === '') {
            return response()->json(['error' => 'La photo n’a pas pu être lue après son envoi.'], 500);
        }

        $extension = strtolower($input['image']->getClientOriginalExtension() ?: 'bin');
        $filename = Str::uuid()->toString().'.'.$extension;
        $imageUrl = '/api/product-images/'.rawurlencode($company).'/'.rawurlencode($filename);
        $this->preservePrimaryImageInGallery(
            $company,
            'product',
            $id,
            (string) ($product->image_url ?? ''),
            (string) ($product->image_data ?? ''),
            (string) ($product->image_mime ?? ''),
        );
        DB::table('ecommerce_products')->where('id', $id)->update([
            'image_url' => $imageUrl,
            'image_data' => base64_encode($contents),
            'image_mime' => $input['image']->getMimeType() ?: 'application/octet-stream',
            'updated_at' => now(),
        ]);
        $this->deleteStoredImage($product->image_url, $imageUrl);

        return response()->json($this->product(DB::table('ecommerce_products')->where('id', $id)->first()));
    }

    public function uploadProductGallery(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'catalogue')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $product = DB::table('ecommerce_products')->where('id', $id)->where('company_id', $company)->first();
        if (! $product) {
            return response()->json(['error' => 'Produit e-commerce introuvable.'], 404);
        }

        $this->storeGalleryImages($request, $company, 'product', $id, 'gallery', 20, 10240);

        return response()->json($this->product(DB::table('ecommerce_products')->where('id', $id)->first()));
    }

    public function deleteProductGalleryImage(Request $request, string $id, string $imageId): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'catalogue')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $product = DB::table('ecommerce_products')->where('id', $id)->where('company_id', $company)->first();
        if (! $product) {
            return response()->json(['error' => 'Produit e-commerce introuvable.'], 404);
        }
        if (! $this->deleteGalleryImage($company, $imageId, 'product', $id, 'gallery')) {
            return response()->json(['error' => 'Image du produit introuvable.'], 404);
        }

        return response()->json($this->product(DB::table('ecommerce_products')->where('id', $id)->first()));
    }

    public function uploadDigitalFile(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'catalogue')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $product = DB::table('ecommerce_products')
            ->where('id', $id)
            ->where('company_id', $company)
            ->first();
        if (! $product) {
            return response()->json(['error' => 'Produit e-commerce introuvable.'], 404);
        }
        if (($product->fulfillment_type ?? 'PHYSICAL') !== 'DIGITAL') {
            return response()->json(['error' => 'Seuls les produits numériques peuvent recevoir un fichier.'], 422);
        }
        if (! $this->allowsProductFulfillment($company, 'DIGITAL')) {
            return $this->forbidden('La vente numérique n’est pas autorisée pour cette entreprise.');
        }

        $input = Validator::make($request->all(), [
            'file' => [
                'required',
                'file',
                'mimes:mp4,mov,webm,avi,mkv,m4v,mp3,wav,ogg,m4a,aac,flac,pdf,doc,docx,ppt,pptx',
                'max:1048576',
            ],
        ])->validate();
        $file = $input['file'];
        $path = $file->store('company-'.$company.'/product-'.$id, 'digital');
        if (! is_string($path) || $path === '') {
            return response()->json(['error' => 'Le fichier numérique n’a pas pu être enregistré.'], 500);
        }
        $disk = Storage::disk('digital');
        if (! empty($product->digital_file_path) && $disk->exists($product->digital_file_path)) {
            $disk->delete($product->digital_file_path);
        }
        DB::table('ecommerce_products')->where('id', $id)->update([
            'digital_file_path' => $path,
            'digital_file_name' => $file->getClientOriginalName(),
            'digital_file_mime' => $file->getMimeType() ?: 'application/octet-stream',
            'digital_file_size' => (int) ($file->getSize() ?: 0),
            'status' => $product->status === 'DRAFT' ? 'PUBLISHED' : $product->status,
            'updated_at' => now(),
        ]);

        return response()->json($this->product(DB::table('ecommerce_products')->where('id', $id)->first()));
    }

    public function serveProductImage(string $company, string $filename)
    {
        if (! preg_match('/^[A-Za-z0-9_-]+$/', $company) || ! preg_match('/^[A-Za-z0-9_.-]+$/', $filename)) {
            abort(404);
        }

        $imageUrl = '/api/product-images/'.$company.'/'.$filename;
        $product = DB::table('ecommerce_products')
            ->where('company_id', $company)
            ->where('image_url', $imageUrl)
            ->first(['image_data', 'image_mime']);
        if ($product && is_string($product->image_data) && $product->image_data !== '') {
            $contents = base64_decode($product->image_data, true);
            if ($contents !== false) {
                return response($contents, 200, [
                    'Content-Type' => $product->image_mime ?: 'application/octet-stream',
                    'Cache-Control' => 'public, max-age=31536000, immutable',
                ]);
            }
        }

        $path = 'ecommerce/products/'.$company.'/'.$filename;
        if (! Storage::disk('public')->exists($path)) {
            abort(404);
        }

        return response()->file(Storage::disk('public')->path($path), [
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    public function serveStoreLogo(string $company, string $filename)
    {
        if (! preg_match('/^[A-Za-z0-9_-]+$/', $company) || ! preg_match('/^[A-Za-z0-9_.-]+$/', $filename)) {
            abort(404);
        }

        $logoUrl = '/api/store-logos/'.$company.'/'.$filename;
        $store = DB::table('ecommerce_stores')
            ->where('company_id', $company)
            ->where('logo_url', $logoUrl)
            ->first(['logo_data', 'logo_mime']);
        if ($store && is_string($store->logo_data) && $store->logo_data !== '') {
            $contents = base64_decode($store->logo_data, true);
            if ($contents !== false) {
                return response($contents, 200, [
                    'Content-Type' => $store->logo_mime ?: 'application/octet-stream',
                    'Cache-Control' => 'public, max-age=31536000, immutable',
                ]);
            }
        }

        $path = 'ecommerce/stores/'.$company.'/'.$filename;
        if (! Storage::disk('public')->exists($path)) {
            abort(404);
        }

        return response()->file(Storage::disk('public')->path($path), [
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    public function serveGalleryImage(string $company, string $imageId)
    {
        if (! preg_match('/^[A-Za-z0-9_-]+$/', $company) || ! preg_match('/^[A-Za-z0-9_-]+$/', $imageId)) {
            abort(404);
        }

        $image = DB::table('ecommerce_gallery_images')
            ->where('company_id', $company)
            ->where('id', $imageId)
            ->first(['image_data', 'image_mime']);
        if (! $image || ! is_string($image->image_data) || $image->image_data === '') {
            abort(404);
        }

        $contents = base64_decode($image->image_data, true);
        if ($contents === false) {
            abort(404);
        }

        return response($contents, 200, [
            'Content-Type' => $image->image_mime ?: 'application/octet-stream',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    public function archiveProduct(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'delete', 'catalogue')) {
            return $this->forbidden();
        }

        $row = DB::table('ecommerce_products')->where('id', $id)->where('company_id', $this->company($request))->first();
        if (! $row) {
            return response()->json(['error' => 'Produit e-commerce introuvable.'], 404);
        }
        DB::table('ecommerce_products')->where('id', $id)->update(['status' => 'ARCHIVED', 'updated_at' => now()]);

        return response()->json($this->product(DB::table('ecommerce_products')->where('id', $id)->first()));
    }

    public function createRental(Request $request): JsonResponse
    {
        if (! $this->allowed($request, 'create', 'location')) {
            return $this->forbidden();
        }

        $input = $this->rentalInput($request);
        if (($input['brand'] ?? null) !== null || ($input['model'] ?? null) !== null) {
            $input['billingUnit'] = 'JOUR';
        }
        $company = $this->company($request);
        $input = $this->normalizeRentalCategory($input, $company);
        $input = $this->requireRentalCategory($input);
        if (DB::table('ecommerce_rentals')->where('company_id', $company)->whereRaw('LOWER(name) = ?', [mb_strtolower(trim($input['name']))])->exists()) {
            return response()->json(['error' => 'Une location porte déjà ce nom dans cette boutique.'], 422);
        }

        $row = [
            'id' => $this->id('rental'),
            'company_id' => $company,
            'name' => trim($input['name']),
            'description' => trim((string) ($input['description'] ?? '')),
            'category' => trim((string) ($input['category'] ?? 'Général')) ?: 'Général',
            'category_id' => $input['categoryId'] ?? null,
            'image_url' => '',
            'image_data' => null,
            'image_mime' => null,
            'price' => (int) $input['price'],
            'billing_unit' => $input['billingUnit'],
            'availability' => (int) $input['availability'],
            'brand' => $input['brand'] ?? null,
            'model' => $input['model'] ?? null,
            'year' => $input['year'] ?? null,
            'seats' => $input['seats'] ?? null,
            'transmission' => $input['transmission'] ?? null,
            'fuel' => $input['fuel'] ?? null,
            'equipment' => isset($input['equipment']) ? json_encode($input['equipment']) : null,
            'gallery' => isset($input['gallery']) ? json_encode($input['gallery']) : null,
            'daily_rate' => (int) ($input['dailyRate'] ?? $input['price']),
            'km_rate' => (int) ($input['kmRate'] ?? 0),
            'deposit' => (int) ($input['deposit'] ?? 0),
            'fees' => (int) ($input['fees'] ?? 0),
            'conditions' => $input['conditions'] ?? null,
            'instructions' => $input['instructions'] ?? null,
            'unavailable_periods' => isset($input['unavailablePeriods']) ? json_encode($input['unavailablePeriods']) : null,
            'status' => $input['status'] ?? 'DRAFT',
            'created_at' => now(),
            'updated_at' => now(),
        ];
        DB::table('ecommerce_rentals')->insert($row);

        return response()->json($this->rental((object) $row), 201);
    }

    public function updateRental(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'location')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $existing = DB::table('ecommerce_rentals')->where('id', $id)->where('company_id', $company)->first();
        if (! $existing) {
            return response()->json(['error' => 'Location introuvable.'], 404);
        }

        $input = $this->rentalInput($request, true);
        if (($input['brand'] ?? $existing->brand ?? null) !== null || ($input['model'] ?? $existing->model ?? null) !== null) {
            $input['billingUnit'] = 'JOUR';
        }
        $input = $this->normalizeRentalCategory($input, $company);
        $input = $this->requireRentalCategory($input, (string) ($existing->category ?? ''));
        if (array_key_exists('name', $input) && DB::table('ecommerce_rentals')
            ->where('company_id', $company)
            ->where('id', '!=', $id)
            ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim($input['name']))])
            ->exists()) {
            return response()->json(['error' => 'Une location porte déjà ce nom dans cette boutique.'], 422);
        }

        $changes = [];
        foreach (['name', 'description', 'category'] as $field) {
            if (array_key_exists($field, $input)) {
                $changes[$field] = trim((string) $input[$field]);
            }
        }
        if (array_key_exists('categoryId', $input)) $changes['category_id'] = $input['categoryId'];
        if (array_key_exists('price', $input)) $changes['price'] = (int) $input['price'];
        if (array_key_exists('billingUnit', $input)) $changes['billing_unit'] = $input['billingUnit'];
        if (array_key_exists('availability', $input)) $changes['availability'] = (int) $input['availability'];
        if (array_key_exists('status', $input)) $changes['status'] = $input['status'];
        foreach (['brand','model','year','seats','transmission','fuel','conditions','instructions'] as $field) {
            if (array_key_exists($field, $input)) $changes[$field] = $input[$field];
        }
        foreach (['equipment','gallery','unavailablePeriods'] as $field) {
            if (array_key_exists($field, $input)) $changes[Str::snake($field)] = json_encode($input[$field]);
        }
        foreach (['dailyRate' => 'daily_rate', 'kmRate' => 'km_rate', 'deposit' => 'deposit', 'fees' => 'fees', 'year' => 'year', 'seats' => 'seats'] as $from => $to) {
            if (array_key_exists($from, $input)) $changes[$to] = (int) $input[$from];
        }
        $changes['updated_at'] = now();
        DB::table('ecommerce_rentals')->where('id', $id)->update($changes);

        return response()->json($this->rental(DB::table('ecommerce_rentals')->where('id', $id)->first()));
    }

    public function uploadRentalImage(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'location')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $rental = DB::table('ecommerce_rentals')
            ->where('id', $id)
            ->where('company_id', $company)
            ->first();
        if (! $rental) {
            return response()->json(['error' => 'Location introuvable.'], 404);
        }

        $input = Validator::make($request->all(), [
            'image' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ])->validate();
        $contents = $input['image']->get();
        if (! is_string($contents) || $contents === '') {
            return response()->json(['error' => 'La photo n’a pas pu être lue après son envoi.'], 500);
        }

        $extension = strtolower($input['image']->getClientOriginalExtension() ?: 'bin');
        $filename = Str::uuid()->toString().'.'.$extension;
        $imageUrl = '/api/rental-images/'.rawurlencode($company).'/'.rawurlencode($filename);
        $this->preservePrimaryImageInGallery(
            $company,
            'rental',
            $id,
            (string) ($rental->image_url ?? ''),
            (string) ($rental->image_data ?? ''),
            (string) ($rental->image_mime ?? ''),
        );
        DB::table('ecommerce_rentals')->where('id', $id)->update([
            'image_url' => $imageUrl,
            'image_data' => base64_encode($contents),
            'image_mime' => $input['image']->getMimeType() ?: 'application/octet-stream',
            'updated_at' => now(),
        ]);
        $this->deleteStoredImage($rental->image_url ?? '', $imageUrl);

        return response()->json($this->rental(DB::table('ecommerce_rentals')->where('id', $id)->first()));
    }

    public function uploadRentalGallery(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'location')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $rental = DB::table('ecommerce_rentals')->where('id', $id)->where('company_id', $company)->first();
        if (! $rental) {
            return response()->json(['error' => 'Location introuvable.'], 404);
        }

        $this->storeGalleryImages($request, $company, 'rental', $id, 'gallery', 20, 5120);

        return response()->json($this->rental(DB::table('ecommerce_rentals')->where('id', $id)->first()));
    }

    public function deleteRentalGalleryImage(Request $request, string $id, string $imageId): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'location')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $rental = DB::table('ecommerce_rentals')->where('id', $id)->where('company_id', $company)->first();
        if (! $rental) {
            return response()->json(['error' => 'Location introuvable.'], 404);
        }
        if (! $this->deleteGalleryImage($company, $imageId, 'rental', $id, 'gallery')) {
            return response()->json(['error' => 'Image de la location introuvable.'], 404);
        }

        return response()->json($this->rental(DB::table('ecommerce_rentals')->where('id', $id)->first()));
    }

    public function serveRentalImage(string $company, string $filename)
    {
        if (! preg_match('/^[A-Za-z0-9_-]+$/', $company) || ! preg_match('/^[A-Za-z0-9_.-]+$/', $filename)) {
            abort(404);
        }

        $imageUrl = '/api/rental-images/'.$company.'/'.$filename;
        $rental = DB::table('ecommerce_rentals')
            ->where('company_id', $company)
            ->where('image_url', $imageUrl)
            ->first(['image_data', 'image_mime']);
        if ($rental && is_string($rental->image_data) && $rental->image_data !== '') {
            $contents = base64_decode($rental->image_data, true);
            if ($contents !== false) {
                return response($contents, 200, [
                    'Content-Type' => $rental->image_mime ?: 'application/octet-stream',
                    'Cache-Control' => 'public, max-age=31536000, immutable',
                ]);
            }
        }

        $path = 'ecommerce/rentals/'.$company.'/'.$filename;
        if (! Storage::disk('public')->exists($path)) {
            abort(404);
        }

        return response()->file(Storage::disk('public')->path($path), [
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    public function setRentalAvailability(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'location')) {
            return $this->forbidden();
        }

        $input = Validator::make($request->all(), [
            'availability' => ['required', 'integer', 'min:0', 'max:1000000'],
        ])->validate();
        $company = $this->company($request);
        $updated = DB::table('ecommerce_rentals')
            ->where('id', $id)
            ->where('company_id', $company)
            ->update(['availability' => (int) $input['availability'], 'updated_at' => now()]);
        if (! $updated) {
            return response()->json(['error' => 'Location introuvable.'], 404);
        }

        return response()->json($this->rental(DB::table('ecommerce_rentals')->where('id', $id)->first()));
    }

    public function archiveRental(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'delete', 'location')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $updated = DB::table('ecommerce_rentals')
            ->where('id', $id)
            ->where('company_id', $company)
            ->update(['status' => 'ARCHIVED', 'updated_at' => now()]);
        if (! $updated) {
            return response()->json(['error' => 'Location introuvable.'], 404);
        }

        return response()->json($this->rental(DB::table('ecommerce_rentals')->where('id', $id)->first()));
    }

    public function updateOrderStatus(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'commandes')) {
            return $this->forbidden();
        }
        $input = Validator::make($request->all(), ['status' => ['required', 'in:'.implode(',', self::ORDER_STATUSES)]])->validate();
        $company = $this->company($request);
        $query = DB::table('ecommerce_orders')->where('id', $id)->where('company_id', $company);
        $order = $query->first();
        if (! $order) {
            return response()->json(['error' => 'Commande e-commerce introuvable.'], 404);
        }
        if (! in_array($input['status'], self::ORDER_TRANSITIONS[$order->status] ?? [], true)) {
            return response()->json(['error' => 'Cette transition de commande n’est pas autorisée.'], 422);
        }
        DB::transaction(function () use ($query, $id, $input): void {
            $locked = DB::table('ecommerce_orders')->where('id', $id)->lockForUpdate()->first();
            if (! $locked) {
                return;
            }
            DB::table('ecommerce_orders')->where('id', $id)->update(['status' => $input['status'], 'updated_at' => now()]);
            $wallet = app(\App\Http\Controllers\Api\SellerWalletController::class);
            $updated = DB::table('ecommerce_orders')->where('id', $id)->first();
            if ($input['status'] === 'LIVRÉE') {
                $wallet->releaseOrderFunds($updated);
            }
            if ($input['status'] === 'ANNULÉE') {
                if ($updated->payment_status === 'PAID') {
                    $wallet->reverseOrderFunds($updated);
                    DB::table('ecommerce_orders')->where('id', $id)->update(['payment_status' => 'REFUNDED', 'updated_at' => now()]);
                }
                if (in_array($updated->payment_status, ['PENDING', 'FAILED'], true)
                    || (str_starts_with((string) ($updated->note ?? ''), self::MANUAL_ORDER_NOTE_MARKER)
                        && ($updated->payment_status ?? 'UNPAID') === 'UNPAID')) {
                    $wallet->restoreOrderStock($updated);
                }
            }
        });

        return response()->json($this->order(DB::table('ecommerce_orders')->where('id', $id)->first()));
    }

    public function createCompanyOrder(Request $request): JsonResponse
    {
        if (! $this->allowed($request, 'create', 'commandes')) {
            return $this->forbidden();
        }

        $input = Validator::make($request->all(), [
            'customerName' => ['required', 'string', 'min:2', 'max:120'],
            'customerEmail' => ['nullable', 'email', 'max:160'],
            'customerPhone' => ['nullable', 'string', 'max:40'],
            'shippingAddress' => ['nullable', 'string', 'max:500'],
            'note' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.productId' => ['required', 'string', 'max:160'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
        ])->validate();
        $company = $this->company($request);
        $store = $this->ensureStore($company);

        $quantities = [];
        foreach ($input['items'] as $line) {
            $productId = (string) $line['productId'];
            $quantities[$productId] = ($quantities[$productId] ?? 0) + (int) $line['quantity'];
            if ($quantities[$productId] > 100) {
                return response()->json(['error' => 'La quantité maximale par produit est de 100.'], 422);
            }
        }

        $orderId = $this->id('order');
        try {
            $created = DB::transaction(function () use ($company, $store, $input, $quantities, $orderId): object {
                $items = [];
                $total = 0;
                foreach ($quantities as $productId => $quantity) {
                    $product = DB::table('ecommerce_products')
                        ->where('company_id', $company)
                        ->where('id', $productId)
                        ->where('status', 'PUBLISHED')
                        ->where('product_type', 'SALE')
                        ->lockForUpdate()
                        ->first();
                    if (! $product) {
                        throw new \RuntimeException('ORDER_PRODUCT_UNAVAILABLE');
                    }
                    $fulfillment = $product->fulfillment_type ?? 'PHYSICAL';
                    if ($fulfillment === 'PHYSICAL' && (int) $product->stock < $quantity) {
                        throw new \RuntimeException('ORDER_STOCK_INSUFFICIENT');
                    }
                    if ($fulfillment === 'DIGITAL' && empty($product->digital_file_path)) {
                        throw new \RuntimeException('ORDER_DIGITAL_FILE_MISSING');
                    }
                    $lineTotal = (int) $product->price * $quantity;
                    if ($lineTotal < 1 || $total > 2147483647 - $lineTotal) {
                        throw new \RuntimeException('ORDER_TOTAL_INVALID');
                    }
                    $total += $lineTotal;
                    $items[] = [
                        'id' => $this->id('item'),
                        'order_id' => $orderId,
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'unit_price' => (int) $product->price,
                        'quantity' => $quantity,
                        'line_total' => $lineTotal,
                        'product_type' => 'SALE',
                        'rental_period' => null,
                        'fulfillment_type' => $fulfillment,
                        'digital_file_name' => $product->digital_file_name ?? null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                    if ($fulfillment === 'PHYSICAL') {
                        DB::table('ecommerce_products')->where('id', $product->id)->update([
                            'stock' => (int) $product->stock - $quantity,
                            'updated_at' => now(),
                        ]);
                    }
                }

                $reference = 'CMD-'.strtoupper(Str::substr(str_replace('-', '', $orderId), -8));
                DB::table('ecommerce_orders')->insert([
                    'id' => $orderId,
                    'company_id' => $company,
                    'customer_id' => null,
                    'reference' => $reference,
                    'customer_name' => trim($input['customerName']),
                    'customer_email' => trim((string) ($input['customerEmail'] ?? '')),
                    'customer_phone' => trim((string) ($input['customerPhone'] ?? '')),
                    'shipping_address' => trim((string) ($input['shippingAddress'] ?? '')),
                    'note' => self::MANUAL_ORDER_NOTE_MARKER."\n".trim((string) ($input['note'] ?? '')),
                    'total' => $total,
                    'currency' => $store->currency ?? 'XOF',
                    'status' => 'NOUVELLE',
                    'payment_status' => 'UNPAID',
                    'payment_method' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                DB::table('ecommerce_order_items')->insert($items);

                return DB::table('ecommerce_orders')->where('id', $orderId)->first();
            });
        } catch (\RuntimeException $exception) {
            $message = match ($exception->getMessage()) {
                'ORDER_PRODUCT_UNAVAILABLE' => 'Un produit sélectionné n’est plus disponible à la vente.',
                'ORDER_STOCK_INSUFFICIENT' => 'Le stock disponible est insuffisant pour cette commande.',
                'ORDER_DIGITAL_FILE_MISSING' => 'Un produit numérique ne dispose pas de fichier téléchargeable.',
                default => 'Le total de cette commande est invalide.',
            };
            return response()->json(['error' => $message], 422);
        }

        return response()->json($this->order($created, DB::table('ecommerce_order_items')->where('order_id', $orderId)->get()->all()), 201);
    }

    public function downloadOrderAttachment(Request $request, string $id, string $attachmentId)
    {
        if (! $this->allowed($request, 'view', 'commandes')) {
            return $this->forbidden();
        }

        $attachment = DB::table('ecommerce_order_attachments')
            ->where('id', $attachmentId)
            ->where('order_id', $id)
            ->where('company_id', $this->company($request))
            ->first();
        if (! $attachment || ! Storage::disk('digital')->exists($attachment->file_path)) {
            return response()->json(['error' => 'Pièce jointe introuvable.'], 404);
        }

        return Storage::disk('digital')->download($attachment->file_path, $attachment->original_name, [
            'Content-Type' => $attachment->mime_type,
            'Cache-Control' => 'private, no-store, max-age=0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function deliveryRequests(Request $request): JsonResponse
    {
        if (! $this->allowed($request, 'view', 'livraisons')) {
            return $this->forbidden();
        }

        return response()->json(['deliveryRequests' => $this->listDeliveryRequests($this->company($request))]);
    }

    public function updateDeliveryRequestStatus(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'livraisons')) {
            return $this->forbidden();
        }

        $input = Validator::make($request->all(), [
            'status' => ['required', 'in:'.implode(',', self::DELIVERY_REQUEST_STATUSES)],
        ])->validate();
        $requestRow = DB::table('ecommerce_delivery_requests')
            ->where('id', $id)
            ->where('company_id', $this->company($request))
            ->first();
        if (! $requestRow) {
            return response()->json(['error' => 'Demande de livraison introuvable.'], 404);
        }

        DB::table('ecommerce_delivery_requests')->where('id', $id)->update([
            'status' => $input['status'],
            'updated_at' => now(),
        ]);

        return response()->json($this->deliveryRequest(DB::table('ecommerce_delivery_requests')->where('id', $id)->first()));
    }

    public function createDeliveryZone(Request $request): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'livraisons')) {
            return $this->forbidden();
        }

        $input = $this->deliveryZoneInput($request);
        $company = $this->company($request);
        if (DB::table('ecommerce_delivery_zones')->where('company_id', $company)->where('name', $input['name'])->exists()) {
            return response()->json(['error' => 'Une zone portant ce nom existe déjà.'], 422);
        }

        $row = [
            'id' => $this->id('delivery-zone'),
            'company_id' => $company,
            'name' => trim($input['name']),
            'description' => trim((string) ($input['description'] ?? '')),
            'fee' => (int) ($input['fee'] ?? 0),
            'estimated_minutes' => (int) ($input['estimatedMinutes'] ?? 0),
            'is_active' => (bool) ($input['isActive'] ?? true),
            'sort_order' => (int) ($input['sortOrder'] ?? 0),
            'created_at' => now(),
            'updated_at' => now(),
        ];
        DB::table('ecommerce_delivery_zones')->insert($row);

        return response()->json($this->deliveryZone((object) $row), 201);
    }

    public function updateDeliveryZone(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'livraisons')) {
            return $this->forbidden();
        }

        $company = $this->company($request);
        $zone = DB::table('ecommerce_delivery_zones')
            ->where('id', $id)
            ->where('company_id', $company)
            ->first();
        if (! $zone) {
            return response()->json(['error' => 'Zone de livraison introuvable.'], 404);
        }

        $input = $this->deliveryZoneInput($request, true);
        $name = array_key_exists('name', $input) ? trim($input['name']) : $zone->name;
        if (DB::table('ecommerce_delivery_zones')
            ->where('company_id', $company)
            ->where('name', $name)
            ->where('id', '!=', $id)
            ->exists()) {
            return response()->json(['error' => 'Une zone portant ce nom existe déjà.'], 422);
        }

        $values = [];
        if (array_key_exists('name', $input)) $values['name'] = $name;
        if (array_key_exists('description', $input)) $values['description'] = trim((string) ($input['description'] ?? ''));
        if (array_key_exists('fee', $input)) $values['fee'] = (int) $input['fee'];
        if (array_key_exists('estimatedMinutes', $input)) $values['estimated_minutes'] = (int) $input['estimatedMinutes'];
        if (array_key_exists('isActive', $input)) $values['is_active'] = (bool) $input['isActive'];
        if (array_key_exists('sortOrder', $input)) $values['sort_order'] = (int) $input['sortOrder'];
        $values['updated_at'] = now();
        DB::table('ecommerce_delivery_zones')->where('id', $id)->update($values);

        return response()->json($this->deliveryZone(DB::table('ecommerce_delivery_zones')->where('id', $id)->first()));
    }

    public function deleteDeliveryZone(Request $request, string $id): JsonResponse
    {
        if (! $this->allowed($request, 'modify', 'livraisons')) {
            return $this->forbidden();
        }

        $deleted = DB::table('ecommerce_delivery_zones')
            ->where('id', $id)
            ->where('company_id', $this->company($request))
            ->delete();
        if (! $deleted) {
            return response()->json(['error' => 'Zone de livraison introuvable.'], 404);
        }

        return response()->json(['ok' => true]);
    }

    public function publicBootstrap(string $slug): JsonResponse
    {
        $store = DB::table('ecommerce_stores')
            ->where('slug', $slug)
            ->where('status', 'PUBLISHED')
            ->first();
        if (! $store || ! CompanyRegistry::isActive((string) $store->company_id)) {
            return response()->json(['error' => 'Boutique introuvable ou non publiée.'], 404);
        }

        return response()->json($this->publicStore($store))
            ->header('Cache-Control', 'private, no-store')
            ->header('Vary', 'Host');
    }

    public function publicBootstrapByDomain(Request $request): JsonResponse
    {
        $store = $this->publishedStoreByDomain($request->getHost());
        if (! $store) {
            return response()->json(['available' => false]);
        }

        return response()->json($this->publicStore($store))
            ->header('Cache-Control', 'private, no-store')
            ->header('Vary', 'Host');
    }

    public function publicManifest(string $slug): JsonResponse
    {
        $store = DB::table('ecommerce_stores')
            ->where('slug', $slug)
            ->where('status', 'PUBLISHED')
            ->first();
        if (! $store || ! CompanyRegistry::isActive((string) $store->company_id)) {
            return response()->json(['error' => 'Boutique introuvable ou non publiée.'], 404);
        }

        return $this->manifestResponse($store);
    }

    public function publicManifestByDomain(Request $request): JsonResponse
    {
        $store = $this->publishedStoreByDomain($request->getHost());
        if (! $store) {
            return response()->json(['error' => 'Aucune boutique publiée ne correspond à ce domaine.'], 404);
        }

        return $this->manifestResponse($store, true);
    }

    public function createPublicDomainOrder(Request $request): JsonResponse
    {
        $store = $this->publishedStoreByDomain($request->getHost());
        if (! $store) {
            return response()->json(['error' => 'Aucune boutique publiée ne correspond à ce domaine.'], 404);
        }

        return $this->createOrderForStore($request, $store);
    }

    public function createPublicDeliveryRequest(Request $request, string $slug): JsonResponse
    {
        $store = DB::table('ecommerce_stores')->where('slug', $slug)->where('status', 'PUBLISHED')->first();
        if (! $store || ! CompanyRegistry::isActive((string) $store->company_id)) {
            return response()->json(['error' => 'Boutique introuvable ou non publiée.'], 404);
        }

        return $this->createDeliveryRequestForStore($request, $store);
    }

    public function createPublicDomainDeliveryRequest(Request $request): JsonResponse
    {
        $store = $this->publishedStoreByDomain($request->getHost());
        if (! $store) {
            return response()->json(['error' => 'Aucune boutique publiée ne correspond à ce domaine.'], 404);
        }

        return $this->createDeliveryRequestForStore($request, $store);
    }

    private function createDeliveryRequestForStore(Request $request, object $store): JsonResponse
    {
        $features = $this->publicEnabledFeatures((string) $store->company_id);
        if (! $features['livraisons']) {
            return response()->json(['error' => 'Le service de livraison n’est pas activé pour cette boutique.'], 403);
        }

        $input = Validator::make($request->all(), [
            'requesterName' => ['required', 'string', 'min:2', 'max:120'],
            'requesterEmail' => ['required', 'email', 'max:160'],
            'requesterPhone' => ['nullable', 'string', 'max:40'],
            'address' => ['required', 'string', 'min:5', 'max:500'],
            'serviceType' => ['required', 'in:STANDARD,URGENT'],
            'deliveryZoneId' => ['nullable', 'string', 'max:160'],
            'desiredDate' => ['nullable', 'date', 'after_or_equal:today'],
            'note' => ['nullable', 'string', 'max:500'],
        ])->validate();
        $activeZones = DB::table('ecommerce_delivery_zones')
            ->where('company_id', $store->company_id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
        $zone = null;
        if (! empty($input['deliveryZoneId'])) {
            $zone = $activeZones->firstWhere('id', $input['deliveryZoneId']);
            if (! $zone) {
                return response()->json(['error' => 'La zone de livraison sélectionnée est indisponible.'], 422);
            }
        } elseif ($activeZones->isNotEmpty()) {
            return response()->json(['error' => 'Veuillez sélectionner une zone de livraison.'], 422);
        }
        $customer = EcommerceCustomerAuth::customerFromRequest($request, (string) $store->company_id);
        if ($customer) {
            $input['requesterName'] = $customer->name;
            $input['requesterEmail'] = $customer->email;
            $input['requesterPhone'] = $customer->phone;
        }

        $id = $this->id('delivery');
        $reference = 'LIV-'.strtoupper(Str::substr(str_replace('-', '', $id), -8));
        $row = [
            'id' => $id,
            'company_id' => $store->company_id,
            'customer_id' => $customer?->id,
            'order_id' => null,
            'reference' => $reference,
            'requester_name' => trim($input['requesterName']),
            'requester_email' => Str::lower(trim($input['requesterEmail'])),
            'requester_phone' => trim((string) ($input['requesterPhone'] ?? '')),
            'address' => trim($input['address']),
            'service_type' => $input['serviceType'],
            'delivery_zone_id' => $zone?->id,
            'delivery_zone_name' => $zone?->name,
            'delivery_zone_fee' => (int) ($zone->fee ?? 0),
            'desired_date' => $input['desiredDate'] ?? null,
            'note' => trim((string) ($input['note'] ?? '')),
            'status' => 'DEMANDEE',
            'created_at' => now(),
            'updated_at' => now(),
        ];
        DB::table('ecommerce_delivery_requests')->insert($row);

        return response()->json($this->deliveryRequest((object) $row), 201);
    }

    private function publicStore(object $store): array
    {
        $company = (string) $store->company_id;
        $features = $this->publicEnabledFeatures($company);
        $publishedProducts = DB::table('ecommerce_products')
            ->select([
                'id',
                'company_id',
                'slug',
                'name',
                'description',
                'category',
                'category_id',
                'price',
                'compare_at_price',
                'stock',
                'image_url',
                'featured',
                'product_type',
                'rental_period',
                'fulfillment_type',
                'digital_file_path',
                'created_at',
                'updated_at',
            ])
            ->where('company_id', $company)
            ->where('status', 'PUBLISHED')
            ->orderByDesc('featured')
            ->orderBy('name')
            ->get();
        $publishedRentals = $features['location']
            ? DB::table('ecommerce_rentals')
                ->where('company_id', $company)
                ->where('status', 'PUBLISHED')
                ->orderByDesc('availability')
                ->orderBy('name')
                ->get()
            : collect();
        $publishedImmobilierProperties = $features['immobilier']
            ? DB::table('immobilier_properties')
                ->where('company_id', $company)
                ->where('publication_status', 'PUBLISHED')
                ->where('status', '!=', 'ARCHIVED')
                ->orderByDesc('featured')
                ->orderByDesc('updated_at')
                ->get()
            : collect();
        $galleryOwners = [
            ['ownerType' => 'store', 'ownerId' => (string) ($store->id ?? ''), 'collection' => 'hero'],
            ...$publishedProducts->map(fn (object $row): array => [
                'ownerType' => 'product',
                'ownerId' => (string) $row->id,
                'collection' => 'gallery',
            ])->all(),
            ...$publishedRentals->map(fn (object $row): array => [
                'ownerType' => 'rental',
                'ownerId' => (string) $row->id,
                'collection' => 'gallery',
            ])->all(),
        ];
        $galleryMap = $this->publicGalleryMap($company, $galleryOwners);
        $publicImmobilierProperties = $publishedImmobilierProperties
            ->map(fn ($row) => $this->publicImmobilierProperty($row, $company))
            ->values();

        return response()->json([
            'store' => $this->publicStorePayload($store, $features, $galleryMap),
            'products' => $publishedProducts
                ->filter(fn (object $row): bool => ($row->product_type ?? 'SALE') === 'SALE')
                ->filter(fn (object $row): bool => $this->allowsProductFulfillment($company, (string) ($row->fulfillment_type ?? 'PHYSICAL')))
            ->filter(fn (object $row): bool => ($row->fulfillment_type ?? 'PHYSICAL') !== 'DIGITAL' || ! empty($row->digital_file_path))
                ->map(fn ($row) => $this->publicProduct($row, $galleryMap))
                ->values(),
            'rentals' => $features['location']
                ? $publishedRentals
                    ->map(fn ($row) => $this->publicRental($row, $galleryMap))
                    ->concat(
                        $publishedProducts
                            ->filter(fn (object $row): bool => ($row->product_type ?? 'SALE') === 'RENTAL')
                            ->map(fn ($row) => $this->publicRentalProduct($row, $galleryMap))
                    )
                    ->values()
                : collect(),
            'immobilierProperties' => $publicImmobilierProperties,
            // Keep the old response key during the transition for clients that
            // have not yet moved from separate Bien and Annonce records.
            'immobilierListings' => $publicImmobilierProperties,
            'deliveryZones' => $this->publicDeliveryZones($company, $features),
        ])->getData(true);
    }

    private function publicImmobilierProperty(object $row, string $company): array
    {
        $legacyListingIds = DB::table('immobilier_listings')
            ->where('company_id', $company)
            ->where('property_id', (string) $row->id)
            ->where('status', '!=', 'ARCHIVED')
            ->orderByRaw("CASE WHEN status = 'PUBLISHED' THEN 0 ELSE 1 END")
            ->orderByDesc('updated_at')
            ->pluck('id')
            ->map(fn ($id): string => (string) $id)
            ->all();

        $gallery = DB::table('ecommerce_gallery_images')
            ->where('company_id', $company)
            ->where('collection', 'gallery')
            ->where(function ($query) use ($row, $legacyListingIds): void {
                $query->where(function ($propertyQuery) use ($row): void {
                    $propertyQuery
                        ->where('owner_type', 'immobilier_property')
                        ->where('owner_id', (string) $row->id);
                });
                if ($legacyListingIds !== []) {
                    $query->orWhere(function ($listingQuery) use ($legacyListingIds): void {
                        $listingQuery
                            ->where('owner_type', 'immobilier_listing')
                            ->whereIn('owner_id', $legacyListingIds);
                    });
                }
            })
            ->orderByRaw("CASE WHEN owner_type = 'immobilier_property' THEN 0 ELSE 1 END")
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get(['id', 'image_mime'])
            ->map(fn (object $media): array => [
                'id' => (string) $media->id,
                'url' => '/api/gallery-images/'.rawurlencode($company).'/'.rawurlencode((string) $media->id),
                'mime' => (string) ($media->image_mime ?? 'application/octet-stream'),
                'type' => str_starts_with((string) ($media->image_mime ?? ''), 'video/') ? 'video' : 'image',
            ])
            ->values()
            ->all();

        return [
            'id' => $row->id,
            'slug' => $row->publication_slug,
            'title' => $row->publication_title ?: $row->reference,
            'propertyType' => $row->property_type,
            'transactionType' => $row->transaction_type,
            'description' => $row->publication_description ?? '',
            'city' => $row->city,
            'neighborhood' => $row->neighborhood ?? '',
            'price' => (int) $row->price,
            'areaM2' => $row->area_m2 === null ? null : (int) $row->area_m2,
            'bedrooms' => $row->bedrooms === null ? null : (int) $row->bedrooms,
            'bathrooms' => $row->bathrooms === null ? null : (int) $row->bathrooms,
            'furnished' => (bool) $row->furnished,
            'featured' => (bool) $row->featured,
            'profileMedia' => $gallery[0] ?? null,
            'gallery' => $gallery,
        ];
    }

    private function publicStorePayload(object $row, ?array $features = null, array $galleryMap = []): array
    {
        $features ??= $this->publicEnabledFeatures((string) $row->company_id);
        $visibility = $this->publicSiteVisibility((string) $row->company_id);
        $company = DB::table('companies')
            ->where('id', $row->company_id)
            ->whereNull('deleted_at')
            ->first(['name', 'email', 'phone', 'profile_photo']);

        return [
            'slug' => $row->slug,
            'name' => $row->name,
            'description' => (string) ($row->description ?? ''),
            'status' => $row->status,
            'homepageEnabled' => $visibility['homepageEnabled'],
            'bannerEnabled' => $visibility['bannerEnabled'],
            'currency' => $row->currency,
            'primaryColor' => $row->primary_color,
            'accentColor' => $row->accent_color,
            'logoUrl' => $row->logo_url ?? '',
            'allowOrderAttachments' => (bool) ($row->allow_order_attachments ?? false),
            'heroImages' => $this->galleryUrlsFromMap($galleryMap, (string) $row->company_id, 'store', (string) ($row->id ?? ''), 'hero'),
            'transportPrimaryColor' => $this->publicTransportColor((string) $row->company_id, 'primaryColor'),
            'transportAccentColor' => $this->publicTransportColor((string) $row->company_id, 'accentColor'),
            'seller' => [
                'name' => (string) ($company->name ?? $row->name ?? ''),
                'email' => (string) ($company->email ?? ''),
                'phone' => (string) ($company->phone ?? ''),
                'photoUrl' => (string) ($company->profile_photo ?? ''),
            ],
            'enabledFeatures' => $features,
            'locationSettings' => $this->publicLocationSettings((string) $row->company_id),
        ];
    }

    private function publicTransportColor(string $company, string $key): string
    {
        $configuration = DB::table('maximus_company_modules')
            ->where('company_id', $company)
            ->where('module_id', 'transport')
            ->value('configuration');
        $configuration = json_decode($configuration ?? '{}', true);
        $settings = is_array($configuration) && is_array($configuration['transport'] ?? null)
            ? $configuration['transport']
            : [];
        $value = strtoupper(trim((string) ($settings[$key] ?? '')));
        if (preg_match('/^#[0-9A-F]{6}$/', $value) === 1 && $value !== '#000000') {
            return $value;
        }

        return $key === 'primaryColor' ? '#161D27' : '#F2B705';
    }

    /** @return array{homepageEnabled: bool, bannerEnabled: bool} */
    private function publicSiteVisibility(string $companyId): array
    {
        $settings = DB::table('company_public_site_access')
            ->where('company_id', $companyId)
            ->first(['homepage_enabled', 'banner_enabled']);

        return [
            'homepageEnabled' => (bool) ($settings->homepage_enabled ?? true),
            'bannerEnabled' => (bool) ($settings->banner_enabled ?? true),
        ];
    }

    private function publicLocationSettings(string $company): array
    {
        $row = DB::table('ecommerce_location_settings')->where('company_id', $company)->first();
        return [
            'whatsapp' => (string) ($row->whatsapp ?? ''),
            'message' => (string) ($row->message ?? ''),
            'policy' => (string) ($row->policy ?? ''),
        ];
    }

    private function manifestResponse(object $store, bool $customDomain = false): JsonResponse
    {
        $storeName = trim((string) $store->name);
        $logoUrl = trim((string) ($store->logo_url ?? ''));
        $scopePath = $customDomain
            ? '/client-app/'
            : '/client-app/shop/'.rawurlencode((string) $store->slug).'/';
        $startPath = $scopePath.'accueil';

        return response()->json([
            'name' => $storeName,
            'short_name' => Str::substr($storeName ?: 'Boutique', 0, 12),
            'description' => 'La vitrine et l’espace client de '.($storeName ?: 'cette boutique').'.',
            'id' => $scopePath,
            'start_url' => $startPath,
            'scope' => $scopePath,
            'display' => 'standalone',
            'orientation' => 'portrait-primary',
            'background_color' => '#f8f5ed',
            'theme_color' => $store->accent_color ?: '#0b1b2b',
            'lang' => 'fr',
            'icons' => [[
                'src' => $logoUrl !== '' ? $logoUrl : '/admin-logo.png',
                'sizes' => '1024x1024',
                'purpose' => 'any maskable',
            ]],
        ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            ->header('Vary', 'Host');
    }

    private function publicEnabledFeatures(string $companyId): array
    {
        return [
            'location' => ModuleCatalog::allowsFeature($companyId, 'ecommerce', 'location'),
            'transport' => ModuleCatalog::allowsFeature($companyId, 'transport', 'overview'),
            'immobilier' => ModuleCatalog::allowsFeature($companyId, 'immobilier', 'vitrine-publique'),
            'livraisons' => ModuleCatalog::allowsFeature($companyId, 'ecommerce', 'livraisons'),
            'ventePhysique' => ModuleCatalog::allowsFeature($companyId, 'ecommerce', 'vente-physique'),
            'venteNumerique' => ModuleCatalog::allowsFeature($companyId, 'ecommerce', 'vente-numerique'),
        ];
    }

    private function publicProduct(object $row, array $galleryMap = []): array
    {
        return [
            'slug' => $row->slug,
            'name' => $row->name,
            'description' => $row->description,
            'category' => $row->category,
            'price' => (int) $row->price,
            'compareAtPrice' => $row->compare_at_price === null ? null : (int) $row->compare_at_price,
            'stock' => (int) $row->stock,
            'imageUrl' => $row->image_url,
            'gallery' => $this->galleryUrlsFromMap($galleryMap, (string) $row->company_id, 'product', (string) $row->id, 'gallery'),
            'featured' => (bool) $row->featured,
            'productType' => $row->product_type ?? 'SALE',
            'rentalPeriod' => $row->rental_period,
            'fulfillmentType' => $row->fulfillment_type ?? 'PHYSICAL',
        ];
    }

    private function listRentals(string $company, bool $includeDrafts = false): array
    {
        $query = DB::table('ecommerce_rentals')->where('company_id', $company);
        if ($includeDrafts) {
            $query->where('status', '!=', 'ARCHIVED');
        } else {
            $query->where('status', 'PUBLISHED');
        }

        return $query->orderByDesc('availability')->orderBy('name')->get()
            ->map(fn ($row) => $includeDrafts ? $this->rental($row) : $this->publicRental($row))
            ->values()
            ->all();
    }

    private function publicRental(object $row, array $galleryMap = []): array
    {
        return [
            'id' => $row->id,
            'name' => $row->name,
            'description' => $row->description,
            'category' => trim((string) ($row->category ?? '')) ?: 'Général',
            'categoryId' => $row->category_id ?? null,
            'imageUrl' => $row->image_url ?? '',
            'gallery' => $this->galleryUrlsFromMap($galleryMap, (string) $row->company_id, 'rental', (string) $row->id, 'gallery', json_decode($row->gallery ?? '[]', true) ?: []),
            'price' => (int) $row->price,
            'billingUnit' => $row->billing_unit,
            'availability' => (int) $row->availability,
            'isAvailable' => (int) $row->availability > 0,
            'brand' => $row->brand ?? null,
            'model' => $row->model ?? null,
            'year' => $row->year ?? null,
            'seats' => $row->seats ?? null,
            'transmission' => $row->transmission ?? null,
            'fuel' => $row->fuel ?? null,
            'equipment' => json_decode($row->equipment ?? '[]', true) ?: [],
            'dailyRate' => (int) ($row->daily_rate ?? $row->price),
            'kmRate' => (int) ($row->km_rate ?? 0),
            'deposit' => (int) ($row->deposit ?? 0),
            'fees' => (int) ($row->fees ?? 0),
            'conditions' => $row->conditions ?? null,
            'instructions' => $row->instructions ?? null,
            'unavailablePeriods' => json_decode($row->unavailable_periods ?? '[]', true) ?: [],
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }

    private function publicRentalProduct(object $row, array $galleryMap = []): array
    {
        return [
            'id' => $row->id,
            'productSlug' => $row->slug,
            'name' => $row->name,
            'description' => $row->description,
            'category' => trim((string) ($row->category ?? '')) ?: 'Général',
            'categoryId' => $row->category_id ?? null,
            'imageUrl' => $row->image_url ?? '',
            'gallery' => $this->galleryUrlsFromMap($galleryMap, (string) $row->company_id, 'product', (string) $row->id, 'gallery'),
            'price' => (int) $row->price,
            'billingUnit' => $row->rental_period ?: 'JOUR',
            'availability' => (int) $row->stock,
            'isAvailable' => (int) $row->stock > 0,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }

    private function rental(object $row): array
    {
        return [
            'id' => $row->id,
            'companyId' => $row->company_id,
            'name' => $row->name,
            'description' => $row->description,
            'category' => $row->category,
            'categoryId' => $row->category_id ?? null,
            'imageUrl' => $row->image_url ?? '',
            'gallery' => $this->galleryUrls((string) $row->company_id, 'rental', (string) $row->id, 'gallery', json_decode($row->gallery ?? '[]', true) ?: []),
            'price' => (int) $row->price,
            'billingUnit' => $row->billing_unit,
            'availability' => (int) $row->availability,
            'isAvailable' => (int) $row->availability > 0,
            'status' => $row->status,
            'brand' => $row->brand ?? null,
            'model' => $row->model ?? null,
            'year' => $row->year ?? null,
            'seats' => $row->seats ?? null,
            'transmission' => $row->transmission ?? null,
            'fuel' => $row->fuel ?? null,
            'equipment' => json_decode($row->equipment ?? '[]', true) ?: [],
            'dailyRate' => (int) ($row->daily_rate ?? $row->price),
            'kmRate' => (int) ($row->km_rate ?? 0),
            'deposit' => (int) ($row->deposit ?? 0),
            'fees' => (int) ($row->fees ?? 0),
            'conditions' => $row->conditions ?? null,
            'instructions' => $row->instructions ?? null,
            'unavailablePeriods' => json_decode($row->unavailable_periods ?? '[]', true) ?: [],
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }

    private function rentalInput(Request $request, bool $partial = false): array
    {
        $required = $partial ? ['sometimes'] : ['required'];

        $input = Validator::make($request->all(), [
            'name' => array_merge($required, ['string', 'min:2', 'max:160']),
            'description' => ['nullable', 'string', 'max:2000'],
            'category' => ['nullable', 'string', 'max:80'],
            'categoryId' => ['sometimes', 'nullable', 'string', 'max:100'],
            'imageUrl' => ['sometimes', 'nullable', 'string', 'max:500'],
            'price' => array_merge($required, ['integer', 'min:0']),
            'billingUnit' => array_merge($required, ['in:'.implode(',', self::RENTAL_PERIODS)]),
            'availability' => array_merge($required, ['integer', 'min:0', 'max:1000000']),
            'status' => ['sometimes', 'in:'.implode(',', self::RENTAL_STATUSES)],
            'brand' => ['nullable', 'string', 'max:80'],
            'model' => ['nullable', 'string', 'max:120'],
            'year' => ['nullable', 'integer', 'min:1900', 'max:'.(date('Y') + 2)],
            'seats' => ['nullable', 'integer', 'min:1', 'max:100'],
            'transmission' => ['nullable', 'in:MANUAL,AUTOMATIC'],
            'fuel' => ['nullable', 'in:GASOLINE,PETROL,DIESEL,HYBRID,ELECTRIC,OTHER'],
            'equipment' => ['nullable', 'array'],
            'equipment.*' => ['string', 'max:120'],
            'gallery' => ['nullable', 'array', 'max:30'],
            'gallery.*' => ['string', 'max:500'],
            'dailyRate' => ['nullable', 'integer', 'min:0'],
            'kmRate' => ['nullable', 'integer', 'min:0'],
            'deposit' => ['nullable', 'integer', 'min:0'],
            'fees' => ['nullable', 'integer', 'min:0'],
            'conditions' => ['nullable', 'string', 'max:5000'],
            'instructions' => ['nullable', 'string', 'max:5000'],
            'unavailablePeriods' => ['nullable', 'array'],
            'unavailablePeriods.*.startsAt' => ['required_with:unavailablePeriods.*.endsAt', 'date'],
            'unavailablePeriods.*.endsAt' => ['required_with:unavailablePeriods.*.startsAt', 'date'],
        ])->validate();
        $periods = $input['unavailablePeriods'] ?? [];
        foreach ($periods as $index => $period) {
            if (strtotime($period['endsAt'] ?? '') <= strtotime($period['startsAt'] ?? '')) {
                abort(response()->json(['error' => 'Chaque période d’indisponibilité doit avoir une fin après son début.'], 422));
            }
            foreach ($periods as $otherIndex => $other) {
                if ($index !== $otherIndex && ($period['startsAt'] ?? '') < ($other['endsAt'] ?? '')
                    && ($period['endsAt'] ?? '') > ($other['startsAt'] ?? '')) {
                    abort(response()->json(['error' => 'Les périodes d’indisponibilité ne doivent pas se chevaucher.'], 422));
                }
            }
        }

        return $input;
    }

    private function normalizeRentalCategory(array $input, string $company): array
    {
        if (! array_key_exists('categoryId', $input)) {
            return $input;
        }

        $categoryId = $input['categoryId'];
        if ($categoryId === null || $categoryId === '') {
            $input['categoryId'] = null;
            return $input;
        }

        $category = DB::table('ecommerce_categories')
            ->where('id', $categoryId)
            ->where('company_id', $company)
            ->where('is_active', true)
            ->first();
        if (! $category) {
            abort(response()->json(['error' => 'La catégorie sélectionnée est introuvable ou inactive.'], 422));
        }

        $input['category'] = $category->name;
        return $input;
    }

    private function requireRentalCategory(array $input, ?string $existingCategory = null): array
    {
        if (! array_key_exists('category', $input) && ! array_key_exists('categoryId', $input) && trim((string) $existingCategory) === '') {
            return $input;
        }
        $category = trim((string) ($input['category'] ?? $existingCategory ?? ''));
        if ($category === '') {
            abort(response()->json(['error' => 'Une catégorie est obligatoire pour une location.'], 422));
        }
        $input['category'] = $category;

        return $input;
    }

    private function requireProductCategory(array $input, ?string $existingCategory = null, ?string $existingType = null): array
    {
        $productType = $input['productType'] ?? ($existingType ?? 'SALE');
        if ($productType !== 'RENTAL') {
            return $input;
        }

        $category = trim((string) ($input['category'] ?? $existingCategory ?? ''));
        if ($category === '') {
            abort(response()->json(['error' => 'Une catégorie est obligatoire pour un produit de location.'], 422));
        }
        $input['category'] = $category;

        return $input;
    }

    public function createPublicOrder(Request $request, string $slug): JsonResponse
    {
        $store = DB::table('ecommerce_stores')->where('slug', $slug)->where('status', 'PUBLISHED')->first();
        if (! $store || ! CompanyRegistry::isActive((string) $store->company_id)) {
            return response()->json(['error' => 'Boutique introuvable ou non publiée.'], 404);
        }
        return $this->createOrderForStore($request, $store);
    }

    private function createOrderForStore(Request $request, object $store): JsonResponse
    {
        $attachmentsEnabled = (bool) ($store->allow_order_attachments ?? false);
        $input = Validator::make($request->all(), [
            'customerName' => ['required', 'string', 'min:2', 'max:120'],
            'customerEmail' => ['nullable', 'email', 'max:160'],
            'customerPhone' => ['nullable', 'string', 'max:40'],
            'shippingAddress' => ['nullable', 'string', 'max:500'],
            'note' => ['nullable', 'string', 'max:500'],
            'deliveryZoneId' => ['nullable', 'string', 'max:160'],
            'paymentMethod' => ['sometimes', 'string', 'in:WAVE,ORANGE_MONEY,CASH_ON_DELIVERY'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.productSlug' => ['nullable', 'string', 'min:2', 'max:160'],
            'items.*.rentalId' => ['nullable', 'string', 'min:2', 'max:160'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'attachments' => $attachmentsEnabled ? ['sometimes', 'array', 'max:3'] : ['prohibited'],
            'attachments.*' => $attachmentsEnabled
                ? ['file', 'mimetypes:application/pdf,image/jpeg,image/png,image/webp', 'max:2048']
                : ['prohibited'],
        ])->validate();
        if (str_starts_with((string) ($input['note'] ?? ''), self::MANUAL_ORDER_NOTE_MARKER)) {
            $input['note'] = 'Message client : '.$input['note'];
        }
        $input['paymentMethod'] = $input['paymentMethod'] ?? 'WAVE';
        $attachments = $input['attachments'] ?? [];
        unset($input['attachments']);

        $customer = EcommerceCustomerAuth::customerFromRequest($request, (string) $store->company_id);
        $idempotencyKey = trim((string) ($request->header('Idempotency-Key') ?: $request->input('idempotencyKey', '')));
        if ($idempotencyKey !== '' && strlen($idempotencyKey) > 120) {
            return response()->json(['error' => 'La clé de commande est invalide.'], 422);
        }
        if ($idempotencyKey !== '') {
            $existing = DB::table('ecommerce_orders')
                ->where('company_id', $store->company_id)
                ->where('idempotency_key', $idempotencyKey)
                ->first();
            if ($existing) {
                if ($existing->payment_method !== null && $existing->payment_method !== $input['paymentMethod']) {
                    return response()->json(['error' => 'Cette clé correspond déjà à une commande utilisant un autre moyen de paiement.'], 409);
                }

                return response()->json([
                    'id' => $existing->id,
                    'reference' => $existing->reference,
                    'total' => (int) $existing->total,
                    'paymentMethod' => $existing->payment_method ?? null,
                    'paymentStatus' => $existing->payment_status ?? 'UNPAID',
                    'paymentCheckoutUrl' => $existing->payment_checkout_url ?? null,
                    'deliveryZoneId' => $existing->delivery_zone_id ?? null,
                    'deliveryZoneName' => $existing->delivery_zone_name ?? null,
                    'deliveryZoneFee' => (int) ($existing->delivery_zone_fee ?? 0),
                ]);
            }
        }
        if ($customer) {
            $input['customerName'] = $customer->name;
            $input['customerEmail'] = $customer->email;
            $input['customerPhone'] = $customer->phone;
            $cartItems = DB::table('ecommerce_customer_cart_items as cart')
                ->join('ecommerce_products as product', 'product.id', '=', 'cart.product_id')
                ->where('cart.customer_id', $customer->id)
                ->where('cart.company_id', $store->company_id)
                ->where('product.company_id', $store->company_id)
                ->where('product.status', 'PUBLISHED')
                ->orderBy('cart.created_at')
                ->get(['product.slug as productSlug', 'cart.quantity']);
            if ($cartItems->isNotEmpty() && collect($input['items'])->every(fn (array $item): bool => empty($item['rentalId']))) {
                $input['items'] = $cartItems->map(fn (object $item): array => [
                    'productSlug' => $item->productSlug,
                    'quantity' => (int) $item->quantity,
                ])->all();
            }
        }
        $activeDeliveryZones = $this->publicEnabledFeatures((string) $store->company_id)['livraisons']
            ? DB::table('ecommerce_delivery_zones')
                ->where('company_id', $store->company_id)
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get()
            : collect();
        $deliveryZone = null;
        if (! empty($input['deliveryZoneId'])) {
            $deliveryZone = $activeDeliveryZones->firstWhere('id', $input['deliveryZoneId']);
            if (! $deliveryZone) {
                return response()->json(['error' => 'La zone de livraison sélectionnée est indisponible.'], 422);
            }
        }
        $uploadedAttachmentPaths = [];
        try {
            $order = DB::transaction(function () use ($input, $attachments, $store, $customer, $idempotencyKey, $activeDeliveryZones, $deliveryZone, &$uploadedAttachmentPaths): array {
                $lines = [];
                $total = 0;
                $hasPhysicalProduct = false;
                $cashOnDeliveryEligible = true;
                foreach ($input['items'] as $item) {
                    if (! empty($item['rentalId'])) {
                        $cashOnDeliveryEligible = false;
                        $rental = DB::table('ecommerce_rentals')
                            ->where('id', $item['rentalId'])
                            ->where('company_id', $store->company_id)
                            ->where('status', 'PUBLISHED')
                            ->lockForUpdate()
                            ->first();
                        if (! $rental) {
                            throw new \RuntimeException('RENTAL_NOT_FOUND');
                        }
                        if ((int) $rental->availability < $item['quantity']) {
                            throw new \RuntimeException('RENTAL_UNAVAILABLE');
                        }
                        $lineTotal = $rental->price * $item['quantity'];
                        $total += $lineTotal;
                        $lines[] = [
                            'id' => $this->id('order-line'),
                            'product_id' => null,
                            'rental_id' => $rental->id,
                            'product_name' => $rental->name,
                            'unit_price' => $rental->price,
                            'quantity' => $item['quantity'],
                            'line_total' => $lineTotal,
                            'product_type' => 'RENTAL',
                            'rental_period' => $rental->billing_unit,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                        DB::table('ecommerce_rentals')->where('id', $rental->id)->update([
                            'availability' => $rental->availability - $item['quantity'],
                            'updated_at' => now(),
                        ]);
                        continue;
                    }
                    if (empty($item['productSlug'])) {
                        throw new \RuntimeException('PRODUCT_NOT_FOUND');
                    }
                    $product = DB::table('ecommerce_products')
                        ->where('slug', $item['productSlug'])
                        ->where('company_id', $store->company_id)
                        ->where('status', 'PUBLISHED')
                        ->lockForUpdate()
                        ->first();
                    if (! $product) {
                        throw new \RuntimeException('PRODUCT_NOT_FOUND');
                    }
                    $fulfillmentType = (string) ($product->fulfillment_type ?? 'PHYSICAL');
                    $productType = (string) ($product->product_type ?? 'SALE');
                    if ($fulfillmentType !== 'PHYSICAL' || $productType === 'RENTAL') {
                        $cashOnDeliveryEligible = false;
                    }
                    if (! $this->allowsProductFulfillment((string) $store->company_id, $fulfillmentType)) {
                        throw new \RuntimeException('PRODUCT_TYPE_NOT_AUTHORIZED');
                    }
                    if ($fulfillmentType === 'PHYSICAL' && trim((string) ($input['shippingAddress'] ?? '')) === '') {
                        throw new \RuntimeException('SHIPPING_ADDRESS_REQUIRED');
                    }
                    if ($fulfillmentType === 'PHYSICAL') {
                        $hasPhysicalProduct = true;
                    }
                    $quantity = $fulfillmentType === 'DIGITAL' ? 1 : (int) $item['quantity'];
                    if ($fulfillmentType === 'PHYSICAL' && $product->stock < $quantity) {
                        throw new \RuntimeException('STOCK_INSUFFICIENT');
                    }
                    $lineTotal = $product->price * $quantity;
                    $total += $lineTotal;
                    $lines[] = [
                        'id' => $this->id('order-line'),
                        'product_id' => $product->id,
                        'rental_id' => null,
                        'product_name' => $product->name,
                        'unit_price' => $product->price,
                        'quantity' => $quantity,
                        'line_total' => $lineTotal,
                        'product_type' => $productType,
                        'rental_period' => $product->rental_period,
                        'fulfillment_type' => $fulfillmentType,
                        'digital_file_name' => $product->digital_file_name ?? null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                    if ($fulfillmentType === 'PHYSICAL') {
                        DB::table('ecommerce_products')->where('id', $product->id)->update([
                            'stock' => $product->stock - $quantity,
                            'updated_at' => now(),
                        ]);
                    }
                }
                if ($hasPhysicalProduct && $activeDeliveryZones->isNotEmpty() && ! $deliveryZone) {
                    throw new \RuntimeException('DELIVERY_ZONE_REQUIRED');
                }
                if ($input['paymentMethod'] === 'CASH_ON_DELIVERY' && (! $hasPhysicalProduct || ! $cashOnDeliveryEligible)) {
                    throw new \RuntimeException('CASH_ON_DELIVERY_NOT_SUPPORTED');
                }
                $deliveryFee = $hasPhysicalProduct ? (int) ($deliveryZone->fee ?? 0) : 0;
                $total += $deliveryFee;

                $id = $this->id('order');
                $reference = 'CMD-'.strtoupper(Str::substr(str_replace('-', '', $id), -8));
                DB::table('ecommerce_orders')->insert([
                    'id' => $id,
                    'company_id' => $store->company_id,
                    'customer_id' => $customer?->id,
                    'idempotency_key' => $idempotencyKey !== '' ? $idempotencyKey : null,
                    'reference' => $reference,
                    'customer_name' => $input['customerName'],
                    'customer_email' => $customer?->email ?? ($input['customerEmail'] ?? null),
                    'customer_phone' => $input['customerPhone'] ?? '',
                    'shipping_address' => trim((string) ($input['shippingAddress'] ?? '')),
                    'note' => $input['note'] ?? '',
                    'delivery_zone_id' => $hasPhysicalProduct ? $deliveryZone?->id : null,
                    'delivery_zone_name' => $hasPhysicalProduct ? $deliveryZone?->name : null,
                    'delivery_zone_fee' => $deliveryFee,
                    'total' => $total,
                    'currency' => (string) ($store->currency ?? 'XOF'),
                    'status' => 'NOUVELLE',
                    'payment_method' => $input['paymentMethod'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                foreach ($lines as $line) {
                    DB::table('ecommerce_order_items')->insert(array_merge($line, ['order_id' => $id]));
                }
                foreach ($attachments as $file) {
                    $mimeType = (string) $file->getMimeType();
                    $extension = match ($mimeType) {
                        'application/pdf' => 'pdf',
                        'image/jpeg' => 'jpg',
                        'image/png' => 'png',
                        'image/webp' => 'webp',
                        default => throw new \RuntimeException('ATTACHMENT_STORAGE_FAILED'),
                    };
                    $attachmentId = (string) Str::uuid();
                    $path = $file->storeAs('order-attachments/'.$id, $attachmentId.'.'.$extension, 'digital');
                    if (! is_string($path) || $path === '') {
                        throw new \RuntimeException('ATTACHMENT_STORAGE_FAILED');
                    }
                    $uploadedAttachmentPaths[] = $path;
                    $originalName = basename(str_replace('\\', '/', $file->getClientOriginalName()));
                    $originalName = trim((string) preg_replace('/[\x00-\x1F\x7F]/u', '', $originalName));
                    if ($originalName === '') {
                        $originalName = 'piece-jointe.'.$extension;
                    }
                    $originalName = Str::limit($originalName, 255, '');

                    DB::table('ecommerce_order_attachments')->insert([
                        'id' => $attachmentId,
                        'company_id' => $store->company_id,
                        'order_id' => $id,
                        'customer_id' => $customer?->id,
                        'file_path' => $path,
                        'original_name' => $originalName,
                        'mime_type' => $mimeType,
                        'file_size' => (int) ($file->getSize() ?: 0),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
                if ($customer) {
                    DB::table('ecommerce_customer_cart_items')
                        ->where('customer_id', $customer->id)
                        ->where('company_id', $store->company_id)
                        ->delete();
                }

                return [
                    'id' => $id,
                    'reference' => $reference,
                    'total' => $total,
                    'paymentMethod' => $input['paymentMethod'],
                    'paymentStatus' => 'UNPAID',
                    'deliveryZoneId' => $hasPhysicalProduct ? $deliveryZone?->id : null,
                    'deliveryZoneName' => $hasPhysicalProduct ? $deliveryZone?->name : null,
                    'deliveryZoneFee' => $deliveryFee,
                ];
            });

            $this->appNotifications->publish([
                'id' => 'ecommerce-order-'.$order['id'],
                'title' => 'Nouvelle commande en ligne',
                'text' => 'La commande '.$order['reference'].' vient d’être passée sur la boutique.',
                'read' => false,
                'date' => now()->format('d/m/Y H:i'),
                'audience' => 'all',
                'companyId' => (string) $store->company_id,
                'module' => 'ecommerce',
                'severity' => 'success',
                'href' => '/entreprise/ecommerce?tab=commandes',
            ], $request->getHost());

            return response()->json($order, 201);
        } catch (Throwable $error) {
            foreach ($uploadedAttachmentPaths as $path) {
                Storage::disk('digital')->delete($path);
            }
            $message = match ($error->getMessage()) {
                'STOCK_INSUFFICIENT' => 'Un article n’est plus disponible dans la quantité demandée.',
                'RENTAL_UNAVAILABLE' => 'Cette location n’est plus disponible dans la quantité demandée.',
                'PRODUCT_TYPE_NOT_AUTHORIZED' => 'Ce type de produit n’est pas activé pour cette boutique.',
                'SHIPPING_ADDRESS_REQUIRED' => 'Une adresse est nécessaire pour une commande physique.',
                'DELIVERY_ZONE_REQUIRED' => 'Veuillez sélectionner une zone de livraison.',
                'CASH_ON_DELIVERY_NOT_SUPPORTED' => 'Le paiement à la livraison est uniquement disponible pour les commandes de produits physiques.',
                'ATTACHMENT_STORAGE_FAILED' => 'Une pièce jointe n’a pas pu être enregistrée.',
                default => 'La commande n’a pas pu être enregistrée.',
            };

            return response()->json([
                'error' => $message,
            ], in_array($error->getMessage(), ['STOCK_INSUFFICIENT', 'RENTAL_UNAVAILABLE'], true)
                ? 409
                : (in_array($error->getMessage(), ['CASH_ON_DELIVERY_NOT_SUPPORTED'], true)
                    ? 422
                    : ($error->getMessage() === 'ATTACHMENT_STORAGE_FAILED' ? 500 : 400)));
        }
    }

    private function publishedStoreByDomain(string $host): ?object
    {
        $domainRow = $this->domainVerifier->activeForHost($host);
        if (! $domainRow) {
            return null;
        }

        $store = DB::table('ecommerce_stores')
            ->where('company_id', $domainRow->company_id)
            ->where('status', 'PUBLISHED')
            ->first();
        return $store && CompanyRegistry::isActive((string) $store->company_id) ? $store : null;
    }

    private function domains(string $company): array
    {
        return $this->publicSiteDomains->forCompany($company);
    }

    private function deleteStoredImage(?string $imageUrl, string $replacement): void
    {
        if (! is_string($imageUrl)) {
            return;
        }
        if ($imageUrl === $replacement) {
            return;
        }

        $path = str_starts_with($imageUrl, '/storage/')
            ? substr($imageUrl, strlen('/storage/'))
            : null;
        if (str_starts_with($imageUrl, '/api/product-images/')) {
            $parts = explode('/', trim($imageUrl, '/'));
            if (count($parts) === 4) {
                $path = 'ecommerce/products/'.$parts[2].'/'.$parts[3];
            }
        }
        if (str_starts_with($imageUrl, '/api/store-logos/')) {
            $parts = explode('/', trim($imageUrl, '/'));
            if (count($parts) === 4) {
                $path = 'ecommerce/stores/'.$parts[2].'/'.$parts[3];
            }
        }
        if (str_starts_with($imageUrl, '/api/rental-images/')) {
            $parts = explode('/', trim($imageUrl, '/'));
            if (count($parts) === 4) {
                $path = 'ecommerce/rentals/'.$parts[2].'/'.$parts[3];
            }
        }
        if ($path) {
            Storage::disk('public')->delete($path);
        }
    }

    private function storeGalleryImages(
        Request $request,
        string $company,
        string $ownerType,
        string $ownerId,
        string $collection,
        int $maxFiles,
        int $maxKilobytes,
    ): void {
        $input = Validator::make($request->all(), [
            'images' => ['required', 'array', 'min:1', 'max:'.$maxFiles],
            'images.*' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.$maxKilobytes],
        ])->validate();

        $nextOrder = (int) DB::table('ecommerce_gallery_images')
            ->where('company_id', $company)
            ->where('owner_type', $ownerType)
            ->where('owner_id', $ownerId)
            ->where('collection', $collection)
            ->max('sort_order') + 1;

        foreach ($input['images'] as $file) {
            $contents = $file->get();
            if (! is_string($contents) || $contents === '') {
                continue;
            }
            $id = $this->id('gallery');
            DB::table('ecommerce_gallery_images')->insert([
                'id' => $id,
                'company_id' => $company,
                'owner_type' => $ownerType,
                'owner_id' => $ownerId,
                'collection' => $collection,
                'image_data' => base64_encode($contents),
                'image_mime' => $file->getMimeType() ?: 'application/octet-stream',
                'sort_order' => $nextOrder++,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function preservePrimaryImageInGallery(
        string $company,
        string $ownerType,
        string $ownerId,
        string $imageUrl,
        string $imageData,
        string $imageMime,
    ): void {
        if (trim($imageUrl) === '' || trim($imageData) === '') {
            return;
        }

        $nextOrder = (int) DB::table('ecommerce_gallery_images')
            ->where('company_id', $company)
            ->where('owner_type', $ownerType)
            ->where('owner_id', $ownerId)
            ->where('collection', 'gallery')
            ->max('sort_order') + 1;

        DB::table('ecommerce_gallery_images')->insert([
            'id' => $this->id('gallery'),
            'company_id' => $company,
            'owner_type' => $ownerType,
            'owner_id' => $ownerId,
            'collection' => 'gallery',
            'image_data' => $imageData,
            'image_mime' => $imageMime !== '' ? $imageMime : 'application/octet-stream',
            'sort_order' => $nextOrder,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function deleteGalleryImage(
        string $company,
        string $imageId,
        string $ownerType,
        string $ownerId,
        string $collection,
    ): bool {
        return DB::table('ecommerce_gallery_images')
            ->where('id', $imageId)
            ->where('company_id', $company)
            ->where('owner_type', $ownerType)
            ->where('owner_id', $ownerId)
            ->where('collection', $collection)
            ->delete() > 0;
    }

    private function galleryUrls(
        string $company,
        string $ownerType,
        string $ownerId,
        string $collection,
        array $legacy = [],
    ): array {
        $uploaded = DB::table('ecommerce_gallery_images')
            ->where('company_id', $company)
            ->where('owner_type', $ownerType)
            ->where('owner_id', $ownerId)
            ->where('collection', $collection)
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->pluck('id')
            ->map(fn ($id) => '/api/gallery-images/'.rawurlencode($company).'/'.rawurlencode((string) $id))
            ->all();

        return array_values(array_unique(array_filter(array_merge($legacy, $uploaded), fn ($url) => is_string($url) && trim($url) !== '')));
    }

    private function publicGalleryMap(string $company, array $owners): array
    {
        if ($owners === []) {
            return [];
        }

        $rows = DB::table('ecommerce_gallery_images')
            ->where('company_id', $company)
            ->where(function ($query) use ($owners): void {
                foreach ($owners as $owner) {
                    $query->orWhere(function ($ownerQuery) use ($owner): void {
                        $ownerQuery
                            ->where('owner_type', $owner['ownerType'])
                            ->where('owner_id', $owner['ownerId'])
                            ->where('collection', $owner['collection']);
                    });
                }
            })
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get(['id', 'owner_type', 'owner_id', 'collection']);

        $map = [];
        foreach ($rows as $row) {
            $key = implode('|', [(string) $row->owner_type, (string) $row->owner_id, (string) $row->collection]);
            $map[$key] ??= [];
            $map[$key][] = '/api/gallery-images/'.rawurlencode($company).'/'.rawurlencode((string) $row->id);
        }

        return $map;
    }

    private function galleryUrlsFromMap(
        array $galleryMap,
        string $company,
        string $ownerType,
        string $ownerId,
        string $collection,
        array $legacy = [],
    ): array {
        $key = implode('|', [$ownerType, $ownerId, $collection]);
        return array_values(array_unique(array_filter(
            array_merge($legacy, $galleryMap[$key] ?? []),
            fn ($url) => is_string($url) && trim($url) !== '',
        )));
    }

    private function orders(string $company): array
    {
        $rows = DB::table('ecommerce_orders')->where('company_id', $company)->orderByDesc('created_at')->limit(250)->get();
        $items = DB::table('ecommerce_order_items')->whereIn('order_id', $rows->pluck('id')->all())->get()->groupBy('order_id');
        $attachments = DB::table('ecommerce_order_attachments')
            ->where('company_id', $company)
            ->whereIn('order_id', $rows->pluck('id')->all())
            ->orderBy('created_at')
            ->get()
            ->groupBy('order_id');

        return $rows->map(fn ($row) => $this->order(
            $row,
            $items->get($row->id, collect())->values()->all(),
            $attachments->get($row->id, collect())->values()->all(),
        ))->values()->all();
    }

    /**
     * Paid revenue grouped by the currency captured on each sale, both cumulative
     * and for the current day.
     *
     * @return array<int, array{currency: string, total: int, online: int, counter: int, todayTotal: int, todayOnline: int, todayCounter: int}>
     */
    private function revenueSummary(string $company): array
    {
        $totals = [];
        $sources = [
            'online' => [
                'enabled' => ModuleCatalog::allowsFeature($company, 'ecommerce', 'commandes'),
                'table' => 'ecommerce_orders',
                'currency' => "COALESCE(currency, 'INCONNUE')",
            ],
            'counter' => [
                'enabled' => ModuleCatalog::allowsFeature($company, 'ecommerce', 'vente-comptoir'),
                'table' => 'ecommerce_pos_sales',
                'currency' => 'currency',
            ],
        ];
        $today = now()->startOfDay();

        foreach ($sources as $source => $definition) {
            if (! $definition['enabled']) {
                continue;
            }

            $query = DB::table($definition['table'])->where('company_id', $company);
            if ($source === 'online') {
                $query->where('status', '!=', 'ANNULÉE')->where('payment_status', 'PAID');
            } else {
                $query->where('status', 'PAID');
            }

            $currencyExpression = $definition['currency'];
            $rows = $query
                ->selectRaw($currencyExpression.' AS currency')
                ->selectRaw('SUM(total) AS amount')
                ->selectRaw('SUM(CASE WHEN created_at >= ? THEN total ELSE 0 END) AS today_amount', [$today])
                ->groupByRaw($currencyExpression)
                ->get();

            foreach ($rows as $row) {
                $currency = (string) $row->currency;
                $totals[$currency] ??= [
                    'currency' => $currency,
                    'total' => 0,
                    'online' => 0,
                    'counter' => 0,
                    'todayTotal' => 0,
                    'todayOnline' => 0,
                    'todayCounter' => 0,
                ];
                $amount = (int) $row->amount;
                $todayAmount = (int) $row->today_amount;
                $totals[$currency][$source] += $amount;
                $totals[$currency]['total'] += $amount;
                $todaySource = $source === 'online' ? 'todayOnline' : 'todayCounter';
                $totals[$currency][$todaySource] += $todayAmount;
                $totals[$currency]['todayTotal'] += $todayAmount;
            }
        }

        ksort($totals);

        return array_values($totals);
    }

    private function store(object $row): array
    {
        $visibility = $this->publicSiteVisibility((string) $row->company_id);

        return [
            'id' => $row->id,
            'companyId' => $row->company_id,
            'slug' => $row->slug,
            'name' => $row->name,
            'description' => $row->description,
            'status' => $row->status,
            'homepageEnabled' => $visibility['homepageEnabled'],
            'bannerEnabled' => $visibility['bannerEnabled'],
            'currency' => $row->currency,
            'primaryColor' => $row->primary_color,
            'accentColor' => $row->accent_color,
            'logoUrl' => $row->logo_url ?? '',
            'allowOrderAttachments' => (bool) ($row->allow_order_attachments ?? false),
            'heroImages' => $this->galleryUrls((string) $row->company_id, 'store', (string) $row->id, 'hero'),
        ];
    }

    private function product(object $row): array
    {
        return [
            'id' => $row->id,
            'companyId' => $row->company_id,
            'name' => $row->name,
            'slug' => $row->slug,
            'sku' => $row->sku,
            'description' => $row->description,
            'category' => $row->category,
            'categoryId' => $row->category_id ?? null,
            'price' => (int) $row->price,
            'compareAtPrice' => $row->compare_at_price === null ? null : (int) $row->compare_at_price,
            'stock' => (int) $row->stock,
            'imageUrl' => $row->image_url,
            'gallery' => $this->galleryUrls((string) $row->company_id, 'product', (string) $row->id, 'gallery'),
            'featured' => (bool) $row->featured,
            'status' => $row->status,
            'productType' => $row->product_type ?? 'SALE',
            'rentalPeriod' => $row->rental_period,
            'fulfillmentType' => $row->fulfillment_type ?? 'PHYSICAL',
            'digitalFile' => ($row->fulfillment_type ?? 'PHYSICAL') === 'DIGITAL' && ! empty($row->digital_file_path)
                ? [
                    'name' => $row->digital_file_name ?? '',
                    'mime' => $row->digital_file_mime ?? 'application/octet-stream',
                    'size' => (int) ($row->digital_file_size ?? 0),
                ]
                : null,
        ];
    }

    private function order(object $row, array $items = [], array $attachments = []): array
    {
        return [
            'id' => $row->id,
            'companyId' => $row->company_id,
            'createdSource' => str_starts_with((string) ($row->note ?? ''), self::MANUAL_ORDER_NOTE_MARKER) ? 'MANUAL' : 'ONLINE',
            'reference' => $row->reference,
            'customerName' => $row->customer_name,
            'customerEmail' => $row->customer_email,
            'customerPhone' => $row->customer_phone,
            'shippingAddress' => $row->shipping_address,
            'note' => preg_replace('/^\[MAXIMUS-MANUAL-ORDER\]\n?/', '', (string) ($row->note ?? '')) ?? '',
            'deliveryZoneId' => $row->delivery_zone_id ?? null,
            'deliveryZoneName' => $row->delivery_zone_name ?? null,
            'deliveryZoneFee' => (int) ($row->delivery_zone_fee ?? 0),
            'total' => (int) $row->total,
            'status' => $row->status,
            'paymentMethod' => $row->payment_method ?? null,
            'paymentStatus' => $row->payment_status ?? 'UNPAID',
            'paymentCheckoutUrl' => $row->payment_checkout_url ?? null,
            'paymentFailureReason' => $row->payment_failure_reason ?? '',
            'createdAt' => $row->created_at,
            'attachments' => array_map(fn (object $attachment): array => [
                'id' => $attachment->id,
                'name' => $attachment->original_name,
                'mimeType' => $attachment->mime_type,
                'size' => (int) $attachment->file_size,
            ], $attachments),
            'items' => array_map(fn ($item) => [
                'id' => $item->id,
                'productId' => $item->product_id,
                'productName' => $item->product_name,
                'unitPrice' => (int) $item->unit_price,
                'quantity' => (int) $item->quantity,
                'lineTotal' => (int) $item->line_total,
                'productType' => $item->product_type ?? 'SALE',
                'rentalPeriod' => $item->rental_period,
                'fulfillmentType' => $item->fulfillment_type ?? 'PHYSICAL',
            ], $items),
        ];
    }

    private function productInput(Request $request, bool $partial = false): array
    {
        $required = $partial ? ['sometimes'] : ['required'];

        return Validator::make($request->all(), [
            'name' => array_merge($required, ['string', 'min:2', 'max:160']),
            'slug' => ['nullable', 'string', 'max:160'],
            'sku' => array_merge($required, ['string', 'min:1', 'max:80']),
            'description' => ['nullable', 'string', 'max:2000'],
            'category' => ['nullable', 'string', 'max:80'],
            'categoryId' => ['nullable', 'string', 'max:100'],
            'price' => array_merge($required, ['integer', 'min:0']),
            'compareAtPrice' => ['nullable', 'integer', 'min:0'],
            'stock' => array_merge($required, ['integer', 'min:0']),
            'imageUrl' => ['nullable', 'string', 'max:500'],
            'featured' => ['sometimes', 'boolean'],
            'status' => ['sometimes', 'in:'.implode(',', self::STATUSES)],
            'productType' => array_merge($partial ? ['sometimes'] : ['nullable'], ['in:'.implode(',', self::PRODUCT_TYPES)]),
            'rentalPeriod' => ['nullable', 'in:'.implode(',', self::RENTAL_PERIODS)],
            'fulfillmentType' => array_merge($partial ? ['sometimes'] : ['nullable'], ['in:'.implode(',', self::FULFILLMENT_TYPES)]),
        ])->validate();
    }

    private function normalizeProductType(array $input, bool $partial = false): array
    {
        if (! $partial && ! array_key_exists('productType', $input)) {
            $input['productType'] = 'SALE';
        }
        if (! $partial && ! array_key_exists('rentalPeriod', $input)) {
            $input['rentalPeriod'] = null;
        }
        if (array_key_exists('productType', $input) && $input['productType'] === 'SALE') {
            $input['rentalPeriod'] = null;
        }

        return $input;
    }

    private function normalizeFulfillment(array $input, bool $partial = false, string $existing = 'PHYSICAL'): array
    {
        if (! $partial && ! array_key_exists('fulfillmentType', $input)) {
            $input['fulfillmentType'] = 'PHYSICAL';
        }
        if ($partial && ! array_key_exists('fulfillmentType', $input)) {
            $input['fulfillmentType'] = $existing;
        }
        if (($input['fulfillmentType'] ?? $existing) === 'DIGITAL') {
            $input['productType'] = 'SALE';
            $input['rentalPeriod'] = null;
            $input['stock'] = 1;
        }

        return $input;
    }

    private function allowsProductFulfillment(string $company, string $fulfillmentType): bool
    {
        return ModuleCatalog::allowsFeature(
            $company,
            'ecommerce',
            $fulfillmentType === 'DIGITAL' ? 'vente-numerique' : 'vente-physique',
        );
    }

    private function listDeliveryRequests(string $company): array
    {
        return DB::table('ecommerce_delivery_requests')
            ->where('company_id', $company)
            ->orderByDesc('created_at')
            ->limit(250)
            ->get()
            ->map(fn ($row) => $this->deliveryRequest($row))
            ->values()
            ->all();
    }

    private function listDeliveryZones(string $company): array
    {
        return DB::table('ecommerce_delivery_zones')
            ->where('company_id', $company)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn ($row) => $this->deliveryZone($row))
            ->values()
            ->all();
    }

    private function publicDeliveryZones(string $company, ?array $features = null): array
    {
        $features ??= $this->publicEnabledFeatures($company);
        if (! $features['livraisons']) {
            return [];
        }

        return DB::table('ecommerce_delivery_zones')
            ->where('company_id', $company)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn ($row) => $this->deliveryZone($row))
            ->values()
            ->all();
    }

    private function deliveryZone(object $row): array
    {
        return [
            'id' => $row->id,
            'companyId' => $row->company_id,
            'name' => $row->name,
            'description' => (string) ($row->description ?? ''),
            'fee' => (int) ($row->fee ?? 0),
            'estimatedMinutes' => (int) ($row->estimated_minutes ?? 0),
            'isActive' => (bool) ($row->is_active ?? false),
            'sortOrder' => (int) ($row->sort_order ?? 0),
        ];
    }

    private function deliveryRequest(object $row): array
    {
        return [
            'id' => $row->id,
            'companyId' => $row->company_id,
            'customerId' => $row->customer_id,
            'orderId' => $row->order_id,
            'reference' => $row->reference,
            'requesterName' => $row->requester_name,
            'requesterEmail' => $row->requester_email,
            'requesterPhone' => $row->requester_phone,
            'address' => $row->address,
            'deliveryZoneId' => $row->delivery_zone_id ?? null,
            'deliveryZoneName' => $row->delivery_zone_name ?? null,
            'deliveryZoneFee' => (int) ($row->delivery_zone_fee ?? 0),
            'serviceType' => $row->service_type,
            'desiredDate' => $row->desired_date,
            'note' => $row->note,
            'status' => $row->status,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }

    private function deliveryZoneInput(Request $request, bool $partial = false): array
    {
        $required = $partial ? ['sometimes'] : ['required'];

        return Validator::make($request->all(), [
            'name' => array_merge($required, ['string', 'min:2', 'max:120']),
            'description' => ['sometimes', 'nullable', 'string', 'max:300'],
            'fee' => ['sometimes', 'integer', 'min:0', 'max:100000000'],
            'estimatedMinutes' => ['sometimes', 'integer', 'min:0', 'max:43200'],
            'isActive' => ['sometimes', 'boolean'],
            'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:10000'],
        ])->validate();
    }

    private function categories(string $company): array
    {
        return DB::table('ecommerce_categories')
            ->where('company_id', $company)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (object $row): array => $this->category($row))
            ->values()
            ->all();
    }

    private function normalizeProductCategory(array $input, string $company): array
    {
        if (! array_key_exists('categoryId', $input)) {
            return $input;
        }

        $categoryId = $input['categoryId'];
        if ($categoryId === null || $categoryId === '') {
            $input['categoryId'] = null;
            return $input;
        }

        $category = DB::table('ecommerce_categories')
            ->where('id', $categoryId)
            ->where('company_id', $company)
            ->where('is_active', true)
            ->first();
        if (! $category) {
            abort(response()->json(['error' => 'La catégorie sélectionnée est introuvable ou inactive.'], 422));
        }

        $input['category'] = $category->name;
        return $input;
    }

    private function category(object $row): array
    {
        return [
            'id' => $row->id,
            'companyId' => $row->company_id,
            'name' => $row->name,
            'slug' => $row->slug,
            'description' => $row->description,
            'isActive' => (bool) $row->is_active,
            'sortOrder' => (int) $row->sort_order,
        ];
    }

    private function categorySlug(string $value): string
    {
        return Str::slug(trim($value));
    }

    private function uniqueCategorySlug(string $requested, string $name, string $company, ?string $ignoreId = null): string
    {
        $base = $this->categorySlug($requested);
        if ($base === '') {
            $base = $this->categorySlug($name);
        }
        $base = $base !== '' ? $base : 'categorie';
        $slug = $base;
        $suffix = 2;

        while (true) {
            $query = DB::table('ecommerce_categories')
                ->where('company_id', $company)
                ->where('slug', $slug);
            if ($ignoreId !== null) {
                $query->where('id', '!=', $ignoreId);
            }
            if (! $query->exists()) {
                return $slug;
            }
            $slug = $base.'-'.$suffix;
            $suffix++;
        }
    }

    private function uniqueProductSlug(string $requested, string $name, string $sku, string $company, ?string $ignoreId = null): string
    {
        $base = Str::slug(trim($requested));
        if ($base === '') {
            $base = Str::slug(trim($name));
        }
        if ($base === '') {
            $base = Str::slug(trim($sku));
        }
        $base = $base !== '' ? $base : 'produit';
        $slug = $base;
        $suffix = 2;
        while (true) {
            $query = DB::table('ecommerce_products')
                ->where('company_id', $company)
                ->where('slug', $slug);
            if ($ignoreId !== null) {
                $query->where('id', '!=', $ignoreId);
            }
            if (! $query->exists()) {
                return $slug;
            }
            $slug = $base.'-'.$suffix;
            $suffix++;
        }
    }

    private function ensureStore(string $company): object
    {
        $existing = DB::table('ecommerce_stores')
            ->where('company_id', $company)
            ->orderBy('created_at')
            ->orderBy('id')
            ->first();
        if ($existing) {
            return $existing;
        }

        $id = 'ecommerce-store-'.$company;
        if (DB::table('ecommerce_stores')->where('id', $id)->exists()) {
            $id = $this->id('store');
        }
        $baseSlug = Str::slug($company).'-boutique';
        $slug = $baseSlug;
        $suffix = 2;
        while (DB::table('ecommerce_stores')->where('slug', $slug)->exists()) {
            $slug = $baseSlug.'-'.$suffix++;
        }

        return (object) [
            'id' => $id,
            'company_id' => $company,
            'slug' => $slug,
            'name' => 'Boutique '.Str::headline($company),
            'description' => 'Découvrez notre sélection et commandez en ligne.',
            'status' => 'DRAFT',
            'currency' => 'XOF',
            'primary_color' => '#D69E2E',
            'accent_color' => '#172033',
            'logo_url' => '',
        ];
    }

    private function uniqueStoreSlug(string $requested, string $ignoreId): string
    {
        $base = Str::slug(trim($requested));
        if ($base === '') {
            $base = 'boutique';
        }

        $slug = $base;
        $suffix = 2;
        while (DB::table('ecommerce_stores')
            ->where('slug', $slug)
            ->where('id', '!=', $ignoreId)
            ->exists()) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    private function allowed(Request $request, string $action, ?string $feature = null): bool
    {
        $actor = $request->attributes->get('authActor');

        return is_array($actor) && ModuleAuthorization::allows($actor, 'ecommerce', $action, $feature);
    }

    private function company(Request $request): string
    {
        return (string) $request->attributes->get('companyId');
    }

    private function id(string $prefix): string
    {
        return $prefix.'-'.Str::uuid();
    }

    private function snake(array $input): array
    {
        return collect($input)->mapWithKeys(fn ($value, $key) => [Str::snake($key) => $value])->all();
    }

    private function forbidden(string $message = 'Cette action n’est pas autorisée pour votre rôle.'): JsonResponse
    {
        return response()->json(['error' => $message], 403);
    }
}