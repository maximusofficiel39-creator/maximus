import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAppAccessContext } from './app-access';
import { emptyStoreData, type Company, type Employee, type OrgNode, type Role } from './store';
import type { ServerModuleAccess } from './module-api';

function createAccessFixture() {
  const data = emptyStoreData();
  const company: Company = {
    id: 'company-test',
    name: 'Entreprise de test',
    manager: 'Awa Diallo',
    email: 'admin@company-test.example',
    phone: '',
    country: 'Sénégal',
    sector: 'Services',
    status: 'ACTIF',
    requestedModules: ['commerce'],
    allowedModules: ['commerce'],
    refusedModules: [],
    createdAt: '2026-09-07',
  };
  const node: OrgNode = {
    id: 'unit-test',
    companyId: company.id,
    name: 'Unité commerciale',
    type: 'service',
    parentId: null,
    moduleIds: ['commerce'],
  };
  const role: Role = {
    id: 'commerce-reader',
    companyId: company.id,
    sectorId: node.id,
    name: 'Lecteur commerce',
    description: '',
    modulePermissions: { commerce: ['voir', 'créer'] },
  };
  const employee: Employee = {
    id: 'employee-awa',
    firstName: 'Awa',
    lastName: 'Diallo',
    email: 'awa@company-test.example',
    phone: '',
    position: 'Commerciale',
    department: node.name,
    subDepartment: '',
    role: role.name,
    roleId: role.id,
    status: 'ACTIF',
    companyId: company.id,
    sectorId: node.id,
  };
  data.companies.push(company);
  data.orgNodes.push(node);
  data.roles.push(role);
  data.employees.push(employee);
  return { data, company, employee };
}

test('calcule un accès employé limité à son rôle et à son unité', () => {
  const { data, company, employee } = createAccessFixture();

  const access = buildAppAccessContext({
    data,
    session: `employee:${employee.id}`,
    employee,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
  });

  assert.equal(access.companyId, company.id);
  assert.ok(access.allowed.includes('commerce'));
  assert.ok(!access.allowed.includes('stocks'));
  assert.equal(access.hasPermission('commerce', 'créer'), true);
  assert.equal(access.hasPermission('stocks', 'voir'), false);
  assert.equal(access.sectorManager, false);
});

test('affiche en démonstration les fonctionnalités assignées dans la limite effective de l’unité', () => {
  const { data, company, employee } = createAccessFixture();
  company.requestedModules = ['stocks'];
  company.allowedModules = ['stocks'];
  company.requestedModuleFeatures = { stocks: ['products', 'reports'] };

  const unit = data.orgNodes[0]!;
  unit.moduleIds = ['stocks'];
  unit.moduleFeatures = { stocks: ['products'] };
  data.roles[0]!.modulePermissions = {
    'stocks:products': ['voir'],
    'stocks:reports': ['voir'],
  };

  const access = buildAppAccessContext({
    data,
    session: `employee:${employee.id}`,
    employee,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
  });

  assert.deepEqual(access.allowed, ['stocks']);
  assert.deepEqual(
    access.sidebarFeatureGroups.flatMap(group => group.items.map(item => item.href)),
    ['/entreprise/stocks?tab=products'],
  );
});

test('applique aux accès employés la limite de modules définie par les unités parentes', () => {
  const { data, company, employee } = createAccessFixture();
  const child = data.orgNodes[0]!;
  company.allowedModules = ['commerce', 'stocks'];
  company.requestedModules = ['commerce', 'stocks'];
  child.parentId = 'parent-unit';
  child.moduleIds = ['commerce', 'stocks'];
  data.orgNodes.push({
    id: 'parent-unit',
    companyId: company.id,
    name: 'Unité parente',
    parentId: null,
    moduleIds: ['commerce'],
  });
  data.roles[0]!.modulePermissions = {
    commerce: ['voir'],
    stocks: ['voir'],
  };

  const access = buildAppAccessContext({
    data,
    session: `employee:${employee.id}`,
    employee,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
  });

  assert.deepEqual(access.allowed, ['commerce']);
  assert.equal(access.hasPermission('stocks', 'voir'), false);
});

