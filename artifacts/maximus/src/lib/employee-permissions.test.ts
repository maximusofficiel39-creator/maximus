import assert from 'node:assert/strict';
import test from 'node:test';
import type { Company, Employee, OrgNode, Role } from './store';
import { isRoleAssignableToUnit, rolesForExactUnit } from './employee-permissions';
import { emptyStoreData, modules } from './store';
import {
  synchronizeSelectedPackRolesForCompany,
  synchronizeUnitPackRoles,
} from './module-role-sync';
import { canRunAutomaticPackRoleRepair, repairSelectedPackRolesAndAccounts } from './pack-role-repair';

test('la réparation automatique des rôles préremplis est réservée aux administrateurs', () => {
  assert.equal(canRunAutomaticPackRoleRepair('maximus_admin'), true);
  assert.equal(canRunAutomaticPackRoleRepair('company_admin'), true);
  assert.equal(canRunAutomaticPackRoleRepair('sector_manager'), false);
  assert.equal(canRunAutomaticPackRoleRepair('employee'), false);
});

function createCompany(): Company {
  return {
    id: 'company-1',
    name: 'Entreprise test',
    manager: 'Direction',
    email: 'company@example.test',
    phone: '',
    country: 'SN',
    sector: 'services',
    status: 'ACTIF',
    requestedModules: ['transport'],
    requestedModuleFeatures: { transport: ['trips', 'vehicles'] },
    requestedModulePermissions: {
      transport: {
        trips: ['voir', 'créer', 'modifier'],
        vehicles: ['voir'],
      },
    },
    allowedModules: ['transport'],
    refusedModules: [],
    createdAt: '2026-01-01',
  };
}

function createNodes(): OrgNode[] {
  return [
    {
      id: 'unit-root',
      companyId: 'company-1',
      name: 'Unité Transport',
      parentId: null,
      moduleIds: ['transport'],
      moduleFeatures: { transport: ['trips', 'vehicles'] },
    },
    {
      id: 'unit-child',
      companyId: 'company-1',
      name: 'Sous-unité Transport',
      parentId: 'unit-root',
      moduleIds: ['transport'],
      moduleFeatures: { transport: ['trips'] },
    },
  ];
}

function createRole(modulePermissions: Role['modulePermissions']): Role {
  return {
    id: 'role-1',
    companyId: 'company-1',
    sectorId: 'unit-root',
    name: 'Rôle Transport',
    description: '',
    modulePermissions,
  };
}

test('un formulaire employé ne propose que les rôles de son unité exacte', () => {
  const roles: Role[] = [
    { id: 'role-root', name: 'Responsable', description: '', companyId: 'company-1', sectorId: 'unit-root', modulePermissions: {} },
    { id: 'role-child', name: 'Responsable', description: '', companyId: 'company-1', sectorId: 'unit-child', modulePermissions: {} },
    { id: 'role-other', name: 'Responsable', description: '', companyId: 'company-1', sectorId: 'unit-other', modulePermissions: {} },
  ];

  assert.deepEqual(rolesForExactUnit(roles, 'unit-child').map(role => role.id), ['role-child']);
});

test('accepte un rôle borné par les droits actifs de l’entreprise et de l’unité', () => {
  assert.equal(
    isRoleAssignableToUnit(
      createRole({ 'transport:menu:trips': ['voir', 'créer'] }),
      createCompany(),
      'unit-child',
      createNodes(),
      modules,
    ),
    true,
  );
});

test('propose à la création d’employé un rôle généré depuis un pack de l’unité', () => {
  const company = createCompany();
  const nodes = createNodes();
  const unit = nodes[0];
  unit.modulePackIds = { transport: ['transport-gestion'] };
  const data = emptyStoreData();
  data.companies.push(company);
  data.orgNodes.push(...nodes);

  synchronizeUnitPackRoles(data, company, unit);

  const packRole = data.roles.find(role =>
    role.companyId === company.id
    && role.sectorId === unit.id
    && role.packId === 'transport-gestion',
  );
  assert.ok(packRole);
  assert.equal(packRole.modulePermissions.transport, undefined);
  assert.equal(
    isRoleAssignableToUnit(packRole, company, unit.id, nodes, modules),
    true,
  );

  packRole.modulePermissions.transport = ['voir'];
  synchronizeSelectedPackRolesForCompany(data, company, [unit.id]);

  const repairedRole = data.roles.find(role => role.id === packRole.id);
  assert.ok(repairedRole);
  assert.equal(repairedRole.modulePermissions.transport, undefined);
  assert.equal(
    isRoleAssignableToUnit(repairedRole, company, unit.id, nodes, modules),
    true,
  );
});

