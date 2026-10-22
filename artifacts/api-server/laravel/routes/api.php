<?php

use App\Http\Controllers\Api\AppStateController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\CompanyNavigationSettingsController;
use App\Http\Controllers\Api\CompanyPaymentController;
use App\Http\Controllers\Api\CompanyPublicSiteAccessController;
use App\Http\Controllers\Api\CompanyPublicSiteDomainsController;
use App\Http\Controllers\Api\CompanyPublicSiteSettingsController;
use App\Http\Controllers\Api\CompanyPushNotificationAccessController;
use App\Http\Controllers\Api\DemoWorkspaceController;
use App\Http\Controllers\Api\DiagnosticTokenController;
use App\Http\Controllers\Api\EcommerceSubscriptionController;
use App\Http\Controllers\Api\InstallationAccessController;
use App\Http\Controllers\Api\InstallationController;
use App\Http\Controllers\Api\MaximusAssistantController;
use App\Http\Controllers\Api\MaximusWalletController;
use App\Http\Controllers\Api\MobileAuthController;
use App\Http\Controllers\Api\ModuleController;
use App\Http\Controllers\Api\NotificationPushController;
use App\Http\Controllers\Api\OnboardingDraftController;
use App\Http\Controllers\Api\PlatformSettingsController;
use App\Http\Controllers\Api\SubscriptionBillingController;
use App\Http\Controllers\Api\SystemHealthController;
use App\Support\ApplicationIdentity;
use App\Support\InstallationContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'ok' => true,
        'service' => 'MAXIMUS API',
        'health' => '/api/healthz',
    ]);
});

Route::get('/healthz', function () {
    try {
        return response()->json([
            'ok' => DB::select('select 1') !== [],
            'database' => true,
            'status' => 'OPERATIONAL',
            'applicationVersion' => ApplicationIdentity::deployedVersion(),
            'syncProtocolVersion' => ApplicationIdentity::SYNC_PROTOCOL_VERSION,
            'checkedAt' => now()->toISOString(),
        ]);
    } catch (Throwable $exception) {
        report($exception);

        return response()->json(['ok' => false, 'database' => false, 'status' => 'DOWN'], 503);
    }
});

Route::get('/installation', function () {
    return response()->json(InstallationContext::publicProfile());
});

Route::middleware('maximus.central')->group(function (): void {
    Route::get('/registration-catalog', [AppStateController::class, 'registrationCatalog']);
    Route::post('/company-requests', [CompanyController::class, 'createRequest'])->middleware('throttle:login');
});