test('les droits Transport suivent les trois niveaux même pour une ancienne clé Courses', () => {
  const { data, company, employee } = createAccessFixture();
  company.allowedModules = ['transport'];
  company.requestedModules = ['transport'];
  data.orgNodes[0]!.moduleIds = ['transport'];
  const role = data.roles[0]!;

  const cases = [
    { permissions: ['voir'], canCreate: false, canModify: false },
    { permissions: ['voir', 'créer'], canCreate: true, canModify: false },
    { permissions: ['voir', 'créer', 'modifier'], canCreate: true, canModify: true },
  ] as const;

  for (const item of cases) {
    role.modulePermissions = {
      transport: ['voir'],
      'transport:menu:courses': [...item.permissions],
    };
    const access = buildAppAccessContext({
      data,
      session: `employee:${employee.id}`,
      employee,
      activeCompanyId: company.id,
      activeCompany: company,
      sectorTestCompanyId: null,
      serverModuleStatuses: null,
    });

    assert.equal(access.transportFeaturePermissions?.trips.canCreate, item.canCreate);
    assert.equal(access.transportFeaturePermissions?.trips.canModify, item.canModify);
  }
});

test('borne Présences au dossier de l’employé et aux fonctionnalités de son rôle', () => {
  const { data, company, employee } = createAccessFixture();
  const node = data.orgNodes[0]!;
  company.allowedModules = ['presences'];
  company.requestedModules = ['presences'];
  company.requestedModuleFeatures = {
    presences: ['tableau-de-bord', 'pointage', 'absences', 'congés', 'historique'],
  };
  node.moduleIds = ['presences'];
  const role = data.roles[0]!;
  role.name = 'Employé Présences';
  role.modulePermissions = {
    presences: ['voir'],
    'presence.tableau-de-bord': ['voir'],
    'presence.absences': ['voir', 'créer'],
    'presence.historique': ['voir'],
  };
  employee.role = role.name;
  employee.roleId = role.id;
  data.employees.push({
    ...employee,
    id: 'employee-other',
    firstName: 'Autre',
    email: 'other@company-test.example',
  });

  const access = buildAppAccessContext({
    data,
    session: `employee:${employee.id}`,
    employee,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
  });

  assert.deepEqual(access.presenceEmployees.map(item => item.id), [employee.id]);
  assert.deepEqual(access.selectedPresenceFeatureIds, ['tableau-de-bord', 'absences', 'historique']);
  assert.equal(access.hasPresencePermission('validate'), false);
});

test('calcule les permissions Transport séparément pour chaque rubrique', () => {
  const { data, company, employee } = createAccessFixture();
  const node = data.orgNodes[0]!;
  const role = data.roles[0]!;

  company.requestedModules = ['transport'];
  company.allowedModules = ['transport'];
  company.requestedModuleFeatures = {
    transport: ['overview', 'trips', 'drivers', 'vehicles'],
  };
  company.requestedModulePermissions = {
    transport: {
      overview: ['voir'],
      trips: ['voir'],
      drivers: ['voir', 'créer', 'modifier'],
      vehicles: ['voir'],
    },
  };
  node.moduleIds = ['transport'];
  role.modulePermissions = {
    transport: ['voir'],
    'transport:menu:overview': ['voir'],
    'transport:menu:trips': ['voir'],
    'transport:menu:drivers': ['voir', 'créer', 'modifier'],
    'transport:menu:vehicles': ['voir'],
  };

  const access = buildAppAccessContext({
    data,
    session: `employee:${employee.id}`,
    employee,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
  });

  assert.equal(access.transportFeaturePermissions?.trips?.canCreate, false);
  assert.equal(access.transportFeaturePermissions?.drivers?.canCreate, true);
  assert.equal(access.transportFeaturePermissions?.drivers?.canModify, true);
  assert.equal(access.transportFeaturePermissions?.vehicles?.canModify, false);
});

