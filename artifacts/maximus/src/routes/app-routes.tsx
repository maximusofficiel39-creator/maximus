import type { ComponentType, ReactElement } from 'react';
import type { ModuleAvailability, ModuleId, SectorPreset, StoreData } from '@/lib/store';
import type { Employee } from '@/lib/store';
import type { PresencePermission } from '@/lib/employee-permissions';
import { effectiveFeaturePermissions, hasEffectivePermission } from '@/lib/employee-permissions';
import { moduleDescriptorById, moduleIdForPath } from '@/lib/module-registry';
import { normalizeRoutePath } from '@/lib/navigation';
import { buildAdminAssistantInsights } from '@/lib/local-assistant';
import type { AdminAssistantScope } from '@/lib/local-assistant';
import { normalizePayrollFeatureId } from '@/lib/payroll-features';
import type { MaximusAssistantAction, MaximusAssistantMessage, MaximusAssistantResponse } from '@/lib/maximus-assistant-api';
import { getAdminControlRoute, getCompanyControlCapabilities } from '@/lib/control-routing';
import { canAccessCompanySetupGuide, type CompanyWorkspaceFeatureId } from '@/lib/company-workspace-features';
import { resolveAmicaleAllowedFeatureIds } from '@/lib/amicales-features';

/**
 * The screen registry contains components with different prop contracts.
 * Keeping the registry opaque prevents `any` from leaking into the router;
 * `renderScreen` is the single boundary where a route supplies its contract.
 */
type Screen = ComponentType<never>;
type Mutate = (fn: (data: StoreData) => void, message?: string) => void;
type Navigate = (path: string) => void;
type Refresh = () => Promise<boolean>;

function renderScreen<Props extends object>(screen: Screen, props: Props): ReactElement | null {
  const ScreenComponent = screen as ComponentType<Props>;
  return <ScreenComponent {...props} />;
}

function renderCompanyModule<Props extends object>(screen: Screen, props: Props) {
  // La navigation des fonctionnalités est fournie par l’espace entreprise :
  // menu vertical ou rail horizontal selon le réglage de l’entreprise.
  return renderScreen(screen, { ...props, singleModuleNavigation: true });
}

export type AdminRouteScreens = {
  dashboard: Screen;
  assistant: Screen;
  control: Screen;
  surveillance: Screen;
  organization: Screen;
  companyDetail: Screen;
  companies: Screen;
  requests: Screen;
  modules: Screen;
  sectors: Screen;
  subscriptions: Screen;
  notifications: Screen;
  journal: Screen;
  platformSettings: Screen;
  empty: Screen;
};

