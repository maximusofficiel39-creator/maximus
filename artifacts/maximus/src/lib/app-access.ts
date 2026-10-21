import type { Company, Employee, ModuleAvailability, ModuleId, OrgNode, Role, StoreData } from './store';
import type { Session, SidebarFeatureGroup } from './navigation';
import {
  employeeHasPresencePermission,
  employeeRoleMatchesUnit,
  getCommerceTabIds,
  getEmployeeAncestry,
  getSelectedFeatureIds,
  getFeaturePermissions,
  getStockPermissions,
  restrictRoleToCompany,
  normalizeTransportRolePermissions,
  roleHasFeaturePermission,
  roleHasPermission,
  type ModulePermission,
  type PresencePermission,
} from './employee-permissions';
import { commerceTabDefinitions } from './commerce-permissions';
import { getConfiguredModules } from './store';
import { getEffectiveModuleFeatureIds, getModuleFeatureOptions } from './module-features';
import { getEffectiveUnitModuleIds } from './organization-module-scope';
import { buildSidebarFeatureGroups } from './sidebar-navigation';
import type { ServerModuleAccess } from './module-api';

export type AppAccessInput = {
  data: StoreData;
  session: Session;
  employee: Employee | null;
  activeCompanyId?: string;
  activeCompany?: Company;
  sectorTestCompanyId: string | null;
  serverModuleStatuses: Record<string, ModuleAvailability> | null;
  serverModuleAccess?: ServerModuleAccess[] | null;
  serverModuleAccessReady?: boolean;
};

export type AppAccessContext = {
  companyId: string;
  accessRole: Role | null;
  employeeNode: OrgNode | null;
  allowed: ModuleId[];
  canViewModule: (moduleId: ModuleId) => boolean;
  hasPermission: (moduleId: ModuleId, permission: ModulePermission) => boolean;
  hasPresencePermission: (permission: PresencePermission) => boolean;
  presenceEmployees: Employee[];
  selectedPresenceFeatureIds?: string[];
  selectedEcommerceFeatureIds?: string[];
  selectedPayrollFeatureIds?: string[];
  selectedTransportFeatureIds?: string[];
  transportFeaturePermissions?: Record<string, { canCreate: boolean; canModify: boolean }>;
  ecommerceFeaturePermissions?: Partial<Record<string, string[]>>;
  payrollFeaturePermissions?: Partial<Record<string, string[]>>;
  commerceTabPermissions?: Partial<Record<string, string[]>>;
  moduleFeaturePermissions?: Partial<Record<ModuleId, Partial<Record<string, string[]>>>>;
  stockPermissions?: Record<string, string[]>;
  commerceTabIds?: string[];
  sidebarFeatureGroups: SidebarFeatureGroup[];
  verticalModuleNavigation: boolean;
  sectorManager: boolean;
  canManagePeople: boolean;
};