test('retire du menu Transport une fonctionnalité sélectionnée mais sans droit de lecture', () => {
  const { data, company, employee } = createAccessFixture();
  const node = data.orgNodes[0]!;
  const role = data.roles[0]!;
  company.allowedModules = ['transport'];
  company.requestedModuleFeatures = {
    transport: ['overview', 'trips', 'drivers', 'vehicles'],
  };
  node.moduleIds = ['transport'];
  node.moduleFeatures = {
    transport: ['overview', 'trips', 'drivers', 'vehicles'],
  };
  role.packId = 'transport-chauffeur';
  role.packModuleId = 'transport';
  role.modulePermissions = {
    transport: ['voir'],
    'transport:menu:overview': ['voir'],
    'transport:menu:trips': ['voir'],
    'transport:menu:historique': ['voir'],
    'transport:menu:parametres': ['voir'],
  };

  const access = buildAppAccessContext({
    data,
    session: `employee:${employee.id}`,
    employee,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
  });

  assert.deepEqual(access.selectedTransportFeatureIds, ['overview', 'trips']);
  assert.equal(access.selectedTransportFeatureIds?.includes('vehicles'), false);
});

test('limite un employé aux fonctionnalités Transport incluses dans le pack entreprise', () => {
  const { data, company, employee } = createAccessFixture();
  const node = data.orgNodes[0]!;
  const role = data.roles[0]!;
  company.allowedModules = ['transport'];
  company.requestedModulePackIds = { transport: ['transport-chauffeur'] };
  node.moduleIds = ['transport'];
  node.moduleFeatures = {
    transport: ['overview', 'trips', 'drivers', 'vehicles', 'historique', 'parametres'],
  };
  role.modulePermissions = { transport: ['voir'] };

  const access = buildAppAccessContext({
    data,
    session: `employee:${employee.id}`,
    employee,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
  });

  assert.deepEqual(access.selectedTransportFeatureIds, ['overview', 'trips', 'historique', 'parametres']);
});

test('affiche les modules dans le menu de l’administrateur d’entreprise', () => {
  const { data, company } = createAccessFixture();

  const access = buildAppAccessContext({
    data,
    session: `company:${company.id}`,
    employee: null,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
  });

  assert.deepEqual(access.allowed, ['commerce']);
  assert.equal(access.verticalModuleNavigation, true);
  assert.deepEqual(access.sidebarFeatureGroups.map(group => group.label), ['Commerce']);
  assert.ok(access.sidebarFeatureGroups[0]?.items.some(item => item.href === '/entreprise/commerce?tab=dashboard'));
});

test('affiche les fonctionnalités de tous les modules autorisés dans le menu entreprise', () => {
  const { data, company } = createAccessFixture();
  company.requestedModules = ['commerce', 'stocks', 'presences'];
  company.allowedModules = ['commerce', 'stocks', 'presences'];

  const access = buildAppAccessContext({
    data,
    session: `company:${company.id}`,
    employee: null,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
  });

  assert.deepEqual(access.sidebarFeatureGroups.map(group => group.label), [
    'Commerce',
    'Gestion de stock',
    'Présences',
  ]);
  assert.ok(access.sidebarFeatureGroups.every(group => group.items.length > 0));
  assert.equal(access.verticalModuleNavigation, true);
});

