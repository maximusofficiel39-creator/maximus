<?php

use App\Http\Controllers\Api\EcommerceController;
use App\Http\Controllers\Api\EcommerceCustomerController;
use App\Http\Controllers\Api\EcommercePaymentController;
use App\Http\Controllers\Api\EcommercePosController;
use App\Http\Controllers\Api\EcommerceSalesReportController;
use App\Http\Controllers\Api\SellerWalletController;
use App\Http\Controllers\Api\CarRentalController;
use Illuminate\Support\Facades\Route;

Route::post('/payments/diamanopay/webhook', [SellerWalletController::class, 'webhook']);

Route::middleware(['maximus.auth', 'maximus.company', 'maximus.subscription', 'maximus.demo-data', 'maximus.module:ecommerce'])
    ->prefix('ecommerce')
    ->group(function (): void {
        Route::get('/bootstrap', [EcommerceController::class, 'bootstrap']);
        Route::get('/pos-sales', [EcommercePosController::class, 'index']);
        Route::post('/pos-sales', [EcommercePosController::class, 'store'])->middleware('throttle:60,1');
        Route::get('/pos-expenses', [EcommercePosController::class, 'expenses']);
        Route::post('/pos-expenses', [EcommercePosController::class, 'createExpense'])->middleware('throttle:60,1');
        Route::get('/expense-categories', [\App\Http\Controllers\Api\EcommerceExpenseCategoryController::class, 'index']);
        Route::post('/expense-categories', [\App\Http\Controllers\Api\EcommerceExpenseCategoryController::class, 'store'])->middleware('throttle:60,1');
        Route::patch('/expense-categories/{id}', [\App\Http\Controllers\Api\EcommerceExpenseCategoryController::class, 'update']);
        Route::get('/sales-report', [EcommerceSalesReportController::class, 'index']);
        Route::get('/wallet', [SellerWalletController::class, 'bootstrap']);
        Route::post('/wallet/reconcile', [SellerWalletController::class, 'reconcilePayments'])->middleware('maximus.demo-money');
        Route::patch('/wallet/payout-account', [SellerWalletController::class, 'updatePayoutAccount']);
        Route::post('/wallet/withdrawals', [SellerWalletController::class, 'requestWithdrawal'])->middleware(['throttle:withdrawals', 'maximus.demo-money']);
        Route::patch('/store', [EcommerceController::class, 'updateStore']);
        Route::post('/store/logo', [EcommerceController::class, 'uploadStoreLogo']);
        Route::post('/store/hero-images', [EcommerceController::class, 'uploadStoreHeroImages']);
        Route::delete('/store/hero-images/{imageId}', [EcommerceController::class, 'deleteStoreHeroImage']);
        Route::post('/categories', [EcommerceController::class, 'createCategory']);
        Route::patch('/categories/{id}', [EcommerceController::class, 'updateCategory']);
        Route::delete('/categories/{id}', [EcommerceController::class, 'deleteCategory']);
        Route::post('/domains', [EcommerceController::class, 'createDomain']);
        Route::post('/domains/{id}/verify', [EcommerceController::class, 'verifyDomain']);
        Route::delete('/domains/{id}', [EcommerceController::class, 'deleteDomain']);
        Route::post('/products', [EcommerceController::class, 'createProduct']);
        Route::post('/products/{id}/image', [EcommerceController::class, 'uploadProductImage']);
        Route::post('/products/{id}/gallery', [EcommerceController::class, 'uploadProductGallery']);
        Route::delete('/products/{id}/gallery/{imageId}', [EcommerceController::class, 'deleteProductGalleryImage']);
        Route::post('/products/{id}/digital-file', [EcommerceController::class, 'uploadDigitalFile']);
        Route::patch('/products/{id}', [EcommerceController::class, 'updateProduct']);
        Route::delete('/products/{id}', [EcommerceController::class, 'archiveProduct']);
          Route::post('/rentals', [EcommerceController::class, 'createRental']);
          Route::post('/rentals/{id}/image', [EcommerceController::class, 'uploadRentalImage']);
          Route::post('/rentals/{id}/gallery', [EcommerceController::class, 'uploadRentalGallery']);
          Route::delete('/rentals/{id}/gallery/{imageId}', [EcommerceController::class, 'deleteRentalGalleryImage']);
         Route::patch('/rentals/{id}', [EcommerceController::class, 'updateRental']);
         Route::patch('/rentals/{id}/availability', [EcommerceController::class, 'setRentalAvailability']);
         Route::delete('/rentals/{id}', [EcommerceController::class, 'archiveRental']);
         Route::get('/location/settings', [CarRentalController::class, 'settings']);
         Route::put('/location/settings', [CarRentalController::class, 'saveSettings']);
         Route::get('/location/reservations', [CarRentalController::class, 'reservations']);
          Route::patch('/location/reservations/{id}/status', [CarRentalController::class, 'transition']);
         Route::get('/location/reservations/{id}/invoice', [CarRentalController::class, 'invoice']);
        Route::patch('/orders/{id}/status', [EcommerceController::class, 'updateOrderStatus']);
         Route::get('/orders/{id}/attachments/{attachmentId}', [EcommerceController::class, 'downloadOrderAttachment']);
        Route::get('/delivery-requests', [EcommerceController::class, 'deliveryRequests']);
        Route::patch('/delivery-requests/{id}/status', [EcommerceController::class, 'updateDeliveryRequestStatus']);
         Route::post('/delivery-zones', [EcommerceController::class, 'createDeliveryZone']);
         Route::patch('/delivery-zones/{id}', [EcommerceController::class, 'updateDeliveryZone']);
         Route::delete('/delivery-zones/{id}', [EcommerceController::class, 'deleteDeliveryZone']);
    });