export function buildAppAccessContext({
  data,
  session,
  employee,
  activeCompanyId,
  activeCompany,
  sectorTestCompanyId,
  serverModuleStatuses,
  serverModuleAccess = null,
  serverModuleAccessReady = true,
}: AppAccessInput): AppAccessContext {
  const companyId = activeCompanyId ?? '';
  const configuredModules = getConfiguredModules(data);
  const rawEmployeeRole = employee
    ? (data.roles.find(role => role.id === employee.roleId) ?? data.roles.find(role => role.name === employee.role))
    : null;
  const rawTestCompanyRole =
    sectorTestCompanyId && activeCompany?.managerRoleId
      ? data.roles.find(role => role.id === activeCompany.managerRoleId) ?? null
      : null;
  const accessRole = restrictRoleToCompany(
    normalizeTransportRolePermissions(rawEmployeeRole ?? rawTestCompanyRole),
    activeCompany,
  );
  const moduleStatus = (moduleId: ModuleId): ModuleAvailability =>
    serverModuleAccess?.find((item) => item.id === moduleId)?.status ??
    serverModuleStatuses?.[moduleId] ??
    data.moduleStatuses?.[moduleId] ??
    configuredModules.find(module => module.id === moduleId)?.status ??
    'INACTIF';
  const isModuleActive = (moduleId: ModuleId) => !['INACTIF', 'MAINTENANCE'].includes(moduleStatus(moduleId));
  const localCompanyAllowed = data.companies.find(company => company.id === companyId)?.allowedModules ?? [];
  const serverCompanyAllowed = (serverModuleAccess ?? [])
    .filter(module => module.status === 'ACTIF' || module.status === 'BETA')
    .map(module => module.id as ModuleId);
  const companyAllowed = (sectorTestCompanyId
    ? localCompanyAllowed
    : serverModuleAccessReady
      ? [...new Set([...localCompanyAllowed, ...serverCompanyAllowed])]
      : [])
    .filter(isModuleActive);
  const companyAdmin = session.startsWith('company:') && !sectorTestCompanyId;
  const keepCompanySettings = (
    module: NonNullable<typeof configuredModules[number]>,
    featureIds: string[],
    preserveAdminSettings = true,
  ) =>
    preserveAdminSettings && module.id === 'ecommerce' && companyAdmin
      ? [...new Set([...featureIds, 'parametres'])]
      : featureIds;
  const companySelectedFeatureIds = (module: NonNullable<typeof configuredModules[number]>) => {
    if (!companyAdmin || !activeCompany) return undefined;

    const serverAccess = serverModuleAccess?.find((item) => item.id === module.id);
    const serverConfiguration = serverAccess?.configuration;
    const serverFeatureIds = serverAccess?.featureIds;
    const hasExplicitServerSelection =
      Array.isArray(serverFeatureIds)
      && (serverFeatureIds.length > 0 || serverConfiguration?.featureScope === 'explicit');
    const selectedPackIds = activeCompany.requestedModulePackIds?.[module.id] ?? [];
    if (selectedPackIds.length > 0) {
      const packFeatures = [
        ...new Set(
          (module.featurePacks ?? [])
            .filter(pack => selectedPackIds.includes(pack.id))
            .flatMap(pack => pack.featureIds),
        ),
      ];
      return keepCompanySettings(
        module,
        hasExplicitServerSelection
          ? [...getEffectiveModuleFeatureIds(module, serverFeatureIds ?? [])]
          : [...getEffectiveModuleFeatureIds(module, packFeatures)],
        !hasExplicitServerSelection,
      );
    }

    if (hasExplicitServerSelection) {
      return keepCompanySettings(module, [...getEffectiveModuleFeatureIds(module, serverFeatureIds ?? [])], false);
    }

    const requestedFeatures = activeCompany.requestedModuleFeatures;
    const requestedFeatureIds = requestedFeatures?.[module.id];
    if (
      !requestedFeatures
      || !Object.prototype.hasOwnProperty.call(requestedFeatures, module.id)
      || !Array.isArray(requestedFeatureIds)
      || requestedFeatureIds.length === 0
    ) {
      // Comme les autres modules, un module autorisé sans sélection détaillée
      // expose ses fonctionnalités. Une sélection explicitement vide est
      // reconnue par featureScope=explicit dans l’accès serveur ci-dessus.
      // Les nouvelles capacités du Commerce unifié restent opt-in.
      return module.id === 'ecommerce'
        ? getModuleFeatureOptions(module)
          .map(feature => feature.id)
          .filter(featureId => !['vente-comptoir', 'rapport-ventes', 'depenses', 'investissements'].includes(featureId))
        : undefined;
    }

    return keepCompanySettings(module, [
      ...getEffectiveModuleFeatureIds(module, requestedFeatures[module.id] ?? []),
    ]);
  };
  const companyFeatureCeiling = (module: NonNullable<typeof configuredModules[number]>) => {
    if (!activeCompany) return undefined;

    const serverAccess = serverModuleAccess?.find((item) => item.id === module.id);
    const serverConfiguration = serverAccess?.configuration;
    const serverFeatureIds = serverAccess?.featureIds;
    const hasExplicitServerSelection =
      Array.isArray(serverFeatureIds)
      && (serverFeatureIds.length > 0 || serverConfiguration?.featureScope === 'explicit');
    if (hasExplicitServerSelection) {
      return new Set(getEffectiveModuleFeatureIds(module, serverFeatureIds ?? []));
    }

    const selectedPackIds = activeCompany.requestedModulePackIds?.[module.id] ?? [];
    if (selectedPackIds.length > 0) {
      return new Set(
        getEffectiveModuleFeatureIds(module, (module.featurePacks ?? [])
          .filter(pack => selectedPackIds.includes(pack.id))
          .flatMap(pack => pack.featureIds)),
      );
    }

    const requestedFeatures = activeCompany.requestedModuleFeatures;
    const requestedFeatureIds = requestedFeatures?.[module.id];
    if (
      !requestedFeatures
      || !Object.prototype.hasOwnProperty.call(requestedFeatures, module.id)
      || !Array.isArray(requestedFeatureIds)
      || requestedFeatureIds.length === 0
    ) {
      return module.id === 'ecommerce'
        ? new Set(getModuleFeatureOptions(module)
          .map(feature => feature.id)
          .filter(featureId => !['vente-comptoir', 'rapport-ventes', 'depenses', 'investissements'].includes(featureId)))
        : undefined;
    }
    return new Set(getEffectiveModuleFeatureIds(module, requestedFeatures[module.id] ?? []));
  };
  const selectedFeatureIdsByModule = Object.fromEntries(
    configuredModules
      .map(module => [module.id, companySelectedFeatureIds(module)] as const)
      .filter(([, featureIds]) => featureIds !== undefined),
  ) as Partial<Record<ModuleId, string[]>>;
  const rawEmployeeNode = employee?.sectorId
    ? data.orgNodes.find(node => node.id === employee.sectorId && node.companyId === employee.companyId) ?? null
    : sectorTestCompanyId && accessRole?.sectorId
      ? data.orgNodes.find(node => node.id === accessRole.sectorId && node.companyId === companyId) ?? null
      : null;
  const effectiveUnitModuleIds = getEffectiveUnitModuleIds(data.orgNodes, rawEmployeeNode);
  const employeeNode = rawEmployeeNode
    ? {
        ...rawEmployeeNode,
        moduleIds: effectiveUnitModuleIds ? [...effectiveUnitModuleIds] : rawEmployeeNode.moduleIds,
      }
    : null;
  const employeeAncestry = getEmployeeAncestry(data.orgNodes, employeeNode);
  const accessRoleMatchesScope = sectorTestCompanyId
    ? Boolean(accessRole && employeeNode && accessRole.companyId === companyId && accessRole.sectorId === employeeNode.id)
    : employeeRoleMatchesUnit(accessRole, employee, employeeAncestry);
  const canViewModule = (moduleId: ModuleId) => roleHasPermission(accessRole, employeeNode, moduleId, 'voir');
  const allowed =
    session.startsWith('company:') && !sectorTestCompanyId
      ? companyAllowed
      : sectorTestCompanyId && accessRole && accessRoleMatchesScope
        ? companyAllowed.filter(moduleId => canViewModule(moduleId))
        : accessRole && accessRoleMatchesScope
          ? companyAllowed.filter(moduleId => canViewModule(moduleId))
          : [];
  const hasPermission = (moduleId: ModuleId, permission: ModulePermission) => {
    if (session.startsWith('company:') && !sectorTestCompanyId) return true;
    if (!accessRoleMatchesScope || !accessRole) return false;
    return roleHasPermission(accessRole, employeeNode, moduleId, permission);
  };
  const hasPresencePermission = (permission: PresencePermission) => {
    if (session.startsWith('company:') && !sectorTestCompanyId) return true;
    if (!accessRoleMatchesScope || !accessRole) return false;
    return employeeHasPresencePermission(accessRole, employeeNode, permission, hasPermission);
  };

  const permissionsForFeature = (
    module: NonNullable<typeof configuredModules[number]> | undefined,
    featureId: string,
  ) => {
    if (!module) return [];
    if (companyAdmin) return ['voir', 'créer', 'modifier'];
    if (!accessRoleMatchesScope || !accessRole) return [];
    const ceiling = companyFeatureCeiling(module);
    if (ceiling && !ceiling.has(featureId)) return [];
    return getFeaturePermissions(accessRole, employeeNode, module.id, featureId);
  };

  const presenceModule = configuredModules.find(module => module.id === 'presences');
  const selectedPresenceFeatureIds =
    presenceModule && companyAdmin
      ? companySelectedFeatureIds(presenceModule)
      : accessRole && presenceModule
        ? [...getSelectedFeatureIds(accessRole, presenceModule, employeeNode?.moduleFeatures?.[presenceModule.id])]
          .filter(featureId => {
            const ceiling = companyFeatureCeiling(presenceModule);
            return (!ceiling || ceiling.has(featureId))
              && roleHasFeaturePermission(accessRole, employeeNode, presenceModule.id, featureId, 'voir');
          })
      : undefined;
  const ecommerceModule = configuredModules.find(module => module.id === 'ecommerce');
  const selectedEcommerceFeatureIds =
    ecommerceModule && companyAdmin
      ? companySelectedFeatureIds(ecommerceModule)
      : accessRole && ecommerceModule
        ? [...getSelectedFeatureIds(accessRole, ecommerceModule, employeeNode?.moduleFeatures?.[ecommerceModule.id])]
          .filter(featureId => {
            const ceiling = companyFeatureCeiling(ecommerceModule);
            return (!ceiling || ceiling.has(featureId))
              && (featureId !== 'rapport-ventes'
                || roleHasFeaturePermission(accessRole, employeeNode, ecommerceModule.id, featureId, 'voir'));
          })
        : undefined;
  const payrollModule = configuredModules.find(module => module.id === 'paie');
  const selectedPayrollFeatureIds =
    payrollModule && companyAdmin
      ? companySelectedFeatureIds(payrollModule)
      : accessRole && payrollModule
        ? [...getSelectedFeatureIds(accessRole, payrollModule, employeeNode?.moduleFeatures?.[payrollModule.id])]
        : undefined;
  const transportModule = configuredModules.find(module => module.id === 'transport');
  const selectedTransportFeatureIds =
    transportModule && companyAdmin
      ? companySelectedFeatureIds(transportModule)
      : accessRole && transportModule
        ? [...getSelectedFeatureIds(accessRole, transportModule, employeeNode?.moduleFeatures?.[transportModule.id])]
          .filter(featureId => {
            const ceiling = companyFeatureCeiling(transportModule);
            return (!ceiling || ceiling.has(featureId))
              && roleHasFeaturePermission(accessRole, employeeNode, transportModule.id, featureId, 'voir');
          })
        : undefined;
  const transportFeaturePermissions = transportModule
    ? Object.fromEntries(
      getModuleFeatureOptions(transportModule).map(feature => [
        feature.id,
        {
          canCreate: companyAdmin
            || (roleHasFeaturePermission(accessRole, employeeNode, transportModule.id, feature.id, 'voir')
              && roleHasFeaturePermission(accessRole, employeeNode, transportModule.id, feature.id, 'créer')),
          canModify: companyAdmin
            || (roleHasFeaturePermission(accessRole, employeeNode, transportModule.id, feature.id, 'voir')
              && roleHasFeaturePermission(accessRole, employeeNode, transportModule.id, feature.id, 'créer')
              && roleHasFeaturePermission(accessRole, employeeNode, transportModule.id, feature.id, 'modifier')),
        },
      ]),
    )
    : undefined;
  const sectorManager = Boolean(employee?.isSectorAdmin && employeeNode && accessRole && accessRoleMatchesScope);
  const presenceEmployees = data.employees
    .filter(item => item.companyId === companyId)
    .filter(item => {
      if (employee && !companyAdmin && !sectorManager) return item.id === employee.id;
      if (!sectorManager || !employeeNode?.id) return true;
      let node = data.orgNodes.find(candidate => candidate.id === item.sectorId && candidate.companyId === companyId);
      while (node) {
        if (node.id === employeeNode.id) return true;
        node = node.parentId
          ? data.orgNodes.find(candidate => candidate.id === node?.parentId && candidate.companyId === companyId)
          : undefined;
      }
      return false;
    });

  const stockModule = configuredModules.find(module => module.id === 'stocks');
  const commerceModule = configuredModules.find(module => module.id === 'commerce');
  const salesModule = configuredModules.find(module => module.id === 'ventes');
  const selectedStockFeatureIds =
    accessRole && stockModule
      ? getSelectedFeatureIds(accessRole, stockModule, employeeNode?.moduleFeatures?.[stockModule.id])
      : undefined;
  const ecommerceFeaturePermissions = ecommerceModule
    ? Object.fromEntries(
      getModuleFeatureOptions(ecommerceModule).map(feature => [
        feature.id,
        permissionsForFeature(ecommerceModule, feature.id),
      ]),
    )
    : undefined;
  const payrollFeaturePermissions = payrollModule
    ? Object.fromEntries(
      getModuleFeatureOptions(payrollModule).map(feature => [
        feature.id,
        permissionsForFeature(payrollModule, feature.id),
      ]),
    )
    : undefined;
  const moduleFeaturePermissions = Object.fromEntries(
    configuredModules.map(module => [
      module.id,
      Object.fromEntries(
        getModuleFeatureOptions(module).map(feature => [
          feature.id,
          permissionsForFeature(module, feature.id),
        ]),
      ),
    ]),
  ) as Partial<Record<ModuleId, Partial<Record<string, string[]>>>>;
  const selectedCommerceFeatureIds =
    accessRole && commerceModule
      ? getSelectedFeatureIds(accessRole, commerceModule, employeeNode?.moduleFeatures?.[commerceModule.id])
      : undefined;
  const selectedSalesFeatureIds =
    accessRole && salesModule
      ? getSelectedFeatureIds(accessRole, salesModule, employeeNode?.moduleFeatures?.[salesModule.id])
      : undefined;
  const selectedCommercialTabIds =
    selectedCommerceFeatureIds !== undefined || selectedSalesFeatureIds !== undefined
      ? new Set([
          ...(selectedCommerceFeatureIds ?? []),
          ...[...(selectedSalesFeatureIds ?? [])].flatMap(featureId =>
            featureId === 'devis' || featureId === 'commandes'
              ? ['sales']
              : featureId === 'facturation'
                ? ['invoices']
                : [],
          ),
        ])
      : undefined;
  const stockPermissions = getStockPermissions(accessRole, accessRoleMatchesScope, selectedStockFeatureIds);
  const commerceTabIds = getCommerceTabIds(
    accessRole,
    accessRoleMatchesScope,
    canViewModule,
    selectedCommercialTabIds,
  );
  const commerceTabPermissions = commerceTabDefinitions.reduce<Record<string, string[]>>((permissions, tab) => {
    const values = new Set<string>(permissionsForFeature(commerceModule, tab.id));
    if (tab.id === 'sales') {
      ['devis', 'commandes'].forEach(featureId => {
        permissionsForFeature(salesModule, featureId).forEach(permission => values.add(permission));
      });
    }
    if (tab.id === 'invoices') {
      permissionsForFeature(salesModule, 'facturation').forEach(permission => values.add(permission));
    }
    permissions[tab.id] = [...values];
    return permissions;
  }, {});
  const sidebarFeatureGroups: SidebarFeatureGroup[] =
    (employee || sectorTestCompanyId || companyAdmin) && allowed.length >= 1
      ? buildSidebarFeatureGroups({
          allowed,
          configuredModules,
          employeeRole: accessRole,
          employeeNode,
          companyAdmin,
          selectedFeatureIdsByModule,
          ecommerceFeatureIds: selectedEcommerceFeatureIds,
          commerceTabIds,
          stockPermissions,
        })
      : [];

  return {
    companyId,
    accessRole,
    employeeNode,
    allowed,
    canViewModule,
    hasPermission,
    hasPresencePermission,
    presenceEmployees,
    selectedPresenceFeatureIds,
    selectedEcommerceFeatureIds,
    selectedPayrollFeatureIds,
    selectedTransportFeatureIds,
    transportFeaturePermissions,
    ecommerceFeaturePermissions,
    payrollFeaturePermissions,
    commerceTabPermissions,
    moduleFeaturePermissions,
    stockPermissions,
    commerceTabIds,
    sidebarFeatureGroups,
    verticalModuleNavigation: Boolean(
      (employee || sectorTestCompanyId || companyAdmin)
      && allowed.length >= 1
      && sidebarFeatureGroups.length,
    ),
    sectorManager,
    canManagePeople: session.startsWith('company:') || sectorManager,
  };
}