test('affiche les fonctionnalités Paie quand le module est autorisé sans sélection détaillée', () => {
  const { data, company } = createAccessFixture();
  company.requestedModules = ['paie'];
  company.allowedModules = ['paie'];
  delete company.requestedModuleFeatures;
  delete company.requestedModulePackIds;

  const access = buildAppAccessContext({
    data,
    session: `company:${company.id}`,
    employee: null,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
  });

  assert.equal(access.selectedPayrollFeatureIds, undefined);
  assert.deepEqual(
    access.sidebarFeatureGroups.find(group => group.label === 'Paie')?.items.map(item => item.label),
    ['Tableau de bord', 'Bénéficiaires', 'Préparer une paie', 'Validation', 'Virements', 'Solde de paie', 'Historique'],
  );
  assert.deepEqual(
    access.sidebarFeatureGroups.flatMap(group => group.items.map(item => item.href)),
    [
      '/entreprise/paie?feature=tableau-de-bord',
      '/entreprise/paie?feature=bénéficiaires',
      '/entreprise/paie?feature=préparer-une-paie',
      '/entreprise/paie?feature=validation',
      '/entreprise/paie?feature=virements',
      '/entreprise/paie?feature=solde-de-paie',
      '/entreprise/paie?feature=historique',
    ],
  );
});

test('conserve Paie quand MAXIMUS l’active après l’inscription', () => {
  const { data, company } = createAccessFixture();
  company.requestedModules = ['ecommerce'];
  company.allowedModules = ['ecommerce', 'paie'];
  delete company.requestedModuleFeatures;
  delete company.requestedModulePackIds;

  const access = buildAppAccessContext({
    data,
    session: `company:${company.id}`,
    employee: null,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: { ecommerce: 'ACTIF', paie: 'ACTIF' },
  });

  assert.ok(access.allowed.includes('paie'));
  assert.deepEqual(
    access.sidebarFeatureGroups.find(group => group.label === 'Paie')?.items.map(item => item.label),
    ['Tableau de bord', 'Bénéficiaires', 'Préparer une paie', 'Validation', 'Virements', 'Solde de paie', 'Historique'],
  );
  assert.deepEqual(
    access.sidebarFeatureGroups.find(group => group.label === 'Paie')?.items.map(item => item.href),
    [
      '/entreprise/paie?feature=tableau-de-bord',
      '/entreprise/paie?feature=bénéficiaires',
      '/entreprise/paie?feature=préparer-une-paie',
      '/entreprise/paie?feature=validation',
      '/entreprise/paie?feature=virements',
      '/entreprise/paie?feature=solde-de-paie',
      '/entreprise/paie?feature=historique',
    ],
  );
});

test('refuse un rôle de secteur qui sort du périmètre de son entreprise', () => {
  const { data, company, employee } = createAccessFixture();
  const foreignCompany = { ...company, id: 'foreign-company' };

  const access = buildAppAccessContext({
    data,
    session: `employee:${employee.id}`,
    employee: { ...employee, companyId: 'foreign-company' },
    activeCompanyId: 'foreign-company',
    activeCompany: foreignCompany,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
  });

  assert.deepEqual(access.allowed, []);
  assert.equal(access.hasPermission('finance', 'voir'), false);
});

test('applique les permissions du rôle pendant un test réel de secteur', () => {
  const { data, company, employee } = createAccessFixture();
  const testCompanyId = 'sector-test-company';
  const testNodeId = 'sector-test-node';
  const testRoleId = 'sector-test-role';
  const testCompany = {
    ...company,
    id: testCompanyId,
    allowedModules: ['commerce', 'stocks'] as const,
    managerRoleId: testRoleId,
  };
  const testNode = {
    ...data.orgNodes[0],
    id: testNodeId,
    companyId: testCompanyId,
  };
  const testRole = {
    ...data.roles[0],
    id: testRoleId,
    companyId: testCompanyId,
    sectorId: testNodeId,
  };
  data.companies = [testCompany];
  data.orgNodes = [testNode];
  data.roles = [testRole];

  const access = buildAppAccessContext({
    data,
    session: `company:${testCompanyId}`,
    employee: null,
    activeCompanyId: testCompanyId,
    activeCompany: testCompany,
    sectorTestCompanyId: testCompanyId,
    serverModuleStatuses: null,
  });

  assert.deepEqual(access.allowed, ['commerce']);
  assert.equal(access.hasPermission('commerce', 'créer'), true);
  assert.equal(access.hasPermission('stocks', 'voir'), false);
  assert.equal(access.sectorManager, false);
  assert.equal(employee.companyId, company.id);
});