Route::middleware('maximus.installation.public')->group(function (): void {
Route::get('/product-images/{company}/{filename}', [EcommerceController::class, 'serveProductImage'])
    ->where(['company' => '[A-Za-z0-9_-]+', 'filename' => '[A-Za-z0-9_.-]+']);
Route::get('/store-logos/{company}/{filename}', [EcommerceController::class, 'serveStoreLogo'])
    ->where(['company' => '[A-Za-z0-9_-]+', 'filename' => '[A-Za-z0-9_.-]+']);
Route::get('/rental-images/{company}/{filename}', [EcommerceController::class, 'serveRentalImage'])
    ->where(['company' => '[A-Za-z0-9_-]+', 'filename' => '[A-Za-z0-9_.-]+']);
Route::get('/gallery-images/{company}/{imageId}', [EcommerceController::class, 'serveGalleryImage'])
    ->where(['company' => '[A-Za-z0-9_-]+', 'imageId' => '[A-Za-z0-9_-]+']);

Route::middleware('maximus.public-site')->group(function (): void {
Route::get('/shop-domain', [EcommerceController::class, 'publicBootstrapByDomain']);
Route::get('/shop-domain/location/{id}/quote', [CarRentalController::class, 'quoteDomain']);
Route::post('/shop-domain/location/reservations', [CarRentalController::class, 'reserveDomain'])->middleware('throttle:orders');
Route::get('/shop-domain/location/reservations/{id}/invoice', [CarRentalController::class, 'publicInvoiceDomain']);
Route::get('/shop-domain/manifest.webmanifest', [EcommerceController::class, 'publicManifestByDomain']);
Route::post('/shop-domain/orders', [EcommerceController::class, 'createPublicDomainOrder'])->middleware('throttle:orders');
Route::post('/shop-domain/delivery-requests', [EcommerceController::class, 'createPublicDomainDeliveryRequest'])->middleware('throttle:orders');
Route::get('/shop-domain/orders/{orderId}/payment-status', [EcommercePaymentController::class, 'statusByDomain']);

Route::prefix('shop/{slug}')->group(function (): void {
    Route::get('/manifest.webmanifest', [EcommerceController::class, 'publicManifest']);
    Route::get('/', [EcommerceController::class, 'publicBootstrap']);
    Route::get('/location/{id}/quote', [CarRentalController::class, 'quote']);
    Route::post('/location/reservations', [CarRentalController::class, 'reserve'])->middleware('throttle:orders');
    Route::get('/location/reservations/{id}/invoice', [CarRentalController::class, 'publicInvoice']);
    Route::post('/orders', [EcommerceController::class, 'createPublicOrder'])->middleware('throttle:orders');
    Route::post('/delivery-requests', [EcommerceController::class, 'createPublicDeliveryRequest'])->middleware('throttle:orders');
    Route::post('/orders/{orderId}/payment', [EcommercePaymentController::class, 'create'])->middleware('throttle:orders');
    Route::get('/orders/{orderId}/payment-status', [EcommercePaymentController::class, 'status']);
    Route::get('/customer/session', [EcommerceCustomerController::class, 'session']);
    Route::post('/customer/register', [EcommerceCustomerController::class, 'register'])->middleware('throttle:login');
    Route::post('/customer/login', [EcommerceCustomerController::class, 'login'])->middleware('throttle:login');
    Route::get('/customer/bootstrap', [EcommerceCustomerController::class, 'bootstrap']);
    Route::patch('/customer/profile', [EcommerceCustomerController::class, 'updateProfile']);
    Route::patch('/customer/password', [EcommerceCustomerController::class, 'changePassword']);
    Route::get('/customer/addresses', [EcommerceCustomerController::class, 'listAddresses']);
    Route::post('/customer/addresses', [EcommerceCustomerController::class, 'createAddress']);
    Route::patch('/customer/addresses/{id}', [EcommerceCustomerController::class, 'updateAddress']);
    Route::delete('/customer/addresses/{id}', [EcommerceCustomerController::class, 'deleteAddress']);
    Route::get('/customer/favorites', [EcommerceCustomerController::class, 'favorites']);
    Route::post('/customer/favorites/{productSlug}', [EcommerceCustomerController::class, 'toggleFavorite']);
    Route::get('/customer/cart', [EcommerceCustomerController::class, 'cart']);
    Route::put('/customer/cart', [EcommerceCustomerController::class, 'putCartItem']);
    Route::delete('/customer/cart', [EcommerceCustomerController::class, 'clearCart']);
    Route::get('/customer/orders', [EcommerceCustomerController::class, 'orders']);
    Route::get('/customer/orders/{id}', [EcommerceCustomerController::class, 'order']);
    Route::get('/customer/orders/{id}/attachments/{attachmentId}', [EcommerceCustomerController::class, 'downloadOrderAttachment']);
     Route::get('/customer/orders/{id}/items/{itemId}/download', [EcommerceCustomerController::class, 'downloadDigitalProduct']);
    Route::get('/customer/delivery-requests', [EcommerceCustomerController::class, 'deliveryRequests']);
});

Route::get('/shop-domain/customer/session', [EcommerceCustomerController::class, 'session']);
Route::post('/shop-domain/customer/register', [EcommerceCustomerController::class, 'register'])->middleware('throttle:login');
Route::post('/shop-domain/customer/login', [EcommerceCustomerController::class, 'login'])->middleware('throttle:login');
Route::get('/shop-domain/customer/bootstrap', [EcommerceCustomerController::class, 'bootstrap']);
Route::patch('/shop-domain/customer/profile', [EcommerceCustomerController::class, 'updateProfile']);
Route::patch('/shop-domain/customer/password', [EcommerceCustomerController::class, 'changePassword']);
Route::get('/shop-domain/customer/addresses', [EcommerceCustomerController::class, 'listAddresses']);
Route::post('/shop-domain/customer/addresses', [EcommerceCustomerController::class, 'createAddress']);
Route::patch('/shop-domain/customer/addresses/{id}', [EcommerceCustomerController::class, 'updateAddress']);
Route::delete('/shop-domain/customer/addresses/{id}', [EcommerceCustomerController::class, 'deleteAddress']);
Route::get('/shop-domain/customer/favorites', [EcommerceCustomerController::class, 'favorites']);
Route::post('/shop-domain/customer/favorites/{productSlug}', [EcommerceCustomerController::class, 'toggleFavorite']);
Route::get('/shop-domain/customer/cart', [EcommerceCustomerController::class, 'cart']);
Route::put('/shop-domain/customer/cart', [EcommerceCustomerController::class, 'putCartItem']);
Route::delete('/shop-domain/customer/cart', [EcommerceCustomerController::class, 'clearCart']);
Route::get('/shop-domain/customer/orders', [EcommerceCustomerController::class, 'orders']);
Route::get('/shop-domain/customer/orders/{id}', [EcommerceCustomerController::class, 'order']);
Route::get('/shop-domain/customer/orders/{id}/attachments/{attachmentId}', [EcommerceCustomerController::class, 'downloadOrderAttachment']);
 Route::get('/shop-domain/customer/orders/{id}/items/{itemId}/download', [EcommerceCustomerController::class, 'downloadDigitalProduct']);
Route::get('/shop-domain/customer/delivery-requests', [EcommerceCustomerController::class, 'deliveryRequests']);
Route::post('/shop-domain/orders/{orderId}/payment', [EcommercePaymentController::class, 'createByDomain'])->middleware('throttle:orders');
Route::post('/shop-domain/customer/logout', [EcommerceCustomerController::class, 'logout']);
Route::post('/shop/{slug}/customer/logout', [EcommerceCustomerController::class, 'logout']);
});
});