export function AdminRouter({
  location,
  data,
  mutate,
  notify,
  onNavigate,
  onRefresh,
  onBack,
  onModuleAccess,
  onTestSector,
  assistantScope,
  onAskAssistant,
  onPreviewAssistantAction,
  onExecuteAssistantAction,
  screens,
}: {
  location: string;
  data: StoreData;
  mutate: Mutate;
  notify: (message: string) => void;
  onNavigate: Navigate;
  onRefresh: Refresh;
  onBack: (fallback: string) => void;
  onModuleAccess: (companyId: string, moduleId: ModuleId, status: ModuleAvailability) => Promise<void>;
  onTestSector: (preset: SectorPreset) => void;
  assistantScope: AdminAssistantScope;
  onAskAssistant: (question: string, history?: MaximusAssistantMessage[]) => MaximusAssistantResponse | Promise<MaximusAssistantResponse>;
  onPreviewAssistantAction: (action: MaximusAssistantAction) => Promise<MaximusAssistantResponse>;
  onExecuteAssistantAction: (action: MaximusAssistantAction) => Promise<MaximusAssistantResponse>;
  screens: AdminRouteScreens;
}) {
  const routePath = normalizeRoutePath(location);
  if (routePath === '/maximus/dashboard') {
    return renderScreen(screens.dashboard, { data, onNavigate });
  }
  if (routePath === '/maximus/assistant') {
    return renderScreen(screens.assistant, {
      workspaceContext: {
        name: 'Administration principale MAXIMUS',
        scopeLabel: 'Périmètre global de configuration',
        description: 'Comprendre et piloter les modules, les packs, les secteurs, les entreprises, les organisations et les règles d’accès.',
      },
      insightCards: buildAdminAssistantInsights(assistantScope),
      onAsk: onAskAssistant,
      onPreviewAction: onPreviewAssistantAction,
      onExecuteAction: onExecuteAssistantAction,
      onWorkspaceChanged: onRefresh,
    });
  }
  if (getAdminControlRoute(location) === 'coordination') {
    return renderScreen(screens.control, { data, isAdmin: true, mutate, notify, actorName: 'Équipe MAXIMUS' });
  }
  if (getAdminControlRoute(location) === 'surveillance') {
    return renderScreen(screens.surveillance, {});
  }
  if (routePath === '/maximus/entreprises/organisation') {
    return renderScreen(screens.organization, { data, mutate, onNavigate });
  }
  const companyDetailMatch = routePath.match(/^\/maximus\/entreprises\/([^/]+)$/);
  if (companyDetailMatch) {
    const companyId = decodeURIComponent(companyDetailMatch[1]);
    const company = data.companies.find(item => item.id === companyId);
    return company ? (
      renderScreen(screens.companyDetail, {
        company,
        data,
        mutate,
        onModuleAccess,
        onBack: () => onBack('/maximus/entreprises'),
      })
    ) : (
      renderScreen(screens.empty, {
        title: 'Entreprise introuvable',
        text: 'L’espace demandé est introuvable.',
        action: () => onBack('/maximus/entreprises'),
      })
    );
  }
  if (routePath === '/maximus/entreprises') {
    return renderScreen(screens.companies, { data, mutate, onNavigate, detail: false });
  }
  if (routePath === '/maximus/demandes') {
    return renderScreen(screens.requests, { data, mutate, notify, onNavigate });
  }
  if (routePath === '/maximus/modules') {
    return renderScreen(screens.modules, { data, mutate, notify });
  }
  if (routePath === '/maximus/secteurs') {
    return renderScreen(screens.sectors, { data, mutate, onTestSector });
  }
  if (routePath === '/maximus/abonnements') {
    return renderScreen(screens.subscriptions, { data, onNavigate, onRefresh });
  }
  if (routePath === '/maximus/notifications') {
    return renderScreen(screens.notifications, { data, mutate, context: { isAdmin: true } });
  }
  if (routePath === '/maximus/journal') {
    return renderScreen(screens.journal, { data });
  }
  if (routePath === '/maximus/parametres/portefeuille') {
    return renderScreen(screens.platformSettings, {});
  }
  return renderScreen(screens.empty, {
    title: 'Cette vue n’existe pas encore',
    text: 'Revenez au cockpit pour poursuivre.',
    action: () => onNavigate('/maximus/dashboard'),
  });
}

export type CompanyRouteScreens = {
  dashboard: Screen;
  control: Screen;
  notifications: Screen;
  setupGuide: Screen;
  organization: Screen;
  empty: Screen;
  stocks: Screen;
  ecommerce: Screen;
  immobilier: Screen;
  amicales: Screen;
  finance: Screen;
  commerce: Screen;
  operational: Screen;
  transport: Screen;
  payroll: Screen;
  humanResources: Screen;
  presence: Screen;
  reports: Screen;
};