test('affiche le menu des modules pendant un test réel de secteur', () => {
  const { data, company } = createAccessFixture();
  const testCompanyId = 'sector-test-menu-company';
  const testNodeId = 'sector-test-menu-node';
  const testRoleId = 'sector-test-menu-role';
  const testCompany = {
    ...company,
    id: testCompanyId,
    allowedModules: ['commerce'],
    managerRoleId: testRoleId,
  };
  const testNode = {
    ...data.orgNodes[0],
    id: testNodeId,
    companyId: testCompanyId,
  };
  const testRole = {
    ...data.roles[0],
    id: testRoleId,
    companyId: testCompanyId,
    sectorId: testNodeId,
  };
  data.companies = [testCompany];
  data.orgNodes = [testNode];
  data.roles = [testRole];

  const access = buildAppAccessContext({
    data,
    session: `company:${testCompanyId}`,
    employee: null,
    activeCompanyId: testCompanyId,
    activeCompany: testCompany,
    sectorTestCompanyId: testCompanyId,
    serverModuleStatuses: null,
  });

  assert.deepEqual(access.sidebarFeatureGroups.map(group => group.label), ['Commerce']);
  assert.equal(access.verticalModuleNavigation, true);
});

test('affiche immédiatement les modules du test réel sans attendre les accès serveur', () => {
  const { data, company } = createAccessFixture();
  const testCompanyId = 'sector-test-ready-company';
  const testNodeId = 'sector-test-ready-node';
  const testRoleId = 'sector-test-ready-role';
  const testCompany = {
    ...company,
    id: testCompanyId,
    allowedModules: ['commerce', 'stocks'],
    managerRoleId: testRoleId,
  };
  const testNode = {
    ...data.orgNodes[0],
    id: testNodeId,
    companyId: testCompanyId,
    moduleIds: ['commerce', 'stocks'],
  };
  const testRole = {
    ...data.roles[0],
    id: testRoleId,
    companyId: testCompanyId,
    sectorId: testNodeId,
    modulePermissions: {
      commerce: ['voir'],
      stocks: ['voir'],
    },
  };
  data.companies = [testCompany];
  data.orgNodes = [testNode];
  data.roles = [testRole];

  const access = buildAppAccessContext({
    data,
    session: `company:${testCompanyId}`,
    employee: null,
    activeCompanyId: testCompanyId,
    activeCompany: testCompany,
    sectorTestCompanyId: testCompanyId,
    serverModuleStatuses: null,
    serverModuleAccessReady: false,
  });

  assert.deepEqual(access.allowed, ['commerce', 'stocks']);
  assert.deepEqual(access.sidebarFeatureGroups.map(group => group.label), [
    'Commerce',
    'Gestion de stock',
  ]);
  assert.equal(access.verticalModuleNavigation, true);
});

test('limite le menu e-commerce de l’administrateur aux fonctionnalités choisies', () => {
  const { data, company } = createAccessFixture();
  company.requestedModules = ['commerce', 'ecommerce'];
  company.allowedModules = ['commerce', 'ecommerce'];
  company.requestedModulePackIds = {};
  company.requestedModuleFeatures = {
    commerce: ['sales'],
    ecommerce: ['dashboard', 'catalogue'],
  };

  const access = buildAppAccessContext({
    data,
    session: `company:${company.id}`,
    employee: null,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
  });

  assert.deepEqual(access.selectedEcommerceFeatureIds, ['dashboard', 'catalogue', 'parametres']);
  assert.equal(access.selectedEcommerceFeatureIds?.includes('vente-comptoir'), false);
  assert.equal(access.verticalModuleNavigation, true);
  assert.deepEqual(access.sidebarFeatureGroups.map(group => group.label), ['Commerce']);
  assert.deepEqual(
    access.sidebarFeatureGroups.find(group => group.label === 'Commerce')?.items.map(item => item.href),
    [
      '/entreprise/commerce?tab=sales',
      '/entreprise/ecommerce?tab=dashboard',
      '/entreprise/ecommerce?tab=catalogue',
      '/entreprise/ecommerce?tab=categories',
      '/entreprise/ecommerce?tab=parametres',
    ],
  );
});

