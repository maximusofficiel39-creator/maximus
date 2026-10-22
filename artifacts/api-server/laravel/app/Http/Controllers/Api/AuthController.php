<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuthSession;
use App\Models\AuthUser;
use App\Models\Company;
use App\Support\CompanyAuthorization;
use App\Support\InstallationContext;
use App\Support\MaximusAuth;
use App\Support\MaximusPassword;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:200'],
        ]);

        $userQuery = AuthUser::query()
            ->where('email', Str::lower(trim($data['email'])))
            ->where('status', 'ACTIF');
        if (InstallationContext::isCompanyOnly()) {
            $companyId = InstallationContext::companyId();
            if ($companyId === null) {
                return response()->json([
                    'error' => 'L’installation entreprise n’est pas encore configurée.',
                    'code' => 'INSTALLATION_NOT_CONFIGURED',
                ], 503);
            }
            $userQuery->where('company_id', $companyId);
        }
        $user = $userQuery->first();

        if (
            ! $user
            || ! MaximusPassword::check($data['password'], $user->password_hash)
        ) {
            return response()->json([
                'error' => 'Email ou mot de passe incorrect.',
            ], 401);
        }

        if (($denial = MaximusAuth::dedicatedAccessDenial($user)) !== null) {
            return response()->json($denial, 403);
        }
        if (
            InstallationContext::isCentral()
            &&
            $user->company_id !== null
            && (bool) ($company = Company::query()->whereKey($user->company_id)->where('status', 'ACTIF')->whereNull('deleted_at')->first())?->login_custom_allowed
            && (($company->login_mode ?: 'MAXIMUS') === 'CUSTOM')
        ) {
            return response()->json([
                'code' => 'COMPANY_CUSTOM_LOGIN',
                'error' => 'Connexion refusée : cette entreprise utilise une page de connexion personnalisée. Utilisez le lien personnalisé communiqué par MAXIMUS ou par son administrateur.',
            ], 403);
        }
        if (!MaximusAuth::canAuthenticate($user)) {
            return response()->json(['error' => 'Email ou mot de passe incorrect.'], 401);
        }

        if (MaximusPassword::needsRehash($user->password_hash)) {
            $user->update([
                'password_hash' => MaximusPassword::hash($data['password']),
                'updated_at' => now(),
            ]);
        }

        $token = MaximusAuth::issueSession($user);
        $this->recordLoginActivity($user);

        return response()
            ->json(['user' => MaximusAuth::actor($user)])
            ->withCookie(cookie(
                MaximusAuth::COOKIE,
                $token,
                MaximusAuth::sessionCookieMinutes($user),
                '/',
                null,
                app()->environment('production'),
                true,
                false,
                'lax',
            ));
    }

    public function companyLoginInfo(string $slug): JsonResponse
    {
        $company = Company::query()
            ->where('login_slug', $slug)
            ->where('status', 'ACTIF')
            ->whereNull('deleted_at')
            ->first();

        if (InstallationContext::isCompanyOnly() && (!$company || $company->id !== InstallationContext::companyId())) {
            return response()->json(['error' => 'Cette entreprise ne correspond pas à cette installation.'], 404);
        }

        if (! $company || ! $company->login_custom_allowed || ($company->login_mode ?: 'MAXIMUS') !== 'CUSTOM') {
            return response()->json(['error' => 'Cette connexion personnalisée est indisponible.'], 404);
        }

        return response()->json([
            'company' => [
                'name' => (string) $company->name,
                'slug' => (string) $company->login_slug,
                'profilePhoto' => $company->profile_photo,
                'primaryColor' => $company->primary_color ?: '#F2B705',
                'accentColor' => $company->accent_color ?: ($company->primary_color ?: '#F2B705'),
                'sidebarColor' => $company->sidebar_color ?: '#161D27',
            ],
        ]);
    }

    public function companyLogin(Request $request, string $slug): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:200'],
        ]);
        $company = Company::query()
            ->where('login_slug', $slug)
            ->where('status', 'ACTIF')
            ->whereNull('deleted_at')
            ->first();

        if (InstallationContext::isCompanyOnly() && (!$company || $company->id !== InstallationContext::companyId())) {
            return response()->json(['error' => 'Cette entreprise ne correspond pas à cette installation.'], 404);
        }

        if (! $company || ! $company->login_custom_allowed || ($company->login_mode ?: 'MAXIMUS') !== 'CUSTOM') {
            return response()->json(['error' => 'Cette connexion personnalisée est indisponible.'], 404);
        }

        $user = AuthUser::query()
            ->where('company_id', $company->id)
            ->where('email', Str::lower(trim($data['email'])))
            ->where('status', 'ACTIF')
            ->first();
        if (! $user || ! MaximusPassword::check($data['password'], $user->password_hash)) {
            return response()->json(['error' => 'Email ou mot de passe incorrect.'], 401);
        }
        if (($denial = MaximusAuth::dedicatedAccessDenial($user)) !== null) {
            return response()->json($denial, 403);
        }
        if (!MaximusAuth::canAuthenticate($user)) {
            return response()->json(['error' => 'Email ou mot de passe incorrect.'], 401);
        }
        if (MaximusPassword::needsRehash($user->password_hash)) {
            $user->update(['password_hash' => MaximusPassword::hash($data['password']), 'updated_at' => now()]);
        }

        $token = MaximusAuth::issueSession($user);
        $this->recordLoginActivity($user);
        return response()
            ->json(['user' => MaximusAuth::actor($user)])
            ->withCookie(cookie(
                MaximusAuth::COOKIE,
                $token,
                MaximusAuth::sessionCookieMinutes($user),
                '/',
                null,
                app()->environment('production'),
                true,
                false,
                'lax',
            ));
    }

    public function createAccount(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => ['required', 'string', 'min:1'],
            'email' => ['required', 'email', 'max:255'],
            'displayName' => ['required', 'string', 'min:1', 'max:180'],
            'phone' => ['nullable', 'string', 'max:40'],
            'companyId' => ['required', 'string', 'min:1'],
            'employeeId' => ['required', 'string', 'min:1'],
            'sectorId' => ['nullable', 'string', 'min:1'],
            'sectorIds' => ['required', 'array', 'min:1'],
            'sectorIds.*' => ['string', 'min:1'],
            'role' => ['required', 'in:sector_manager,employee'],
            'password' => ['nullable', 'string', 'min:8', 'max:200'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['array'],
            'permissions.*.*' => ['string', 'min:1'],
        ]);
        $actor = $request->attributes->get('authActor');
        $actorRole = $actor['role'] ?? null;
        $existingQuery = AuthUser::query()->where('employee_id', $data['employeeId']);
        if ($actorRole !== 'maximus_admin') {
            $existingQuery->where('company_id', $data['companyId']);
        }
        $existing = $existingQuery->first();

        $workspaceState = null;
        if ($actorRole === 'sector_manager') {
            $stateRow = DB::table('maximus_app_states')->where('scope', 'workspace')->first(['payload']);
            $workspaceState = is_string($stateRow?->payload)
                ? json_decode($stateRow->payload, true)
                : ($stateRow?->payload ?? []);
            if (! is_array($workspaceState)) {
                $workspaceState = [];
            }
        }

        if (! CompanyAuthorization::canManageAccount(
            $actor,
            $data['companyId'],
            $data['sectorIds'],
            $workspaceState,
        )) {
            return response()->json(['error' => 'Provisionnement du compte hors périmètre autorisé.'], 403);
        }

        if ($existing
            && $actorRole === 'sector_manager'
            && ! CompanyAuthorization::canManageAccount(
                $actor,
                (string) $existing->company_id,
                is_array($existing->sector_ids) ? $existing->sector_ids : [],
                $workspaceState,
            )) {
            return response()->json(['error' => 'Le compte existant est hors périmètre administrable.'], 403);
        }

        if ($actorRole === 'sector_manager') {
            $sectorId = trim((string) ($data['sectorId'] ?? ''));
            $targetSectorIds = array_values(array_unique(array_map('strval', $data['sectorIds'])));
            if ($sectorId === ''
                || ! in_array($sectorId, $targetSectorIds, true)
                || ($data['role'] === 'employee' && $targetSectorIds !== [$sectorId])
                || ($data['role'] === 'sector_manager'
                    && (! $existing || $existing->role !== 'sector_manager'))) {
                return response()->json(['error' => 'Le secteur ou le rôle demandé dépasse le périmètre administrable.'], 403);
            }
            if (! CompanyAuthorization::canAssignPermissions(
                $actor,
                $data['permissions'] ?? [],
                $workspaceState,
                $sectorId,
            )) {
                return response()->json([
                    'error' => 'Les permissions dépassent les modules, fonctionnalités ou actions autorisés pour cette unité.',
                ], 403);
            }
        } elseif (! CompanyAuthorization::canAssignPermissions($actor, $data['permissions'] ?? [])) {
            return response()->json(['error' => 'Permissions du compte hors périmètre autorisé.'], 403);
        }

        if (! $existing && empty($data['password'])) {
            return response()->json(['error' => 'Un mot de passe initial est requis pour ce compte.'], 400);
        }

        $values = [
            'email' => Str::lower(trim($data['email'])),
            'display_name' => trim($data['displayName']),
            'phone' => trim((string) ($data['phone'] ?? '')),
            'role' => $data['role'],
            'company_id' => $data['companyId'],
            'employee_id' => $data['employeeId'],
            'sector_ids' => $data['sectorIds'],
            'permissions' => $data['permissions'] ?? [],
            'status' => 'ACTIF',
            'updated_at' => now(),
        ];
        if (! empty($data['password'])) {
            $values['password_hash'] = MaximusPassword::hash($data['password']);
        }

        try {
            if ($existing) {
                $scopeChanged = $existing->company_id !== $data['companyId']
                    || $existing->role !== $data['role']
                    || $existing->employee_id !== $data['employeeId']
                    || (is_array($existing->sector_ids) ? $existing->sector_ids : []) !== $data['sectorIds'];
                $existing->update($values);
                if (! empty($data['password']) || $scopeChanged) {
                    AuthSession::query()->where('user_id', $existing->id)->delete();
                }
            } else {
                AuthUser::query()->create(array_merge($values, [
                    'id' => $data['id'],
                    'created_at' => now(),
                ]));
            }
        } catch (QueryException $exception) {
            if (str_contains($exception->getMessage(), 'unique')) {
                return response()->json(['error' => 'Cette adresse email est déjà utilisée.'], 409);
            }
            throw $exception;
        }

        return response()->json(['ok' => true], $existing ? 200 : 201);
    }

    public function provisionCompanyAdmin(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => ['required', 'string', 'min:1'],
            'email' => ['required', 'email', 'max:255'],
            'displayName' => ['required', 'string', 'min:1', 'max:180'],
            'companyId' => ['required', 'string', 'min:1'],
            'password' => ['required', 'string', 'min:8', 'max:200'],
        ]);
        $actor = $request->attributes->get('authActor');
        if (($actor['role'] ?? null) !== 'maximus_admin') {
            return response()->json(['error' => 'Seule l’administration MAXIMUS peut activer un compte entreprise.'], 403);
        }

        $email = Str::lower(trim($data['email']));
        $existing = AuthUser::query()->whereKey($data['id'])->first();
        $emailOwner = AuthUser::query()->where('email', $email)->where('status', 'ACTIF')->first();
        if ($emailOwner && (! $existing || $emailOwner->id !== $existing->id)) {
            return response()->json(['error' => 'Cette adresse email est déjà utilisée.'], 409);
        }

        $values = [
            'email' => $email,
            'password_hash' => MaximusPassword::hash($data['password']),
            'display_name' => trim($data['displayName']),
            'role' => 'company_admin',
            'company_id' => $data['companyId'],
            'employee_id' => null,
            'sector_ids' => [],
            'permissions' => [],
            'status' => 'ACTIF',
            'updated_at' => now(),
        ];

        if ($existing) {
            $existing->update($values);
            AuthSession::query()->where('user_id', $existing->id)->delete();
        } else {
            AuthUser::query()->create(array_merge($values, [
                'id' => $data['id'],
                'created_at' => now(),
            ]));
        }

        return response()->json(['ok' => true], $existing ? 200 : 201);
    }

    public function updateCompanyPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'companyId' => ['sometimes', 'string', 'min:1'],
            'password' => ['required', 'string', 'min:8', 'max:200'],
        ]);
        $actor = $request->attributes->get('authActor');
        $companyId = ($actor['role'] ?? null) === 'maximus_admin'
            ? ($data['companyId'] ?? null)
            : ($actor['companyId'] ?? null);
        if (!is_string($companyId) || $companyId === '') {
            return response()->json(['error' => 'Aucune entreprise valide n’est associée à cet acteur.'], 403);
        }
        if (($actor['role'] ?? null) !== 'maximus_admin' && isset($data['companyId']) && $data['companyId'] !== $companyId) {
            return response()->json(['error' => 'Accès à cette entreprise non autorisé.'], 403);
        }

        $admin = AuthUser::query()
            ->where('company_id', $companyId)
            ->where('role', 'company_admin')
            ->where('status', 'ACTIF')
            ->orderBy('created_at')
            ->first();
        if (!$admin) {
            return response()->json(['error' => 'Compte administrateur entreprise introuvable.'], 404);
        }

        $admin->update([
            'password_hash' => MaximusPassword::hash($data['password']),
            'updated_at' => now(),
        ]);
        AuthSession::query()->where('user_id', $admin->id)->delete();

        return response()->json(['ok' => true]);
    }

    public function deleteAccount(Request $request, string $employeeId): Response|JsonResponse
    {
        $actor = $request->attributes->get('authActor');
        $actorRole = $actor['role'] ?? null;
        if ($actorRole === 'maximus_admin') {
            $companyId = trim((string) $request->query('companyId', ''));
            if ($companyId === '') {
                return response()->json(['error' => 'Une entreprise cible est requise pour révoquer ce compte.'], 422);
            }
        } else {
            $companyId = trim((string) ($actor['companyId'] ?? ''));
            if ($companyId === '') {
                return response()->json(['error' => 'Aucune entreprise associée à cet acteur.'], 403);
            }
        }

        $user = AuthUser::query()
            ->where('company_id', $companyId)
            ->where('employee_id', $employeeId)
            ->first();
        if (! $user) {
            return response()->noContent();
        }

        $target = [
            'companyId' => $user->company_id ?? '',
            'employeeId' => $user->employee_id ?? $employeeId,
            'sectorIds' => $user->sector_ids ?? [],
        ];
        if (! CompanyAuthorization::canManageAccount($actor, (string) $target['companyId'], $target['sectorIds'])) {
            return response()->json(['error' => 'Révocation du compte hors périmètre autorisé.'], 403);
        }

        DB::transaction(function () use ($user): void {
            $user->update(['status' => 'SUSPENDU', 'updated_at' => now()]);
            AuthSession::query()->where('user_id', $user->id)->delete();
        });

        return response()->noContent();
    }

    public function session(Request $request): JsonResponse
    {
        $user = MaximusAuth::userFromRequest($request);
        if ($denial = $request->attributes->get(MaximusAuth::DEDICATED_ACCESS_ATTRIBUTE)) {
            return response()->json($denial, 403);
        }

        return response()->json([
            'user' => $user ? MaximusAuth::actor($user) : null,
        ]);
    }

    public function heartbeat(Request $request): JsonResponse
    {
        $user = $request->attributes->get('authUser');
        if (! $user instanceof AuthUser) {
            return response()->json(['error' => 'Session MAXIMUS absente ou expirée.'], 401);
        }

        $seenAt = $user->company_id !== null ? now() : null;
        try {
            $token = MaximusAuth::refreshSession($request, $user);
            if ($token === null) {
                return response()->json(['error' => 'Session MAXIMUS absente ou expirée.'], 401);
            }
            if ($seenAt !== null) {
                AuthUser::query()->whereKey($user->id)->update(['last_seen_at' => $seenAt]);
            }
        } catch (QueryException $exception) {
            report($exception);
            return response()->json(['error' => 'Le suivi des connexions n’est pas encore disponible.'], 503);
        }

        $response = response()->json(['ok' => true, 'seenAt' => $seenAt]);
        $response->withCookie(cookie(
            MaximusAuth::COOKIE,
            $token,
            MaximusAuth::sessionCookieMinutes($user),
            '/',
            null,
            app()->environment('production'),
            true,
            false,
            'lax',
        ));

        return $response;
    }

    private function recordLoginActivity(AuthUser $user): void
    {
        if ($user->company_id === null) {
            return;
        }

        $loggedInAt = now();
        try {
            $user->forceFill([
                'last_login_at' => $loggedInAt,
                'last_seen_at' => $loggedInAt,
            ])->save();
        } catch (QueryException $exception) {
            report($exception);
        }
    }

    public function logout(Request $request): Response
    {
        if ($token = $request->cookie(MaximusAuth::COOKIE)) {
            AuthSession::query()
                ->where('token_hash', MaximusAuth::hashToken($token))
                ->delete();
        }

        return response()->noContent()->withCookie(cookie()->forget(MaximusAuth::COOKIE));
    }
}
