import type { Company, Employee, Role, StoreData } from './store';
import type { AuthUser } from './auth-api';
import { synchronizeSelectedPackRolesForCompany } from './module-role-sync';

export function canRunAutomaticPackRoleRepair(actorRole: AuthUser['role']): boolean {
  return actorRole === 'maximus_admin' || actorRole === 'company_admin';
}

export interface PackRoleRepairResult {
  repairedData: StoreData;
  rolesChanged: boolean;
  synchronizedEmployeeIds: string[];
}

function permissionSignature(permissions: Role['modulePermissions']) {
  return Object.keys(permissions ?? {})
    .sort()
    .map(key => [key, [...new Set(permissions[key] ?? [])].sort()]);
}

/**
 * Builds a safe repair off to the side, updates active accounts that use a
 * changed role, and only returns the repaired store after all updates succeed.
 */
export async function repairSelectedPackRolesAndAccounts(input: {
  data: StoreData;
  company: Company;
  nodeIds: string[];
  employees: Employee[];
  provisionEmployee: (employee: Employee, role: Role) => Promise<void>;
}): Promise<PackRoleRepairResult> {
  const { data, company, nodeIds, employees, provisionEmployee } = input;
  const repairedData = structuredClone(data) as StoreData;
  synchronizeSelectedPackRolesForCompany(repairedData, company, nodeIds);

  const currentRoles = data.roles.filter(role => role.companyId === company.id);
  const repairedRoles = repairedData.roles.filter(role => role.companyId === company.id);
  const rolesChanged = JSON.stringify(currentRoles) !== JSON.stringify(repairedRoles);
  const repairedRoleById = new Map(repairedRoles.map(role => [role.id, role]));
  const changedPermissionRoleIds = new Set(
    repairedRoles
      .filter(role => {
        const previous = currentRoles.find(item => item.id === role.id);
        return Boolean(
          previous
          && role.packId
          && role.packModuleId
          && JSON.stringify(permissionSignature(previous.modulePermissions))
            !== JSON.stringify(permissionSignature(role.modulePermissions)),
        );
      })
      .map(role => role.id),
  );
  const affectedEmployees = employees.filter(
    employee => employee.status === 'ACTIF' && changedPermissionRoleIds.has(employee.roleId ?? ''),
  );

  await Promise.all(affectedEmployees.map(async employee => {
    const role = repairedRoleById.get(employee.roleId ?? '');
    if (!role) {
      throw new Error('Un rôle prérempli utilisé par un employé est introuvable.');
    }
    await provisionEmployee(employee, role);
  }));

  return {
    repairedData,
    rolesChanged,
    synchronizedEmployeeIds: affectedEmployees.map(employee => employee.id),
  };
}