test('ne donne pas automatiquement la vente comptoir aux anciens accès e-commerce', () => {
  const { data, company } = createAccessFixture();
  company.requestedModules = ['ecommerce'];
  company.allowedModules = ['ecommerce'];
  company.requestedModulePackIds = {};
  company.requestedModuleFeatures = {};

  const access = buildAppAccessContext({
    data,
    session: `company:${company.id}`,
    employee: null,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
  });

  assert.equal(access.selectedEcommerceFeatureIds?.includes('vente-comptoir'), false);
  assert.equal(access.sidebarFeatureGroups.some(group =>
    group.items.some(item => item.href.endsWith('?tab=vente-comptoir')),
  ), false);
});

test('utilise une autorisation Amicales active du serveur malgré une liste entreprise en retard', () => {
  const { data, company } = createAccessFixture();
  company.requestedModuleFeatures = { amicales: [] };
  const serverAccess: ServerModuleAccess = {
    id: 'amicales',
    name: 'Amicale étudiante',
    description: '',
    features: [],
    featurePacks: [],
    featureDependencies: {},
    status: 'ACTIF',
    featureIds: [],
    configuration: {},
  };

  const access = buildAppAccessContext({
    data,
    session: `company:${company.id}`,
    employee: null,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
    serverModuleAccess: [serverAccess],
    serverModuleAccessReady: true,
  });

  assert.ok(access.allowed.includes('amicales'));
  const amicaleGroup = access.sidebarFeatureGroups.find(group => group.label === 'Amicale étudiante');
  assert.ok(amicaleGroup);
  assert.ok(amicaleGroup.items.some(item => item.href.includes('?feature=dashboard')));
});

test('une sélection de fonctionnalités explicitement vide reste un refus', () => {
  const { data, company } = createAccessFixture();
  company.allowedModules = ['commerce', 'amicales'];
  company.requestedModules = ['commerce', 'amicales'];
  company.requestedModuleFeatures = { amicales: [] };
  const serverAccess: ServerModuleAccess = {
    id: 'amicales',
    name: 'Amicale étudiante',
    description: '',
    features: [],
    featurePacks: [],
    featureDependencies: {},
    status: 'ACTIF',
    featureIds: [],
    configuration: { featureScope: 'explicit' },
  };

  const access = buildAppAccessContext({
    data,
    session: `company:${company.id}`,
    employee: null,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
    serverModuleAccess: [serverAccess],
    serverModuleAccessReady: true,
  });

  assert.ok(access.allowed.includes('amicales'));
  assert.equal(access.sidebarFeatureGroups.some(group => group.label === 'Amicale étudiante'), false);
});

test('un accès serveur désactivé prévaut sur un ancien module localement autorisé', () => {
  const { data, company } = createAccessFixture();
  company.allowedModules = ['commerce', 'amicales'];
  company.requestedModules = ['commerce', 'amicales'];
  const serverAccess: ServerModuleAccess = {
    id: 'amicales',
    name: 'Amicale étudiante',
    description: '',
    features: [],
    featurePacks: [],
    featureDependencies: {},
    status: 'INACTIF',
    featureIds: [],
    configuration: {},
  };

  const access = buildAppAccessContext({
    data,
    session: `company:${company.id}`,
    employee: null,
    activeCompanyId: company.id,
    activeCompany: company,
    sectorTestCompanyId: null,
    serverModuleStatuses: null,
    serverModuleAccess: [serverAccess],
    serverModuleAccessReady: true,
  });

  assert.equal(access.allowed.includes('amicales'), false);
});