Route::prefix('onboarding/drafts')->middleware(['maximus.central', 'throttle:onboarding'])->group(function (): void {
    Route::post('/', [OnboardingDraftController::class, 'store']);
    Route::get('/{draftId}', [OnboardingDraftController::class, 'show']);
    Route::put('/{draftId}', [OnboardingDraftController::class, 'update']);
    Route::post('/{draftId}/confirm', [OnboardingDraftController::class, 'confirm']);
});

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('/mobile/login', [MobileAuthController::class, 'login'])->middleware('throttle:login');
    Route::middleware('maximus.auth')->group(function (): void {
        Route::get('/mobile/session', [MobileAuthController::class, 'session']);
        Route::post('/mobile/logout', [MobileAuthController::class, 'logout']);
        Route::post('/heartbeat', [AuthController::class, 'heartbeat']);
    });
    Route::get('/company-login/{slug}', [AuthController::class, 'companyLoginInfo'])
        ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*');
    Route::post('/company-login/{slug}', [AuthController::class, 'companyLogin'])
        ->middleware('throttle:login')
        ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*');
    Route::get('/session', [AuthController::class, 'session']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

Route::middleware(['maximus.central', 'maximus.auth'])->prefix('company-requests')->group(function (): void {
    Route::get('/', [CompanyController::class, 'index']);
    Route::post('/{companyId}/approve', [CompanyController::class, 'approve']);
    Route::post('/{companyId}/reject', [CompanyController::class, 'reject']);
});

Route::middleware('maximus.auth')->prefix('companies')->group(function (): void {
    Route::get('/{companyId}/navigation-settings', [CompanyNavigationSettingsController::class, 'show']);
    Route::patch('/{companyId}/navigation-settings', [CompanyNavigationSettingsController::class, 'update']);
    Route::patch('/{companyId}/demo-mode', [DemoWorkspaceController::class, 'update']);
});

Route::middleware(['maximus.central', 'maximus.auth'])->prefix('companies')->group(function (): void {
    Route::get('/connectivity', [CompanyController::class, 'connectivity']);
    Route::post('/', [CompanyController::class, 'createAdministrative']);
    Route::patch('/{companyId}/deletion-lock', [CompanyController::class, 'updateDeletionLock']);
    Route::get('/{companyId}/login-settings', [CompanyController::class, 'loginSettings']);
    Route::patch('/{companyId}/login-settings', [CompanyController::class, 'updateLoginSettings']);
    Route::get('/{companyId}/installation-manifest', [CompanyController::class, 'installationManifest']);
    Route::post('/{companyId}/installation', [InstallationController::class, 'issue']);
    Route::delete('/{companyId}/installation', [InstallationController::class, 'revoke']);
    Route::post('/{companyId}/installations/{installationId}', [InstallationController::class, 'issue']);
    Route::delete('/{companyId}/installations/{installationId}', [InstallationController::class, 'revoke']);
    Route::get('/{companyId}/installation-access', [InstallationAccessController::class, 'index']);
    Route::post('/{companyId}/installation-access/{installationId}/use-as-primary', [InstallationAccessController::class, 'useAsPrimary']);
    Route::delete('/{companyId}/installation-access/primary', [InstallationAccessController::class, 'clearPrimary']);
    Route::post('/{companyId}/installation-access/{installationId}/addresses', [InstallationAccessController::class, 'store']);
    Route::post('/{companyId}/installation-access/{installationId}/addresses/{addressId}/verify', [InstallationAccessController::class, 'verify']);
    Route::post('/{companyId}/installation-access/{installationId}/addresses/{addressId}/activate', [InstallationAccessController::class, 'activate']);
    Route::delete('/{companyId}/installation-access/{installationId}/addresses/{addressId}', [InstallationAccessController::class, 'destroy']);
    Route::get('/{companyId}/payment-settings', [CompanyPaymentController::class, 'show']);
    Route::patch('/{companyId}/payment-settings', [CompanyPaymentController::class, 'update']);
    Route::get('/{companyId}/public-site-access', [CompanyPublicSiteAccessController::class, 'show']);
    Route::patch('/{companyId}/public-site-access', [CompanyPublicSiteAccessController::class, 'update']);
    Route::get('/{companyId}/notifications/push-access', [CompanyPushNotificationAccessController::class, 'show']);
    Route::patch('/{companyId}/notifications/push-access', [CompanyPushNotificationAccessController::class, 'update']);
    Route::delete('/{companyId}', [CompanyController::class, 'destroy']);
});

Route::middleware(['maximus.auth', 'maximus.subscription'])->prefix('companies')->group(function (): void {
    Route::patch('/{companyId}', [CompanyController::class, 'update']);
    Route::post('/{companyId}/profile-photo', [CompanyController::class, 'uploadProfilePhoto']);
    Route::delete('/{companyId}/profile-photo', [CompanyController::class, 'deleteProfilePhoto']);
});

Route::middleware(['maximus.central', 'maximus.installation.token'])->prefix('installation-sync')->group(function (): void {
    Route::get('/configuration', [InstallationController::class, 'configuration']);
    Route::post('/heartbeat', [InstallationController::class, 'heartbeat']);
});

Route::get('/company-profile-images/{companyId}/{filename}', [CompanyController::class, 'serveProfilePhoto'])
    ->middleware('maximus.installation.public')
    ->where(['companyId' => '[A-Za-z0-9_-]+', 'filename' => '[A-Za-z0-9_.-]+']);

Route::middleware(['maximus.auth', 'maximus.subscription', 'maximus.demo-data'])->prefix('auth/accounts')->group(function (): void {
    Route::post('/', [AuthController::class, 'createAccount'])->middleware('maximus.demo-identity');
    Route::delete('/{employeeId}', [AuthController::class, 'deleteAccount'])->middleware('maximus.demo-identity');
});

Route::middleware(['maximus.auth', 'maximus.company', 'maximus.subscription', 'maximus.demo-live-config'])
    ->prefix('company-public-site')
    ->group(function (): void {
        Route::get('/', [CompanyPublicSiteSettingsController::class, 'show']);
        Route::patch('/', [CompanyPublicSiteSettingsController::class, 'update']);
        Route::post('/logo', [CompanyPublicSiteSettingsController::class, 'uploadLogo']);
        Route::post('/hero-images', [CompanyPublicSiteSettingsController::class, 'uploadHeroImages']);
        Route::delete('/hero-images/{imageId}', [CompanyPublicSiteSettingsController::class, 'deleteHeroImage']);
        Route::get('/domains', [CompanyPublicSiteDomainsController::class, 'index']);
        Route::post('/domains', [CompanyPublicSiteDomainsController::class, 'store']);
        Route::post('/domains/{id}/verify', [CompanyPublicSiteDomainsController::class, 'verify']);
        Route::delete('/domains/{id}', [CompanyPublicSiteDomainsController::class, 'destroy']);
    });

Route::middleware('maximus.auth')->prefix('auth/company-admins')->group(function (): void {
    Route::post('/', [AuthController::class, 'provisionCompanyAdmin']);
});

Route::middleware(['maximus.auth', 'maximus.company', 'maximus.subscription', 'maximus.demo-data', 'maximus.demo-identity'])
    ->patch('/auth/company-password', [AuthController::class, 'updateCompanyPassword']);

Route::middleware(['maximus.auth', 'maximus.company', 'maximus.subscription'])->prefix('modules')->group(function (): void {
    Route::get('/bootstrap', [ModuleController::class, 'bootstrap']);
    Route::patch('/{moduleId}/access', [ModuleController::class, 'setAccess']);
});

Route::middleware(['maximus.auth', 'maximus.subscription'])->prefix('app-state')->group(function (): void {
    Route::get('/bootstrap', [AppStateController::class, 'bootstrap']);
    Route::put('/', [AppStateController::class, 'save']);
});

Route::middleware('maximus.auth')->prefix('notifications/push')->group(function (): void {
    Route::get('/access', [NotificationPushController::class, 'access']);
    Route::get('/public-key', [NotificationPushController::class, 'publicKey'])
        ->middleware('maximus.subscription');
    Route::post('/subscriptions', [NotificationPushController::class, 'subscribe'])
        ->middleware('maximus.subscription');
    Route::delete('/subscriptions', [NotificationPushController::class, 'unsubscribe']);
});

Route::middleware(['maximus.central', 'maximus.auth'])->prefix('platform-settings')->group(function (): void {
    Route::get('/subscription-billing', [SubscriptionBillingController::class, 'platformIndex']);
    Route::put('/subscription-billing/modules/{moduleId}', [SubscriptionBillingController::class, 'updateModulePrice']);
    Route::put('/subscription-billing/companies/{companyId}', [SubscriptionBillingController::class, 'updateCompanyPrice']);
    Route::get('/ecommerce-subscriptions', [EcommerceSubscriptionController::class, 'index']);
    Route::put('/ecommerce-subscriptions/{companyId}', [EcommerceSubscriptionController::class, 'update']);
    Route::get('/public-registration', [PlatformSettingsController::class, 'publicRegistration']);
    Route::put('/public-registration', [PlatformSettingsController::class, 'updatePublicRegistration']);
    Route::get('/seller-wallet-maturity', [PlatformSettingsController::class, 'sellerWalletMaturity']);
    Route::put('/seller-wallet-maturity', [PlatformSettingsController::class, 'updateSellerWalletMaturity']);
    Route::get('/seller-wallet-withdrawal-fee', [PlatformSettingsController::class, 'sellerWalletWithdrawalFee']);
    Route::put('/seller-wallet-withdrawal-fee', [PlatformSettingsController::class, 'updateSellerWalletWithdrawalFee']);
    Route::get('/ecommerce-commission', [PlatformSettingsController::class, 'ecommerceCommission']);
    Route::put('/ecommerce-commission', [PlatformSettingsController::class, 'updateEcommerceCommission']);
    Route::get('/maximus-wallet', [MaximusWalletController::class, 'bootstrap']);
    Route::patch('/maximus-wallet/payout-account', [MaximusWalletController::class, 'updatePayoutAccount']);
    Route::post('/maximus-wallet/withdrawals', [MaximusWalletController::class, 'requestWithdrawal'])->middleware('throttle:withdrawals');
    Route::get('/diagnostic-tokens', [DiagnosticTokenController::class, 'index']);
    Route::post('/diagnostic-tokens', [DiagnosticTokenController::class, 'store']);
    Route::delete('/diagnostic-tokens/{id}', [DiagnosticTokenController::class, 'revoke']);
});

Route::middleware(['maximus.auth', 'maximus.company'])->prefix('company-subscription')->group(function (): void {
    Route::get('/', [SubscriptionBillingController::class, 'showForCompany']);
    Route::get('/status', [SubscriptionBillingController::class, 'statusForCompanyMembers']);
    Route::post('/payments', [SubscriptionBillingController::class, 'createPayment'])->middleware(['maximus.demo-data', 'maximus.demo-money', 'throttle:withdrawals']);
    Route::get('/payments/{paymentId}', [SubscriptionBillingController::class, 'paymentStatus']);
});
Route::post(
    '/payments/diamanopay/subscription-webhook',
    [SubscriptionBillingController::class, 'webhook'],
)->middleware('throttle:withdrawals');

Route::middleware(['maximus.central', 'maximus.auth'])->post('/maximus-assistant/ask', [MaximusAssistantController::class, 'ask']);
Route::middleware(['maximus.central', 'maximus.auth'])->prefix('maximus-assistant/plans')->group(function (): void {
    Route::get('/', [MaximusAssistantController::class, 'listPlans']);
    Route::post('/', [MaximusAssistantController::class, 'preparePlan'])->middleware('throttle:20,1');
    Route::get('/{id}', [MaximusAssistantController::class, 'showPlan'])->whereUuid('id');
    Route::post('/{id}/preview', [MaximusAssistantController::class, 'previewPlan'])->whereUuid('id');
    Route::post('/{id}/execute', [MaximusAssistantController::class, 'executePlan'])->whereUuid('id');
    Route::post('/{id}/cancel', [MaximusAssistantController::class, 'cancelPlan'])->whereUuid('id');
});
Route::middleware(['maximus.central', 'maximus.auth'])->prefix('maximus-assistant/actions')->group(function (): void {
    Route::post('/preview', [MaximusAssistantController::class, 'previewAction']);
    Route::post('/execute', [MaximusAssistantController::class, 'executeAction']);
});

Route::middleware('maximus.diagnostic')->get('/diagnostics/health', [SystemHealthController::class, 'show']);

require __DIR__.'/control.php';
require __DIR__.'/presence.php';
require __DIR__.'/stock.php';
require __DIR__.'/ecommerce.php';
require __DIR__.'/payroll.php';
require __DIR__.'/transport.php';
require __DIR__.'/immobilier.php';
require __DIR__.'/amicales.php';
