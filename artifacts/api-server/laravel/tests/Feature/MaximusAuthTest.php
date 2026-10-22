<?php

namespace Tests\Feature;

use App\Models\AuthSession;
use App\Models\AuthUser;
use App\Models\Company;
use App\Support\MaximusAuth;
use App\Support\MaximusPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MaximusAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_endpoint_is_available(): void
    {
        $this->getJson('/api/healthz')
            ->assertOk()
            ->assertJson(['ok' => true]);
    }

    public function test_company_heartbeat_updates_activity_and_maximus_can_read_it(): void
    {
        $companyUser = AuthUser::query()->create([
            'id' => 'connectivity-company-admin',
            'email' => 'connectivity@kora.demo',
            'password_hash' => MaximusPassword::hash('Admin123!', '00112233445566778899aabbccddeeff'),
            'display_name' => 'Admin Kora',
            'role' => 'company_admin',
            'company_id' => 'kora',
            'sector_ids' => [],
            'status' => 'ACTIF',
        ]);
        $login = $this->postJson('/api/auth/login', [
            'email' => 'connectivity@kora.demo',
            'password' => 'Admin123!',
        ])->assertOk();
        $companyToken = $login->getCookie(MaximusAuth::COOKIE, false)->getValue();
        $companySession = AuthSession::query()
            ->where('token_hash', MaximusAuth::hashToken($companyToken))
            ->firstOrFail();
        $this->assertTrue($companySession->expires_at->greaterThan(now()->addDays(29)));
        $this->assertSame(30 * 24 * 60 * 60, $login->getCookie(MaximusAuth::COOKIE, false)->getMaxAge());

        $heartbeat = $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $companyToken)
            ->postJson('/api/auth/heartbeat')
            ->assertOk()
            ->assertJsonPath('ok', true);
        $this->assertTrue($companySession->fresh()->expires_at->greaterThan(now()->addDays(29)));
        $this->assertSame(30 * 24 * 60 * 60, $heartbeat->getCookie(MaximusAuth::COOKIE, false)->getMaxAge());

        $activity = $companyUser->fresh();
        $this->assertNotNull($activity?->last_login_at);
        $this->assertNotNull($activity?->last_seen_at);
        $this->assertTrue($activity->last_seen_at->greaterThanOrEqualTo(now()->subMinute()));

        $admin = AuthUser::query()->create([
            'id' => 'connectivity-maximus-admin',
            'email' => 'connectivity-admin@maximus.demo',
            'password_hash' => MaximusPassword::hash('Admin123!', '00112233445566778899aabbccddeeff'),
            'display_name' => 'Administration MAXIMUS',
            'role' => 'maximus_admin',
            'sector_ids' => [],
            'status' => 'ACTIF',
        ]);
        $adminToken = MaximusAuth::issueSession($admin);

        $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $adminToken)
            ->getJson('/api/companies/connectivity')
            ->assertOk()
            ->assertJsonPath('companies.0.companyId', 'kora')
            ->assertJsonPath('companies.0.online', true);

        $adminSession = AuthSession::query()
            ->where('token_hash', MaximusAuth::hashToken($adminToken))
            ->firstOrFail();
        $this->travel(7)->hours();
        $heartbeat = $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $adminToken)
            ->postJson('/api/auth/heartbeat')
            ->assertOk()
            ->assertJsonPath('ok', true);
        $this->assertTrue($adminSession->fresh()->expires_at->greaterThan(now()->addHours(7)));
        $this->assertSame(
            now()->addHours(8)->timestamp,
            $heartbeat->getCookie(MaximusAuth::COOKIE, false)->getExpiresTime(),
        );
    }

    public function test_laravel_accepts_the_existing_maximus_scrypt_format(): void
    {
        $this->assertTrue(MaximusPassword::check(
            'Admin123!',
            '00112233445566778899aabbccddeeff:7d58074f125b628bb6ab7efe859197b97dfdd595cf3e2a94157706bbee17271cd456d4234ecded4d1e199891d780bbc6df38b9cee2bf4a7e719bb15bc78c128b',
        ));

        $hash = MaximusPassword::hash('Admin123!', '00112233445566778899aabbccddeeff');

        $this->assertTrue(MaximusPassword::check('Admin123!', $hash));
        $this->assertFalse(MaximusPassword::check('wrong-password', $hash));
    }

    public function test_login_creates_a_compatible_session_cookie(): void
    {
        AuthUser::query()->create([
            'id' => 'maximus-admin',
            'email' => 'admin@maximus.demo',
            'password_hash' => MaximusPassword::hash('Admin123!', '00112233445566778899aabbccddeeff'),
            'display_name' => 'Administration MAXIMUS',
            'role' => 'maximus_admin',
            'sector_ids' => [],
            'status' => 'ACTIF',
        ]);

        $login = $this->postJson('/api/auth/login', [
            'email' => 'ADMIN@MAXIMUS.DEMO',
            'password' => 'Admin123!',
        ]);

        $login
            ->assertOk()
            ->assertJsonPath('user.role', 'maximus_admin')
            ->assertJsonPath('user.displayName', 'Administration MAXIMUS')
            ->assertCookie('maximus_session');

        $cookie = $login->getCookie('maximus_session', false)->getValue();
        $storedSession = AuthSession::query()->first();
        $this->assertNotNull($storedSession);
        $this->assertSame($storedSession->token_hash, MaximusAuth::hashToken($cookie));
        $this->assertTrue($storedSession->expires_at->greaterThan(now()->addHours(7)));
        $this->assertSame(8 * 60 * 60, $login->getCookie(MaximusAuth::COOKIE, false)->getMaxAge());
        $session = $this
            ->withCredentials()
            ->withUnencryptedCookie('maximus_session', $cookie)
            ->getJson('/api/auth/session');

        $session
            ->assertOk()
            ->assertJsonPath('user.role', 'maximus_admin')
            ->assertJsonPath('user.displayName', 'Administration MAXIMUS');
    }

    public function test_company_admin_can_provision_an_employee_who_logs_in_immediately(): void
    {
        $admin = AuthUser::query()->create([
            'id' => 'provisioning-admin',
            'email' => 'provisioning@kora.demo',
            'password_hash' => MaximusPassword::hash('Admin123!', 'aabbccddeeff00112233445566778899'),
            'display_name' => 'Admin Kora',
            'role' => 'company_admin',
            'company_id' => 'kora',
            'sector_ids' => [],
            'status' => 'ACTIF',
        ]);
        $token = MaximusAuth::issueSession($admin);

        $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $token)
            ->postJson('/api/auth/accounts', [
                'id' => 'employee-created-now',
                'email' => 'created.now@kora.demo',
                'displayName' => 'Employé créé',
                'companyId' => 'kora',
                'employeeId' => 'employee-created-now',
                'sectorIds' => ['kora-service-vente'],
                'role' => 'employee',
                'permissions' => ['presences' => ['voir', 'créer']],
                'password' => 'CreatedNow2026!',
            ])
            ->assertCreated()
            ->assertJson(['ok' => true]);

        $this->postJson('/api/auth/login', [
            'email' => 'created.now@kora.demo',
            'password' => 'CreatedNow2026!',
        ])
            ->assertOk()
            ->assertJsonPath('user.employeeId', 'employee-created-now')
            ->assertJsonPath('user.role', 'employee')
            ->assertJsonPath('user.permissions.presences.0', 'voir');
    }

    public function test_maximus_can_provision_an_approved_company_admin_who_logs_in_immediately(): void
    {
        $admin = AuthUser::query()->create([
            'id' => 'maximus-approver',
            'email' => 'approver@maximus.demo',
            'password_hash' => MaximusPassword::hash('Admin123!', '00112233445566778899aabbccddeeff'),
            'display_name' => 'Administration MAXIMUS',
            'role' => 'maximus_admin',
            'sector_ids' => [],
            'status' => 'ACTIF',
        ]);
        $token = MaximusAuth::issueSession($admin);

        $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $token)
            ->postJson('/api/auth/company-admins', [
                'id' => 'company-admin:new-company',
                'email' => 'admin@new-company.test',
                'displayName' => 'Responsable Nouvelle Entreprise',
                'companyId' => 'new-company',
                'password' => 'CompanyAdmin2026!',
            ])
            ->assertCreated()
            ->assertJson(['ok' => true]);

        $this->postJson('/api/auth/login', [
            'email' => 'ADMIN@NEW-COMPANY.TEST',
            'password' => 'CompanyAdmin2026!',
        ])
            ->assertOk()
            ->assertJsonPath('user.role', 'company_admin')
            ->assertJsonPath('user.companyId', 'new-company')
            ->assertJsonPath('user.displayName', 'Responsable Nouvelle Entreprise');
    }

    public function test_sector_manager_cannot_provision_an_account_across_sector_boundaries(): void
    {
        $manager = AuthUser::query()->create([
            'id' => 'sector-manager-boundary',
            'email' => 'sector-manager-boundary@kora.demo',
            'password_hash' => MaximusPassword::hash('Admin123!', '00112233445566778899aabbccddeeff'),
            'display_name' => 'Manager secteur',
            'role' => 'sector_manager',
            'company_id' => 'kora',
            'sector_ids' => ['secteur-a'],
            'status' => 'ACTIF',
        ]);
        $token = MaximusAuth::issueSession($manager);

        $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $token)
            ->postJson('/api/auth/accounts', [
                'id' => 'employee-cross-sector',
                'email' => 'employee-cross-sector@kora.demo',
                'displayName' => 'Employé hors périmètre',
                'companyId' => 'kora',
                'employeeId' => 'employee-cross-sector',
                'sectorIds' => ['secteur-a', 'secteur-b'],
                'role' => 'employee',
                'password' => 'CreatedNow2026!',
            ])
            ->assertForbidden();
    }

    public function test_sector_manager_cannot_update_an_existing_account_outside_its_scope(): void
    {
        $existing = AuthUser::query()->create([
            'id' => 'existing-outside-sector',
            'email' => 'existing-outside-sector@kora.demo',
            'password_hash' => MaximusPassword::hash('Existing123!', '00112233445566778899aabbccddeeff'),
            'display_name' => 'Employé hors secteur',
            'role' => 'employee',
            'company_id' => 'kora',
            'employee_id' => 'employee-outside-sector',
            'sector_ids' => ['secteur-b'],
            'status' => 'ACTIF',
        ]);
        $manager = AuthUser::query()->create([
            'id' => 'sector-manager-existing-boundary',
            'email' => 'sector-manager-existing-boundary@kora.demo',
            'password_hash' => MaximusPassword::hash('Admin123!', '00112233445566778899aabbccddeeff'),
            'display_name' => 'Manager secteur',
            'role' => 'sector_manager',
            'company_id' => 'kora',
            'sector_ids' => ['secteur-a'],
            'status' => 'ACTIF',
        ]);

        $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, MaximusAuth::issueSession($manager))
            ->postJson('/api/auth/accounts', [
                'id' => 'attempted-outside-sector',
                'email' => 'changed-outside-sector@kora.demo',
                'displayName' => 'Modification interdite',
                'companyId' => 'kora',
                'employeeId' => $existing->employee_id,
                'sectorIds' => ['secteur-a'],
                'role' => 'employee',
            ])
            ->assertForbidden();

        $this->assertDatabaseHas('auth_users', [
            'id' => $existing->id,
            'email' => 'existing-outside-sector@kora.demo',
            'display_name' => 'Employé hors secteur',
        ]);
    }

    public function test_account_scope_change_revokes_existing_sessions(): void
    {
        $employee = AuthUser::query()->create([
            'id' => 'account-scope-change',
            'email' => 'account-scope-change@kora.demo',
            'password_hash' => MaximusPassword::hash('Existing123!', '00112233445566778899aabbccddeeff'),
            'display_name' => 'Employé à requalifier',
            'role' => 'employee',
            'company_id' => 'kora',
            'employee_id' => 'employee-scope-change',
            'sector_ids' => ['secteur-a'],
            'status' => 'ACTIF',
        ]);
        $manager = AuthUser::query()->create([
            'id' => 'company-admin-scope-change',
            'email' => 'company-admin-scope-change@kora.demo',
            'password_hash' => 'not-used-in-this-test',
            'display_name' => 'Admin Kora',
            'role' => 'company_admin',
            'company_id' => 'kora',
            'sector_ids' => [],
            'status' => 'ACTIF',
        ]);
        AuthSession::query()->create([
            'id' => 'scope-change-session',
            'user_id' => $employee->id,
            'token_hash' => hash('sha256', 'scope-change-token'),
            'expires_at' => now()->addHour(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, MaximusAuth::issueSession($manager))
            ->postJson('/api/auth/accounts', [
                'id' => $employee->id,
                'email' => $employee->email,
                'displayName' => $employee->display_name,
                'companyId' => 'kora',
                'employeeId' => $employee->employee_id,
                'sectorIds' => ['secteur-b'],
                'role' => 'sector_manager',
            ])
            ->assertOk();

        $this->assertDatabaseMissing('auth_sessions', ['id' => 'scope-change-session']);
    }

    public function test_sector_manager_can_assign_permissions_allowed_for_the_company_and_managed_unit(): void
    {
        $state = $this->seedManagerRolePermissionState(['voir', 'créer'], ['products']);
        $manager = AuthUser::query()->create([
            'id' => 'sector-manager-permissions',
            'email' => 'sector-manager-permissions@kora.demo',
            'password_hash' => MaximusPassword::hash('Admin123!', '00112233445566778899aabbccddeeff'),
            'display_name' => 'Manager permissions',
            'role' => 'sector_manager',
            'company_id' => 'kora',
            'sector_ids' => ['sector-root'],
            'permissions' => ['stocks:products' => ['voir']],
            'status' => 'ACTIF',
        ]);
        $token = MaximusAuth::issueSession($manager);

        $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $token)
            ->postJson('/api/auth/accounts', [
                'id' => 'employee-permission-escalation',
                'email' => 'employee-permission-escalation@kora.demo',
                'displayName' => 'Employé escalade',
                'companyId' => 'kora',
                'employeeId' => 'employee-permission-escalation',
                'sectorId' => 'sector-child',
                'sectorIds' => ['sector-child'],
                'role' => 'employee',
                'permissions' => ['stocks:products' => ['voir', 'créer']],
                'password' => 'CreatedNow2026!',
            ])
            ->assertCreated();

        $created = AuthUser::query()->where('employee_id', 'employee-permission-escalation')->firstOrFail();
        $this->assertSame(['stocks:products' => ['voir', 'créer']], $created->permissions);
    }

    public function test_sector_manager_cannot_assign_features_or_actions_outside_company_and_unit_scope(): void
    {
        $state = $this->seedManagerRolePermissionState(['voir'], []);
        $manager = AuthUser::query()->create([
            'id' => 'sector-manager-permissions-capped',
            'email' => 'sector-manager-permissions-capped@kora.demo',
            'password_hash' => MaximusPassword::hash('Admin123!', '00112233445566778899aabbccddeeff'),
            'display_name' => 'Manager permissions',
            'role' => 'sector_manager',
            'company_id' => 'kora',
            'sector_ids' => ['sector-root'],
            'permissions' => [],
            'status' => 'ACTIF',
        ]);
        $token = MaximusAuth::issueSession($manager);
        $request = fn () => $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $token);

        $request()->postJson('/api/auth/accounts', [
            'id' => 'employee-unit-feature-denied',
            'email' => 'unit-feature-denied@kora.demo',
            'displayName' => 'Employé sans fonctionnalité',
            'companyId' => 'kora',
            'employeeId' => 'employee-unit-feature-denied',
            'sectorId' => 'sector-child',
            'sectorIds' => ['sector-child'],
            'role' => 'employee',
            'permissions' => ['stocks:products' => ['voir']],
            'password' => 'CreatedNow2026!',
        ])->assertForbidden();

        $state['orgNodes'][1]['moduleFeatures']['stocks'] = ['products'];
        DB::table('maximus_app_states')->where('scope', 'workspace')->update([
            'payload' => json_encode($state, JSON_THROW_ON_ERROR),
            'updated_at' => now(),
        ]);
        $request()->postJson('/api/auth/accounts', [
            'id' => 'employee-unit-action-denied',
            'email' => 'unit-action-denied@kora.demo',
            'displayName' => 'Employé sans action',
            'companyId' => 'kora',
            'employeeId' => 'employee-unit-action-denied',
            'sectorId' => 'sector-child',
            'sectorIds' => ['sector-child'],
            'role' => 'employee',
            'permissions' => ['stocks:products' => ['voir', 'créer']],
            'password' => 'CreatedNow2026!',
        ])->assertForbidden();

        DB::table('maximus_company_modules')
            ->where('company_id', 'kora')
            ->where('module_id', 'stocks')
            ->update(['status' => 'INACTIF', 'updated_at' => now()]);
        $request()->postJson('/api/auth/accounts', [
            'id' => 'employee-company-module-denied',
            'email' => 'company-module-denied@kora.demo',
            'displayName' => 'Employé sans module',
            'companyId' => 'kora',
            'employeeId' => 'employee-company-module-denied',
            'sectorId' => 'sector-child',
            'sectorIds' => ['sector-child'],
            'role' => 'employee',
            'permissions' => ['stocks:products' => ['voir']],
            'password' => 'CreatedNow2026!',
        ])->assertForbidden();

        $this->assertDatabaseMissing('auth_users', ['employee_id' => 'employee-unit-feature-denied']);
        $this->assertDatabaseMissing('auth_users', ['employee_id' => 'employee-unit-action-denied']);
        $this->assertDatabaseMissing('auth_users', ['employee_id' => 'employee-company-module-denied']);
    }

    public function test_company_admin_cannot_reassign_an_employee_account_from_another_company(): void
    {
        AuthUser::query()->create([
            'id' => 'existing-other-company',
            'email' => 'existing-other-company@other.demo',
            'password_hash' => MaximusPassword::hash('Admin123!', '00112233445566778899aabbccddeeff'),
            'display_name' => 'Employé autre entreprise',
            'role' => 'employee',
            'company_id' => 'other-company',
            'employee_id' => 'shared-employee-id',
            'sector_ids' => ['other-sector'],
            'status' => 'ACTIF',
        ]);
        $admin = AuthUser::query()->create([
            'id' => 'company-admin-isolation',
            'email' => 'company-admin-isolation@kora.demo',
            'password_hash' => MaximusPassword::hash('Admin123!', 'aabbccddeeff00112233445566778899'),
            'display_name' => 'Admin Kora',
            'role' => 'company_admin',
            'company_id' => 'kora',
            'sector_ids' => [],
            'status' => 'ACTIF',
        ]);
        $token = MaximusAuth::issueSession($admin);

        $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $token)
            ->postJson('/api/auth/accounts', [
                'id' => 'attempted-cross-company-update',
                'email' => 'attempted-cross-company-update@kora.demo',
                'displayName' => 'Compte Kora',
                'companyId' => 'kora',
                'employeeId' => 'shared-employee-id',
                'sectorIds' => ['kora-sector'],
                'role' => 'employee',
                'password' => 'CreatedNow2026!',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('auth_users', [
            'id' => 'existing-other-company',
            'company_id' => 'other-company',
            'email' => 'existing-other-company@other.demo',
        ]);
        $this->assertDatabaseHas('auth_users', [
            'id' => 'attempted-cross-company-update',
            'company_id' => 'kora',
            'employee_id' => 'shared-employee-id',
        ]);
    }

    public function test_company_admin_revokes_the_matching_employee_only_in_its_company(): void
    {
        $ownEmployee = AuthUser::query()->create([
            'id' => 'delete-own-company-employee',
            'email' => 'shared-employee@kora.demo',
            'password_hash' => MaximusPassword::hash('Employee123!'),
            'display_name' => 'Employé Kora',
            'role' => 'employee',
            'company_id' => 'kora',
            'employee_id' => 'shared-employee-id',
            'sector_ids' => ['kora-sector'],
            'status' => 'ACTIF',
        ]);
        $otherEmployee = AuthUser::query()->create([
            'id' => 'delete-other-company-employee',
            'email' => 'shared-employee@other.demo',
            'password_hash' => MaximusPassword::hash('Employee123!'),
            'display_name' => 'Employé autre entreprise',
            'role' => 'employee',
            'company_id' => 'other-company',
            'employee_id' => 'shared-employee-id',
            'sector_ids' => ['other-sector'],
            'status' => 'ACTIF',
        ]);
        $admin = AuthUser::query()->create([
            'id' => 'delete-company-admin',
            'email' => 'delete-admin@kora.demo',
            'password_hash' => MaximusPassword::hash('Admin123!'),
            'display_name' => 'Admin Kora',
            'role' => 'company_admin',
            'company_id' => 'kora',
            'sector_ids' => [],
            'status' => 'ACTIF',
        ]);
        MaximusAuth::issueSession($ownEmployee);
        MaximusAuth::issueSession($otherEmployee);
        $adminToken = MaximusAuth::issueSession($admin);

        $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $adminToken)
            ->deleteJson('/api/auth/accounts/shared-employee-id?companyId=kora')
            ->assertNoContent();

        $this->assertDatabaseHas('auth_users', [
            'id' => $ownEmployee->id,
            'status' => 'SUSPENDU',
        ]);
        $this->assertDatabaseHas('auth_users', [
            'id' => $otherEmployee->id,
            'status' => 'ACTIF',
        ]);
        $this->assertDatabaseMissing('auth_sessions', ['user_id' => $ownEmployee->id]);
        $this->assertDatabaseHas('auth_sessions', ['user_id' => $otherEmployee->id]);
    }

    public function test_company_admin_cannot_select_another_company_for_account_revocation(): void
    {
        $otherEmployee = AuthUser::query()->create([
            'id' => 'foreign-delete-target',
            'email' => 'foreign-delete-target@other.demo',
            'password_hash' => MaximusPassword::hash('Employee123!'),
            'display_name' => 'Employé autre entreprise',
            'role' => 'employee',
            'company_id' => 'other-company',
            'employee_id' => 'foreign-delete-id',
            'sector_ids' => ['other-sector'],
            'status' => 'ACTIF',
        ]);
        $admin = AuthUser::query()->create([
            'id' => 'foreign-delete-company-admin',
            'email' => 'foreign-delete-admin@kora.demo',
            'password_hash' => MaximusPassword::hash('Admin123!'),
            'display_name' => 'Admin Kora',
            'role' => 'company_admin',
            'company_id' => 'kora',
            'sector_ids' => [],
            'status' => 'ACTIF',
        ]);
        $adminToken = MaximusAuth::issueSession($admin);
        MaximusAuth::issueSession($otherEmployee);

        $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $adminToken)
            ->deleteJson('/api/auth/accounts/foreign-delete-id?companyId=other-company')
            ->assertNoContent();

        $this->assertDatabaseHas('auth_users', [
            'id' => $otherEmployee->id,
            'status' => 'ACTIF',
        ]);
        $this->assertDatabaseHas('auth_sessions', ['user_id' => $otherEmployee->id]);
    }

    public function test_maximus_admin_must_specify_a_company_for_account_revocation(): void
    {
        $employee = AuthUser::query()->create([
            'id' => 'company-selected-delete-target',
            'email' => 'company-selected-delete-target@kora.demo',
            'password_hash' => MaximusPassword::hash('Employee123!'),
            'display_name' => 'Employé Kora',
            'role' => 'employee',
            'company_id' => 'kora',
            'employee_id' => 'company-selected-delete-id',
            'sector_ids' => ['kora-sector'],
            'status' => 'ACTIF',
        ]);
        $admin = AuthUser::query()->create([
            'id' => 'maximus-delete-admin',
            'email' => 'maximus-delete-admin@maximus.demo',
            'password_hash' => MaximusPassword::hash('Admin123!'),
            'display_name' => 'Administration MAXIMUS',
            'role' => 'maximus_admin',
            'sector_ids' => [],
            'status' => 'ACTIF',
        ]);
        $adminToken = MaximusAuth::issueSession($admin);

        $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $adminToken)
            ->deleteJson('/api/auth/accounts/company-selected-delete-id')
            ->assertUnprocessable();

        $this->assertDatabaseHas('auth_users', [
            'id' => $employee->id,
            'status' => 'ACTIF',
        ]);
    }

    public function test_deleted_company_invalidates_credentials_sessions_tokens_and_protected_data_access(): void
    {
        Company::query()->create([
            'id' => 'deleted-company',
            'name' => 'Entreprise à supprimer',
            'manager' => 'Administrateur supprimé',
            'email' => 'admin@deleted-company.test',
            'status' => 'ACTIF',
            'requested_modules' => ['presences', 'stocks', 'ecommerce'],
            'deletion_locked' => false,
        ]);

        $companyUser = AuthUser::query()->create([
            'id' => 'deleted-company-admin',
            'email' => 'admin@deleted-company.test',
            'password_hash' => MaximusPassword::hash('DeletedCompany2026!'),
            'display_name' => 'Administrateur supprimé',
            'role' => 'company_admin',
            'company_id' => 'deleted-company',
            'sector_ids' => [],
            'status' => 'ACTIF',
        ]);
        $oldToken = MaximusAuth::issueSession($companyUser);

        $maximusAdmin = AuthUser::query()->create([
            'id' => 'deletion-maximus-admin',
            'email' => 'deletion-admin@maximus.test',
            'password_hash' => MaximusPassword::hash('MaximusDeletion2026!'),
            'display_name' => 'Administration MAXIMUS',
            'role' => 'maximus_admin',
            'sector_ids' => [],
            'status' => 'ACTIF',
        ]);
        $adminToken = MaximusAuth::issueSession($maximusAdmin);

        DB::table('maximus_app_states')->insert([
            'scope' => 'workspace',
            'company_id' => null,
            'payload' => json_encode([
                'companies' => [
                    ['id' => 'deleted-company', 'name' => 'Entreprise à supprimer', 'status' => 'ACTIF'],
                ],
                'employees' => [
                    ['id' => 'deleted-employee', 'companyId' => 'deleted-company'],
                ],
            ], JSON_THROW_ON_ERROR),
            'version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('ecommerce_stores')->insert([
            'id' => 'deleted-company-store',
            'company_id' => 'deleted-company',
            'slug' => 'deleted-company-shop',
            'name' => 'Boutique supprimée',
            'description' => '',
            'status' => 'PUBLISHED',
            'currency' => 'XOF',
            'primary_color' => '#000000',
            'accent_color' => '#ffffff',
            'logo_url' => '',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $adminToken)
            ->deleteJson('/api/companies/deleted-company')
            ->assertOk()
            ->assertJson(['ok' => true]);

        $this->assertDatabaseHas('companies', [
            'id' => 'deleted-company',
            'status' => 'ARCHIVÉ',
        ]);
        $this->assertDatabaseHas('auth_users', [
            'id' => 'deleted-company-admin',
            'status' => 'SUSPENDU',
        ]);
        $this->assertDatabaseMissing('auth_sessions', [
            'token_hash' => MaximusAuth::hashToken($oldToken),
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'admin@deleted-company.test',
            'password' => 'DeletedCompany2026!',
        ])->assertUnauthorized();
        $this->assertSame(0, AuthSession::query()->where('user_id', 'deleted-company-admin')->count());

        $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $oldToken)
            ->getJson('/api/auth/session')
            ->assertOk()
            ->assertJson(['user' => null]);

        $oldSession = fn () => $this
            ->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $oldToken);

        $oldSession()->getJson('/api/app-state/bootstrap')->assertUnauthorized();
        $oldSession()->putJson('/api/app-state', [
            'data' => ['companies' => [['id' => 'deleted-company']]],
            'version' => 1,
        ])->assertUnauthorized();
        $oldSession()->getJson('/api/modules/bootstrap?companyId=deleted-company')->assertUnauthorized();
        $oldSession()->getJson('/api/presence/bootstrap')->assertUnauthorized();
        $oldSession()->postJson('/api/presence/items', [
            'id' => 'should-not-be-created',
            'type' => 'absence',
        ])->assertUnauthorized();
        $this->getJson('/api/shop/deleted-company-shop')->assertNotFound();

        $adminState = $this->withCredentials()
            ->withUnencryptedCookie(MaximusAuth::COOKIE, $adminToken)
            ->getJson('/api/app-state/bootstrap')
            ->assertOk();
        $this->assertFalse(collect($adminState->json('data.companies'))->contains('id', 'deleted-company'));
        $this->assertFalse(collect($adminState->json('data.employees'))->contains('companyId', 'deleted-company'));
    }

    private function seedManagerRolePermissionState(array $companyActions, array $childFeatures): array
    {
        DB::table('maximus_company_modules')
            ->where('company_id', 'kora')
            ->where('module_id', 'stocks')
            ->update([
                'status' => 'ACTIF',
                'feature_ids' => json_encode(['products'], JSON_THROW_ON_ERROR),
                'configuration' => json_encode([
                    'featureScope' => 'explicit',
                    'featurePermissions' => ['products' => $companyActions],
                ], JSON_THROW_ON_ERROR),
                'updated_at' => now(),
            ]);

        $state = [
            'companies' => [['id' => 'kora', 'allowedModules' => ['stocks']]],
            'employees' => [],
            'roles' => [],
            'orgNodes' => [
                [
                    'id' => 'sector-root',
                    'companyId' => 'kora',
                    'parentId' => null,
                    'moduleIds' => ['stocks'],
                    'moduleFeatures' => ['stocks' => ['products']],
                ],
                [
                    'id' => 'sector-child',
                    'companyId' => 'kora',
                    'parentId' => 'sector-root',
                    'moduleIds' => ['stocks'],
                    'moduleFeatures' => ['stocks' => $childFeatures],
                ],
            ],
        ];
        DB::table('maximus_app_states')->updateOrInsert(
            ['scope' => 'workspace'],
            [
                'company_id' => null,
                'payload' => json_encode($state, JSON_THROW_ON_ERROR),
                'version' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );

        return $state;
    }
}