test('répare les droits anciens d’un pack selon les limites de l’entreprise', () => {
  const company = createCompany();
  company.requestedModulePermissions = { transport: {} };
  const nodes = createNodes();
  const unit = nodes[0];
  unit.modulePackIds = { transport: ['transport-gestion'] };
  const data = emptyStoreData();
  data.companies.push(company);
  data.orgNodes.push(...nodes);
  data.roles.push({
    id: 'legacy-pack-role',
    companyId: company.id,
    sectorId: unit.id,
    name: 'Gestionnaire Transport',
    description: '',
    packId: 'transport-gestion',
    packModuleId: 'transport',
    modulePermissions: {
      transport: ['voir'],
      'transport:menu:trips': ['voir', 'créer', 'modifier'],
      'transport:menu:vehicles': ['voir', 'créer'],
    },
  });

  synchronizeSelectedPackRolesForCompany(data, company, [unit.id]);

  const repairedRole = data.roles.find(role => role.id === 'legacy-pack-role');
  assert.ok(repairedRole);
  assert.deepEqual(repairedRole.modulePermissions, {
    'transport:menu:trips': ['voir'],
    'transport:menu:vehicles': ['voir'],
  });
  assert.equal(
    isRoleAssignableToUnit(repairedRole, company, unit.id, nodes, modules),
    true,
  );
});

test('synchronise le compte actif affecté avant de retourner le rôle réparé', async () => {
  const company = createCompany();
  company.requestedModulePermissions = { transport: {} };
  const nodes = createNodes();
  const unit = nodes[0];
  unit.modulePackIds = { transport: ['transport-gestion'] };
  const data = emptyStoreData();
  data.companies.push(company);
  data.orgNodes.push(...nodes);
  const role: Role = {
    id: 'assigned-legacy-pack-role',
    companyId: company.id,
    sectorId: unit.id,
    name: 'Gestionnaire Transport',
    description: '',
    packId: 'transport-gestion',
    packModuleId: 'transport',
    modulePermissions: {
      transport: ['voir'],
      'transport:menu:trips': ['voir', 'créer', 'modifier'],
    },
  };
  const employee: Employee = {
    id: 'active-pack-employee',
    firstName: 'Awa',
    lastName: 'Sow',
    email: 'awa@example.test',
    phone: '',
    position: 'Gestionnaire',
    department: unit.name,
    subDepartment: '',
    role: role.name,
    roleId: role.id,
    status: 'ACTIF',
    companyId: company.id,
    sectorId: unit.id,
  };
  data.roles.push(role);
  data.employees.push(employee);

  const provisioned: Array<{ employeeId: string; permissions: Role['modulePermissions'] }> = [];
  const repair = await repairSelectedPackRolesAndAccounts({
    data,
    company,
    nodeIds: [unit.id],
    employees: [employee],
    provisionEmployee: async (assignedEmployee, repairedRole) => {
      provisioned.push({
        employeeId: assignedEmployee.id,
        permissions: repairedRole.modulePermissions,
      });
    },
  });

  assert.deepEqual(provisioned, [{
    employeeId: employee.id,
    permissions: {
      'transport:menu:trips': ['voir'],
      'transport:menu:vehicles': ['voir'],
    },
  }]);
  assert.deepEqual(repair.synchronizedEmployeeIds, [employee.id]);
  assert.deepEqual(
    repair.repairedData.roles.find(item => item.id === role.id)?.modulePermissions,
    {
      'transport:menu:trips': ['voir'],
      'transport:menu:vehicles': ['voir'],
    },
  );
  assert.deepEqual(data.roles.find(item => item.id === role.id)?.modulePermissions, {
    transport: ['voir'],
    'transport:menu:trips': ['voir', 'créer', 'modifier'],
  });
});