export function CompanyRouter({
  location,
  data,
  mutate,
  notify,
  onNavigate,
  onBack,
  allowed,
  canManagePeople,
  companyAdmin,
  sectorManager,
  scopeNodeId,
  companyId,
  employee,
  employees,
  presenceEmployees,
  presenceFeatureIds,
  ecommerceFeatureIds,
  payrollFeatureIds,
  payrollFeaturePermissions,
  moduleFeaturePermissions,
  transportFeatureIds,
  transportFeaturePermissions,
  ecommerceFeaturePermissions,
  hasPermission,
  hasPresencePermission,
  stockPermissions,
  commerceTabIds,
  commerceTabPermissions,
  moduleStatuses,
  serverModuleAccess,
  serverModuleAccessReady = true,
  serverModuleAccessError = '',
  hiddenWorkspaceFeatures,
  screens,
}: {
  location: string;
  data: StoreData;
  mutate: Mutate;
  notify: (message: string) => void;
  onNavigate: Navigate;
  onBack: (fallback: string) => void;
  allowed: ModuleId[];
  canManagePeople: boolean;
  companyAdmin: boolean;
  sectorManager: boolean;
  scopeNodeId?: string;
  companyId: string;
  employee: StoreData['employees'][number] | null;
  employees: StoreData['employees'];
  presenceEmployees: Employee[];
  presenceFeatureIds?: string[];
  ecommerceFeatureIds?: string[];
  payrollFeatureIds?: string[];
  payrollFeaturePermissions?: Partial<Record<string, string[]>>;
  moduleFeaturePermissions?: Partial<Record<ModuleId, Partial<Record<string, string[]>>>>;
  transportFeatureIds?: string[];
  transportFeaturePermissions?: Record<string, { canCreate: boolean; canModify: boolean }>;
  ecommerceFeaturePermissions?: Partial<Record<string, string[]>>;
  hasPermission: (moduleId: ModuleId, permission: 'voir' | 'créer' | 'modifier') => boolean;
  hasPresencePermission: (permission: PresencePermission) => boolean;
  stockPermissions?: Record<string, string[]>;
  commerceTabIds?: string[];
  commerceTabPermissions?: Partial<Record<string, string[]>>;
  moduleStatuses: Record<string, ModuleAvailability>;
  serverModuleAccess?: import('@/lib/module-api').ServerModuleAccess[] | null;
  serverModuleAccessReady?: boolean;
  serverModuleAccessError?: string;
  screens: CompanyRouteScreens;
  hiddenWorkspaceFeatures?: CompanyWorkspaceFeatureId[];
}) {
  const routePath = normalizeRoutePath(location);
  const query = new URLSearchParams(location.split('?')[1] ?? '');
  const hiddenWorkspaceFeatureSet = new Set(hiddenWorkspaceFeatures ?? []);
  const isWorkspaceFeatureHidden = (featureId: CompanyWorkspaceFeatureId) =>
    hiddenWorkspaceFeatureSet.has(featureId);
  const effective = (moduleId: ModuleId, permission: 'voir' | 'créer' | 'modifier') =>
    hasEffectivePermission(hasPermission, moduleId, permission);
  const effectiveFeatures = (features: Partial<Record<string, string[]>> | undefined) =>
    features && Object.fromEntries(
      Object.entries(features).map(([featureId, permissions]) => [
        featureId,
        effectiveFeaturePermissions(permissions) ?? [],
      ]),
    ) as Partial<Record<string, string[]>> | undefined;
  const routeModuleOverrides: Partial<Record<string, ModuleId>> = {
    '/entreprise/finance': 'finance',
    '/entreprise/rh': 'rh',
    '/entreprise/rapports': 'rapports',
  };
  const requiredModule = moduleIdForPath(routePath) ?? routeModuleOverrides[routePath];
  const maintenanceModule: ModuleId | 'controle' | undefined =
    routePath === '/entreprise/controle' ? 'controle' : requiredModule;
  if (maintenanceModule && (serverModuleAccess?.find((item) => item.id === maintenanceModule)?.status ?? moduleStatuses[maintenanceModule]) === 'MAINTENANCE') {
    return renderScreen(screens.empty, {
      title: 'Module en maintenance',
      text: 'Ce module est temporairement indisponible pendant une opération de maintenance. Les autres modules restent accessibles.',
      action: () => onBack('/entreprise/dashboard'),
    });
  }
  if (requiredModule && !serverModuleAccessReady) {
    return renderScreen(screens.empty, {
      title: serverModuleAccessError ? 'Vérification de l’accès impossible' : 'Vérification de l’accès en cours',
      text: serverModuleAccessError
        ? 'Nous ne pouvons pas confirmer vos droits pour le moment. Réessayez dans quelques instants ou contactez l’administrateur de votre entreprise.'
        : 'Nous vérifions les accès de votre entreprise. Cette page s’ouvrira dès que la vérification sera terminée.',
      action: () => onBack('/entreprise/dashboard'),
    });
  }
  if (requiredModule && !allowed.includes(requiredModule)) {
    return renderScreen(screens.empty, {
      title: 'Accès non autorisé',
      text: 'Votre rôle ne possède pas la permission Consulter pour ce module.',
      action: () => onBack('/entreprise/dashboard'),
    });
  }
  if (routePath === '/entreprise/dashboard') {
    return renderScreen(screens.dashboard, {
      data,
      onNavigate,
      allowed,
      companyId,
      hiddenWorkspaceFeatures,
    });
  }
  if (routePath === '/entreprise/controle') {
    if (isWorkspaceFeatureHidden('controle')) {
      return renderScreen(screens.empty, {
        title: 'Fonctionnalité masquée',
        text: 'Le contrôle et la coordination ne sont pas activés pour cette entreprise.',
        action: () => onBack('/entreprise/dashboard'),
      });
    }
    const controlPermissions = moduleFeaturePermissions?.controle?.controle ?? [];
    const controlCapabilities = getCompanyControlCapabilities({
      companyAdmin,
      sectorManager,
      employeeId: employee?.id,
      permissions: controlPermissions,
    });
    if (!controlCapabilities.canView) {
      return renderScreen(screens.empty, {
        title: 'Accès non autorisé',
        text: 'Votre rôle ne possède pas la permission Voir pour le contrôle et la coordination.',
        action: () => onBack('/entreprise/dashboard'),
      });
    }
    return renderScreen(screens.control, {
      data,
      companyId,
      employeeId: employee?.id,
      scopeNodeId,
      isAdmin: false,
      companyAdmin,
      sectorManager,
      controlPermissions,
      mutate,
      notify,
      actorName: employee ? `${employee.firstName} ${employee.lastName}` : data.companies.find(item => item.id === companyId)?.manager,
    });
  }
  if (routePath === '/entreprise/notifications') {
    return renderScreen(screens.notifications, { data, mutate, context: { isAdmin: false, companyId } });
  }
  if (routePath === '/entreprise/guide-configuration') {
    if (isWorkspaceFeatureHidden('guide-configuration')) {
      return renderScreen(screens.empty, {
        title: 'Fonctionnalité masquée',
        text: 'Le guide de configuration n’est pas activé pour cette entreprise.',
        action: () => onBack('/entreprise/dashboard'),
      });
    }
    const company = data.companies.find(item => item.id === companyId);
    return company && canAccessCompanySetupGuide(true, companyAdmin, sectorManager) ? (
      renderScreen(screens.setupGuide, {
        companyId,
        companyName: company.name,
        allowedModules: allowed,
        onNavigate,
      })
    ) : (
      renderScreen(screens.empty, {
        title: 'Accès réservé',
        text: 'Le guide de configuration est accessible à l’administrateur de l’entreprise et aux managers de secteur.',
        action: () => onBack('/entreprise/dashboard'),
      })
    );
  }
  if (routePath === '/entreprise/profil') {
    const company = data.companies.find(item => item.id === companyId);
    return companyAdmin && company ? (
      renderScreen(screens.organization, { company, data, mutate, initialTab: 'profile' })
    ) : (
      renderScreen(screens.empty, {
        title: 'Accès réservé à l’administrateur',
        text: 'Le profil de l’entreprise est géré par son administrateur.',
        action: () => onBack('/entreprise/dashboard'),
      })
    );
  }
  if (routePath === '/entreprise/organisation' || routePath === '/entreprise/acces' || routePath === '/entreprise/autorisations' || routePath === '/entreprise/employes' || routePath === '/entreprise/roles') {
    if (isWorkspaceFeatureHidden('organisation')) {
      return renderScreen(screens.empty, {
        title: 'Fonctionnalité masquée',
        text: 'L’organisation et les accès ne sont pas activés pour cette entreprise.',
        action: () => onBack('/entreprise/dashboard'),
      });
    }
    const company = data.companies.find(item => item.id === companyId);
    if (!company || (!companyAdmin && !sectorManager)) {
      return renderScreen(screens.empty, {
        title: 'Accès réservé',
        text: 'L’Organisation est accessible à l’administrateur de l’entreprise et aux managers de secteur.',
        action: () => onBack('/entreprise/dashboard'),
      });
    }
    if (routePath === '/entreprise/organisation' && query.get('tab') === 'subscription') {
      if (!companyAdmin) {
        return renderScreen(screens.empty, {
          title: 'Accès réservé à l’administrateur',
          text: 'La rubrique Abonnement est gérée par l’administrateur de l’entreprise.',
          action: () => onBack('/entreprise/organisation'),
        });
      }
      if (isWorkspaceFeatureHidden('abonnement')) {
        return renderScreen(screens.empty, {
          title: 'Fonctionnalité masquée',
          text: 'La rubrique Abonnement n’est pas visible pour cette entreprise.',
          action: () => onBack('/entreprise/organisation'),
        });
      }
    }
    const initialTab =
      routePath === '/entreprise/acces'
      || routePath === '/entreprise/autorisations'
      || routePath === '/entreprise/roles'
      || (routePath === '/entreprise/organisation' && query.get('tab') === 'roles')
        ? 'roles'
        : routePath === '/entreprise/employes'
          || (routePath === '/entreprise/organisation' && query.get('tab') === 'employees')
            ? 'employees'
            : routePath === '/entreprise/organisation' && query.get('tab') === 'subscription'
              ? 'subscription'
              : 'structure';
    return renderScreen(screens.organization, {
      company: {
        ...company,
        hiddenWorkspaceFeatures: [...new Set<CompanyWorkspaceFeatureId>([
          ...(company.hiddenWorkspaceFeatures ?? []),
          ...(hiddenWorkspaceFeatures ?? []),
        ])],
      },
      data,
      mutate,
      initialTab,
      sectorManager: sectorManager && !companyAdmin,
      scopeNodeId: sectorManager && !companyAdmin ? scopeNodeId : undefined,
    });
  }
  if (routePath === '/entreprise/stocks') {
    return renderCompanyModule(screens.stocks, {
      companyId,
      companyUsers: data.employees.filter(item => item.companyId === companyId),
      companyServices: data.orgNodes.filter(node => node.companyId === companyId),
      canCreate: effective('stocks', 'créer'),
      canModify: effective('stocks', 'modifier'),
      stockPermissions: effectiveFeatures(stockPermissions),
    });
  }
  if (routePath === '/entreprise/ecommerce') {
    return renderCompanyModule(screens.ecommerce, {
      companyId,
      canCreate: effective('ecommerce', 'créer'),
      canModify: effective('ecommerce', 'modifier'),
      allowedFeatureIds: ecommerceFeatureIds,
      featurePermissions: effectiveFeatures(ecommerceFeaturePermissions),
    });
  }
  if (routePath === '/entreprise/immobilier') {
    return renderCompanyModule(screens.immobilier, {
      companyId,
      canCreate: effective('immobilier', 'créer'),
      canModify: effective('immobilier', 'modifier'),
      featurePermissions: effectiveFeatures(moduleFeaturePermissions?.immobilier),
      activeFeatureId: query.get('feature') ?? 'dashboard',
    });
  }
  if (routePath === '/entreprise/amicales') {
    const access = serverModuleAccess?.find(module => module.id === 'amicales');
    return renderCompanyModule(screens.amicales, {
      companyId,
      canCreate: effective('amicales', 'créer'),
      canModify: effective('amicales', 'modifier'),
      allowedFeatureIds: resolveAmicaleAllowedFeatureIds(access),
      featurePermissions: effectiveFeatures(moduleFeaturePermissions?.amicales),
      activeFeatureId: query.get('feature') ?? 'dashboard',
      onNavigate,
    });
  }
  if (routePath === '/entreprise/finance') {
    return renderScreen(screens.finance, {
      data,
      mutate,
      companyId,
      canCreate: effective('finance', 'créer'),
      canModify: effective('finance', 'modifier'),
    });
  }
  if (routePath === '/entreprise/commerce' || routePath === '/entreprise/ventes') {
    return renderCompanyModule(screens.commerce, {
      companyId,
      data,
      mutate,
      canCreate: effective('commerce', 'créer') || effective('ventes', 'créer'),
      canModify: effective('commerce', 'modifier') || effective('ventes', 'modifier'),
      tabPermissions: effectiveFeatures(commerceTabPermissions),
      allowedTabs: commerceTabIds,
      initialTab: routePath === '/entreprise/ventes' ? 'sales' : 'dashboard',
      onNavigate,
    });
  }
  if (routePath === '/entreprise/paie') {
    return renderCompanyModule(screens.payroll, {
      companyId,
      employees: data.employees.filter(item => item.companyId === companyId),
      canCreate: effective('paie', 'créer'),
      canModify: effective('paie', 'modifier'),
      visibleFeatureIds: payrollFeatureIds,
      featurePermissions: effectiveFeatures(payrollFeaturePermissions),
      activeFeatureId: normalizePayrollFeatureId(query.get('feature') ?? '') ?? 'tableau-de-bord',
      onNavigate,
    });
  }
  if (routePath === '/entreprise/transport') {
    return renderCompanyModule(screens.transport, {
      companyId,
      employees: employees.filter(item => item.companyId === companyId),
      currentEmployeeId: employee?.id ?? null,
      canCreate: effective('transport', 'créer'),
      canModify: effective('transport', 'modifier'),
      allowedFeatureIds: transportFeatureIds,
      featurePermissions: transportFeaturePermissions,
      initialTab: query.get('tab') ?? undefined,
    });
  }
  const operationalModule =
    requiredModule && moduleDescriptorById[requiredModule].routeKind === 'operational'
      ? requiredModule
      : undefined;
  if (operationalModule) {
    return renderScreen(screens.operational, {
      moduleId: operationalModule,
      data,
      mutate,
      canCreate: effective(operationalModule, 'créer'),
      canModify: effective(operationalModule, 'modifier'),
      featurePermissions: effectiveFeatures(moduleFeaturePermissions?.[operationalModule]),
    });
  }
  if (routePath === '/entreprise/rh') {
    return renderScreen(screens.humanResources, {
      data,
      mutate,
      companyAdmin,
      employee,
      companyId,
    });
  }
  if (routePath === '/entreprise/presences') {
    return renderCompanyModule(screens.presence, {
      companyId,
      employees: presenceEmployees,
      nodes: data.orgNodes.filter(node => node.companyId === companyId),
      currentEmployee: employee,
      canView: hasPresencePermission('view'),
      canCreate: hasPresencePermission('create'),
      canEdit: hasPresencePermission('edit'),
      canCorrect: hasPresencePermission('correct') && hasPresencePermission('edit'),
      canValidate: hasPresencePermission('validate') && (companyAdmin || sectorManager),
      canManage: hasPresencePermission('manage'),
      canGenerateQr: hasPresencePermission('create') && !Boolean(employee && !companyAdmin && !sectorManager),
      canExport: hasPresencePermission('export'),
      canDelete: hasPresencePermission('delete'),
      visibleFeatureIds: presenceFeatureIds,
      featurePermissions: effectiveFeatures(moduleFeaturePermissions?.presences),
      selfOnly: Boolean(employee && !companyAdmin && !sectorManager),
    });
  }
  if (routePath === '/entreprise/rapports') {
    const canViewFeature = (moduleId: ModuleId, featureId: string) => {
      if (!hasPermission(moduleId, 'voir')) return false;
      const permissions = moduleFeaturePermissions?.[moduleId];
      if (!permissions || !Object.prototype.hasOwnProperty.call(permissions, featureId)) return true;
      return permissions[featureId]?.includes('voir') ?? false;
    };
    return renderScreen(screens.reports, {
      data,
      companyId,
      reportPermissions: {
        sales: canViewFeature('commerce', 'reports') || canViewFeature('ventes', 'reports') || canViewFeature('ventes', 'sales'),
        stock: canViewFeature('stocks', 'reports'),
        finance: canViewFeature('finance', 'reports') || canViewFeature('comptabilite', 'reports'),
        activity: canViewFeature('rapports', 'activity') || canViewFeature('rapports', 'reports'),
      },
      canExport: effective('rapports', 'modifier'),
    });
  }
  return renderScreen(screens.empty, {
    title: 'Module non autorisé',
    text: `Cette vue n’est pas disponible pour cet espace (${allowed.length} modules autorisés).`,
    action: () => onBack('/entreprise/dashboard'),
  });
}