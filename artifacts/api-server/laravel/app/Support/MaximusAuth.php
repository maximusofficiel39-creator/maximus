<?php

namespace App\Support;

use App\Models\AuthSession;
use App\Models\AuthUser;
use App\Models\Company;
use App\Services\InstallationAddressVerifier;
use App\Support\CompanyRegistry;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class MaximusAuth
{
    public const COOKIE = 'maximus_session';
    public const DEDICATED_ACCESS_ATTRIBUTE = 'maximusDedicatedAccess';
    public const COMPANY_SESSION_DAYS = 30;
    public const ADMIN_SESSION_HOURS = 8;

    public static function actor(AuthUser $user): array
    {
        return [
            'role' => $user->role,
            'displayName' => $user->display_name,
            'companyId' => $user->company_id,
            'employeeId' => $user->employee_id,
            'sectorIds' => is_array($user->sector_ids) ? $user->sector_ids : [],
            'permissions' => is_array($user->permissions) ? $user->permissions : [],
        ];
    }

    public static function userFromRequest(Request $request): ?AuthUser
    {
        $request->attributes->remove(self::DEDICATED_ACCESS_ATTRIBUTE);
        $token = $request->cookie(self::COOKIE);

        if (! $token) {
            return null;
        }

        $session = AuthSession::query()
            ->where('token_hash', self::hashToken($token))
            ->where('expires_at', '>', Carbon::now())
            ->first();

        if (! $session) {
            return null;
        }

        $user = AuthUser::query()
            ->whereKey($session->user_id)
            ->where('status', 'ACTIF')
            ->first();

        if ($user && ($denial = self::dedicatedAccessDenial($user)) !== null) {
            $request->attributes->set(self::DEDICATED_ACCESS_ATTRIBUTE, $denial);
            return null;
        }
        return $user && self::canAuthenticate($user) ? $user : null;
    }

    /** Central-only cutover policy. Never derive a destination from client input. */
    public static function dedicatedAccessDenial(AuthUser $user): ?array
    {
        if (!InstallationContext::isCentral() || $user->role === 'maximus_admin' || $user->company_id === null || $user->status !== 'ACTIF') {
            return null;
        }
        $company = Company::query()->whereKey($user->company_id)->where('status', 'ACTIF')->whereNull('deleted_at')->first();
        if (!$company) {
            return null;
        }
        $url = null;
        if ($company->erp_installation_id !== null) {
            $installation = DB::table('maximus_installations')->where('id', $company->erp_installation_id)
                ->where('company_id', $company->id)->whereNull('revoked_at')->whereIn('status', ['READY', 'CONNECTED'])->first();
            if ($installation && in_array($installation->mode, ['dedicated', 'on_premise'], true)) {
                $primary = DB::table('maximus_installation_addresses')->where('installation_id', $installation->id)
                    ->where('is_primary', true)->where('status', 'ACTIVE')->first();
                if ($primary) {
                    try {
                        $origin = app(InstallationAddressVerifier::class)->normalize($primary->url, $installation->mode);
                        if ($origin['hostname'] === $primary->hostname && $origin['local'] === ($primary->validation_method === 'local')) {
                            $url = $origin['url'].'/';
                        }
                    } catch (\Illuminate\Validation\ValidationException $exception) {
                        // A stale/corrupt address must not restore central access or become a redirect.
                    }
                }
            }
            return [
                'code' => 'COMPANY_DEDICATED_ACCESS',
                'error' => 'Votre entreprise utilise désormais son installation ERP dédiée. '
                    .($url ? 'Connectez-vous sur '.$url : 'Demandez l’adresse validée à votre administrateur.'),
                'loginUrl' => $url,
            ];
        }

        return null;
    }

    public static function canAuthenticate(AuthUser $user): bool
    {
        if ($user->status !== 'ACTIF') {
            return false;
        }

        return InstallationContext::allowsUser($user)
            && ($user->company_id === null
                || CompanyRegistry::isActive((string) $user->company_id))
            && self::dedicatedAccessDenial($user) === null;
    }

    public static function issueSession(AuthUser $user): string
    {
        if (! self::canAuthenticate($user)) {
            throw new \LogicException('Impossible de créer une session pour un compte ou une entreprise inactive.');
        }

        $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');

        AuthSession::query()->create([
            'id' => (string) str()->uuid(),
            'token_hash' => self::hashToken($token),
            'user_id' => $user->id,
            'expires_at' => self::sessionExpiry($user),
            'created_at' => Carbon::now(),
        ]);
        return $token;
    }

    public static function sessionExpiry(AuthUser $user): Carbon
    {
        return $user->company_id !== null
            ? Carbon::now()->addDays(self::COMPANY_SESSION_DAYS)
            : Carbon::now()->addHours(self::ADMIN_SESSION_HOURS);
    }

    public static function sessionCookieMinutes(AuthUser $user): int
    {
        return $user->company_id !== null
            ? self::COMPANY_SESSION_DAYS * 24 * 60
            : self::ADMIN_SESSION_HOURS * 60;
    }

    public static function refreshSession(Request $request, AuthUser $user): ?string
    {
        $token = $request->cookie(self::COOKIE);
        if (! $token) {
            return null;
        }

        $session = AuthSession::query()
            ->where('token_hash', self::hashToken($token))
            ->where('user_id', $user->id)
            ->where('expires_at', '>', Carbon::now())
            ->first();
        if (! $session) {
            return null;
        }

        $session->update(['expires_at' => self::sessionExpiry($user)]);
        return $token;
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }
}