test('ne retourne pas le rôle réparé si la synchronisation du compte échoue', async () => {
  const company = createCompany();
  company.requestedModulePermissions = { transport: {} };
  const nodes = createNodes();
  const unit = nodes[0];
  unit.modulePackIds = { transport: ['transport-gestion'] };
  const data = emptyStoreData();
  data.companies.push(company);
  data.orgNodes.push(...nodes);
  const role: Role = {
    id: 'failed-sync-pack-role',
    companyId: company.id,
    sectorId: unit.id,
    name: 'Gestionnaire Transport',
    description: '',
    packId: 'transport-gestion',
    packModuleId: 'transport',
    modulePermissions: { 'transport:menu:trips': ['voir', 'créer', 'modifier'] },
  };
  const employee: Employee = {
    id: 'failed-sync-employee',
    firstName: 'Awa',
    lastName: 'Sow',
    email: 'awa@example.test',
    phone: '',
    position: 'Gestionnaire',
    department: unit.name,
    subDepartment: '',
    role: role.name,
    roleId: role.id,
    status: 'ACTIF',
    companyId: company.id,
    sectorId: unit.id,
  };
  data.roles.push(role);
  data.employees.push(employee);

  await assert.rejects(
    repairSelectedPackRolesAndAccounts({
      data,
      company,
      nodeIds: [unit.id],
      employees: [employee],
      provisionEmployee: async () => {
        throw new Error('Compte indisponible');
      },
    }),
    /Compte indisponible/,
  );
  assert.deepEqual(data.roles.find(item => item.id === role.id)?.modulePermissions, {
    'transport:menu:trips': ['voir', 'créer', 'modifier'],
  });
});

test('utilise les fonctionnalités et droits demandés quand le détail des fonctionnalités manque', () => {
  const company = createCompany();
  company.requestedModuleFeatures = undefined;
  company.requestedModulePermissions = {
    transport: {
      trips: ['voir'],
      vehicles: ['voir'],
    },
  };
  const nodes = createNodes();
  const unit = nodes[0];
  unit.modulePackIds = { transport: ['transport-gestion'] };
  const data = emptyStoreData();
  data.companies.push(company);
  data.orgNodes.push(...nodes);

  synchronizeUnitPackRoles(data, company, unit);

  const packRole = data.roles.find(role =>
    role.companyId === company.id
    && role.sectorId === unit.id
    && role.packId === 'transport-gestion',
  );
  assert.ok(packRole);
  assert.deepEqual(packRole.modulePermissions, {
    'transport:menu:trips': ['voir'],
    'transport:menu:vehicles': ['voir'],
  });
  assert.equal(
    isRoleAssignableToUnit(packRole, company, unit.id, nodes, modules),
    true,
  );
});

test('refuse un rôle dont une fonctionnalité est bloquée par l’unité descendante', () => {
  assert.equal(
    isRoleAssignableToUnit(
      createRole({ 'transport:menu:vehicles': ['voir'] }),
      createCompany(),
      'unit-child',
      createNodes(),
      modules,
    ),
    false,
  );
});

test('refuse un rôle lié à un module qui n’est pas actif pour l’entreprise', () => {
  const company = createCompany();
  company.allowedModules = [];

  assert.equal(
    isRoleAssignableToUnit(
      createRole({ 'transport:menu:trips': ['voir'] }),
      company,
      'unit-child',
      createNodes(),
      modules,
    ),
    false,
  );
});

test('refuse une permission de modification qui ne respecte pas la chaîne des droits', () => {
  assert.equal(
    isRoleAssignableToUnit(
      createRole({ 'transport:menu:trips': ['voir', 'modifier'] }),
      createCompany(),
      'unit-child',
      createNodes(),
      modules,
    ),
    false,
  );
});