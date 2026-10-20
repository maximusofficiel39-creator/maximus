import { lazy, Suspense, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  CarFront,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  Edit3,
  FileBarChart,
  FileClock,
  FileText,
  FolderKanban,
  Gauge,
  GitBranch,
  History,
  KeyRound,
  LockKeyhole,
  LayoutGrid,
  LogIn,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  WalletCards,
  Warehouse,
  X,
  UserRoundCog,
} from 'lucide-react';
import { Link, useLocation, useSearch, Router as WouterRouter } from 'wouter';
import { Toaster } from '@workspace/maximus-design-system/components/ui/toaster';
import { showAppToast } from '@workspace/maximus-design-system/hooks/use-toast';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';
import { TooltipProvider } from '@workspace/maximus-design-system/components/ui/tooltip';
import { ActionButton as DesignSystemActionButton } from '@workspace/maximus-design-system/components/ui/action-button';
import { Badge } from '@workspace/maximus-design-system/components/ui/badge';
import { Card } from '@workspace/maximus-design-system/components/ui/card';
import { Checkbox } from '@workspace/maximus-design-system/components/ui/checkbox';
import { Switch } from '@workspace/maximus-design-system/components/ui/switch';
import { AuthorizationGate } from '@/components/authorization-gate';
import { useAuthorizationGate } from '@/lib/authorization-gate';
import { NavigationSettingsContext } from '@/lib/navigation-settings-context';
import { CompanyFeatureRail } from '@/components/company-feature-rail';
import { MaximusNavigationSettings } from '@/components/company-navigation-settings';
import { companyNavigationMode } from '@/lib/company-navigation';
import { WorkspaceTabs } from '@workspace/maximus-design-system/components/ui/workspace-tabs';
import { ErrorBoundary } from '@/components/error-boundary';
import { parseClientPwaPath } from '@/lib/pwa';
import { disableCurrentBrowserPushSubscription } from '@/lib/notification-push-api';
import { playNotificationSound, prepareNotificationSound } from '@/lib/notification-sound';
import { ConfirmDialogProvider, useAppDialog } from '@/components/confirm-dialog';
import { ModulePackDraftForm } from '@/components/module-pack-draft-form';
import { SubscriptionPricingManagement } from '@/components/subscription-pricing-management';
import { filterSubscriptionsForVisibleCompanies } from '@/lib/subscription-visibility';
import {
  ActionButton,
  ActivityRow,
  Brand,
  DataTable,
  Field,
  Metric,
  StatusBadge,
  Step,
  Toolbar,
} from '@/components/app-ui';
import {
  getConfiguredModules,
  getCompanyDirectoryCompanies,
  getVisibleNotifications,
  emptyStoreData,
  modules,
  money,
  shortMoney,
  stockSubmodules,
  uid,
  type Company,
  type Employee,
  type ModuleAvailability,
  type ModuleFeaturePack,
  type ModuleId,
  type OrgNode,
  type Role,
  type Sale,
  type SectorPreset,
  type StoreData,
  subscriptionPlans,
  sanitizeStoreData,
} from '@/lib/store';
import { appStateApi, AppStateRequestError } from '@/lib/app-state-api';
import { setApiDatasetMode } from '@/lib/api-request';
import { appStateScopeMatchesSession } from '@/lib/app-state-scope';
import {
  discardCatalogDraft,
  getCatalogImpact,
  getCatalogSnapshot,
  publishCatalogDraft,
  updateCatalogDraft,
  validateCatalogDraft,
} from '@/lib/catalog-workflow';
import { commerceTabDefinitions, type CommerceTabId } from '@/lib/commerce-permissions';
import { applyCompanyTheme, companyThemeVariables } from '@/lib/company-theme';
import { canonicalAppPath, normalizeRoutePath, type Session } from '@/lib/navigation';
import { AdminRouter, CompanyRouter } from '@/routes/app-routes';
import { PageHeader, Sidebar, Topbar } from '@/components/app-chrome';
import { AuthCard, AuthLayout } from '@/components/auth-layout';
import { DashboardHero, DashboardPanel, PanelEmpty, QuickLinkTile, SignalItem } from '@/components/dashboard-parts';
import { Button } from '@workspace/maximus-design-system/components/ui/button';
import { Alert, AlertDescription } from '@workspace/maximus-design-system/components/ui/alert';
import { featureSlug, permissionFeatureKey } from '@/lib/permission-keys';
import {
  getEffectiveModuleFeatureIds,
  getModuleFeatureOptions,
  normalizeFeatureIdsForSelectedPacks,
  getModulePackError,
} from '@/lib/module-features';
import { moduleIconById, modulePageMeta, modulePaths } from '@/lib/module-registry';
import { presenceFeatureDefinitions } from '@/lib/presence-features';
import { authApi, type AuthUser } from '@/lib/auth-api';
import { installationApi, type InstallationProfile } from '@/lib/installation-api';
import {
  companyLoginPathFromStoredContext,
  createCompanyLoginReturnContext,
  installationLogoutPath,
  resolveInstallationEntry,
} from '@/lib/installation-routing';
import { InstallationUnavailable } from '@/components/installation-unavailable';
import { InstallationSyncNotice } from '@/components/installation-sync-notice';
import { CompanyInstallationAccess } from '@/components/company-installation-access';
import { CompanyPushNotificationAccess } from '@/components/company-push-notification-access';
import { CompanyPushNotificationPrompt } from '@/components/company-push-notification-prompt';
import { CompanySubscriptionExpiryNotice } from '@/components/company-subscription-expiry-notice';
import { companyRequestApi, type CompanyConnectivity, type CompanyRequest } from '@/lib/company-request-api';
import { loadCompanyPaymentAccess, setCompanyPaymentAccess } from '@/lib/company-payment-api';
import { useCompanySubscriptionBillingMode } from '@/hooks/use-company-subscription-billing-mode';
import { createEcommerceApi, type EcommerceDomain } from '@/lib/ecommerce-api';
import { registrationCatalogApi } from '@/lib/registration-catalog-api';
import { isPublicIntelligentRegistrationEnabled } from '@/lib/registration-policy';
import { platformSettingsApi, type MaximusWalletBootstrap } from '@/lib/platform-settings-api';
import {
  loadCompanyModuleAccess,
  setCompanyModuleAccess,
  synchronizeCompanyModuleAccess,
  type ServerModuleAccess,
} from '@/lib/module-api';
import {
  buildModulePack,
  defaultFeaturePermissions,
  emptyModulePackDraft,
  permissionLevelFor,
  type FeaturePermissionMap,
  type ModulePackDraft,
  updatePackPermission,
} from '@/lib/module-pack';
import { synchronizeUnitPackRoles } from '@/lib/module-role-sync';
import { provisionCompanyAccess } from '@/lib/company-access-provisioning';
import { buildAppAccessContext } from '@/lib/app-access';
import {
  buildAdminAssistantScope,
} from '@/lib/local-assistant';
import { maximusAssistantApi, type MaximusAssistantAction, type MaximusAssistantMessage } from '@/lib/maximus-assistant-api';
import { onboardingApi } from '@/lib/onboarding-api';
import { mutationSuccessMessage } from '@/lib/mutation-feedback';
import {
  companyWorkspaceFeatureDefinitions,
  normalizeCompanyWorkspaceFeatureIds,
  resolveCompanyWorkspaceHiddenFeatures,
  type CompanyWorkspaceFeatureId,
} from '@/lib/company-workspace-features';

const queryClient = new QueryClient();
const companyLoginContextStorageKey = 'maximus-company-login-context';
type DemoAccount = { id: string; label: string; email: string; password: string };
const defaultDemoAccounts: DemoAccount[] = [];

const StockModulePage = lazy(() => import('@/pages/stock-module'));
const CommerceModulePage = lazy(() => import('@/pages/commerce-module'));
const EcommerceModulePage = lazy(() => import('@/pages/ecommerce-module'));
const ImmobilierModulePage = lazy(() => import('@/pages/immobilier-module'));
const AmicaleModulePage = lazy(() => import('@/pages/amicales-module'));
const PublicShopPage = lazy(() => import('@/pages/public-shop'));
const CompanyLoginPage = lazy(() =>
  import('@/pages/company-login').then((module) => ({ default: module.CompanyLoginPage })),
);
const OperationalModulePage = lazy(() =>
  import('@/pages/operational-modules').then((module) => ({ default: module.OperationalModulePage })),
);
const TransportModulePage = lazy(() => import('@/pages/transport-module'));
const CompanyOrganizationAdmin = lazy(() =>
  import('@/pages/company-organization').then((module) => ({ default: module.CompanyOrganizationAdmin })),
);
const CompanySetupGuide = lazy(() => import('@/pages/company-setup-guide'));
const PresenceModulePage = lazy(() => import('@/pages/presence-module'));
const PayrollModulePage = lazy(() => import('@/pages/payroll-module'));
const MaximusAssistantPage = lazy(() => import('@/pages/maximus-assistant'));
const IntelligentOnboardingPage = lazy(() =>
  import('@/pages/intelligent-onboarding').then((module) => ({ default: module.IntelligentOnboardingPage })),
);
const ControlCenterPage = lazy(() =>
  import('@/pages/control-center').then((module) => ({ default: module.ControlCenterPage })),
);
const SystemHealthPage = lazy(() =>
  import('@/pages/system-health').then((module) => ({ default: module.SystemHealthPage })),
);
const PlatformSettingsPage = lazy(() => import('@/pages/platform-settings'));
const SubscriptionAccessGate = lazy(() =>
  import('@/pages/subscription-access-gate').then((module) => ({ default: module.SubscriptionAccessGate })),
);
function sessionFromAuthUser(user: AuthUser): Session {
  return user.role === 'maximus_admin'
    ? 'admin'
    : user.role === 'company_admin'
      ? `company:${user.companyId}`
      : `employee:${user.employeeId}`;
}

const pageMeta: Record<string, { kicker: string; title: string; description: string }> = {
  '/maximus/dashboard': {
    kicker: 'Cockpit MAXIMUS',
    title: 'Bonjour, équipe MAXIMUS.',
    description: 'Voici ce qui mérite votre attention aujourd’hui.',
  },
  '/maximus/assistant': {
    kicker: 'Administration principale',
    title: 'MAXI',
    description: 'Comprenez les modules, les packs, les organisations et les règles d’accès avant de décider.',
  },
  '/maximus/controle': {
    kicker: 'Pilotage MAXIMUS',
    title: 'Contrôle & coordination',
    description: 'Les décisions, tâches et événements qui structurent les opérations.',
  },
  '/maximus/surveillance': {
    kicker: 'Surveillance MAXIMUS',
    title: 'Détecteur de problèmes',
    description: 'Vérifiez la disponibilité de l’application, de PostgreSQL et de son schéma.',
  },
  '/maximus/entreprises': {
    kicker: 'Administration',
    title: 'Entreprises',
    description: 'Pilotez les espaces clients et leurs accès modules.',
  },
  '/maximus/entreprises/organisation': {
    kicker: 'Administration des entreprises',
    title: 'Organisation & accès',
    description: 'Structurez les secteurs, leurs modules, les rôles et les comptes employés.',
  },
  '/maximus/demandes': {
    kicker: 'Administration',
    title: 'Demandes en attente',
    description: 'Traitez les demandes d’ouverture reçues récemment.',
  },
  '/maximus/modules': {
    kicker: 'Configuration',
    title: 'Catalogue des modules',
    description: 'Les briques métier disponibles dans MAXIMUS.',
  },
  '/maximus/secteurs': {
    kicker: 'Configuration',
    title: 'Secteurs d’activité',
    description: 'Préparez les modules proposés lors de l’inscription d’une entreprise.',
  },
  '/maximus/abonnements': {
    kicker: 'Compte',
    title: 'Abonnements',
    description: 'Une lecture claire de vos espaces et de leur statut.',
  },
  '/maximus/notifications': {
    kicker: 'Centre de contrôle',
    title: 'Notifications',
    description: 'Les signaux utiles, sans bruit.',
  },
  '/maximus/journal': {
    kicker: 'Traçabilité',
    title: 'Journal d’activité',
    description: 'Chaque action importante, horodatée et attribuée.',
  },
  '/maximus/parametres/portefeuille': {
    kicker: 'Configuration',
    title: 'Réglages MAXIMUS',
    description: 'Définissez les règles globales appliquées aux espaces clients.',
  },
  '/entreprise/dashboard': {
    kicker: 'Espace entreprise',
    title: 'Pilotage de l’entreprise',
    description: 'Comprenez votre activité et agissez depuis un espace unifié.',
  },
  '/entreprise/controle': {
    kicker: 'Espace entreprise',
    title: 'Contrôle & coordination',
    description: 'Les décisions, tâches et événements de votre périmètre.',
  },
  '/entreprise/organisation': {
    kicker: 'Espace entreprise',
    title: 'Organisation & accès',
    description: 'Structure, rôles, sous-autorisations, comptes et managers au même endroit.',
  },
  '/entreprise/acces': {
    kicker: 'Espace entreprise',
    title: 'Accès',
    description: 'Gérez les rôles, permissions et comptes autorisés de votre entreprise.',
  },
  '/entreprise/profil': {
    kicker: 'Espace entreprise',
    title: 'Mon profil',
    description: 'Mettez à jour les informations et les accès de votre entreprise.',
  },
  '/entreprise/guide-configuration': {
    kicker: 'Espace entreprise',
    title: 'Guide de configuration',
    description: 'Configurez votre entreprise de A à Z avec une méthode vérifiable et sans angle mort.',
  },
  '/entreprise/roles': {
    kicker: 'Espace entreprise',
    title: 'Rôles',
    description: 'Des accès précis, pour travailler sereinement.',
  },
  '/entreprise/stocks': {
    kicker: 'Espace entreprise',
    title: 'Gestion de stock',
    description: 'Pilotez vos articles, entrées, sorties et inventaires.',
  },
  '/entreprise/finance': {
    kicker: 'Espace entreprise',
    title: 'Finance',
    description: 'Une lecture simple des encaissements et de la trésorerie.',
  },
  '/entreprise/commerce': {
    kicker: 'Espace entreprise',
    title: 'Gestion commerciale',
    description: 'Clients, commandes et activité commerciale en temps réel.',
  },
  '/entreprise/ventes': {
    kicker: 'Espace entreprise',
    title: 'Ventes',
    description: 'Devis, ventes et validation des opérations clients.',
  },
  '/entreprise/achats': {
    kicker: 'Espace entreprise',
    title: 'Achats',
    description: 'Demandes, commandes fournisseurs et réceptions.',
  },
  '/entreprise/comptabilite': {
    kicker: 'Espace entreprise',
    title: 'Comptabilité',
    description: 'Écritures, journaux et rapprochements comptables.',
  },
  '/entreprise/rh': {
    kicker: 'Espace entreprise',
    title: 'Ressources humaines',
    description: 'Organisation, employés, rôles et permissions.',
  },
  '/entreprise/presences': { kicker: 'Espace entreprise', title: 'Présences', description: 'Le suivi quotidien de vos équipes.' },
  '/entreprise/paie': {
    kicker: 'Espace entreprise',
    title: 'Paie',
    description: 'Périodes, bulletins et validation des salaires.',
  },
  '/entreprise/crm': {
    kicker: 'Espace entreprise',
    title: 'CRM / Clients',
    description: 'Fiches clients, opportunités et relances.',
  },
  '/entreprise/fournisseurs': {
    kicker: 'Espace entreprise',
    title: 'Fournisseurs',
    description: 'Référentiel, évaluation et suivi des partenaires.',
  },
  '/entreprise/logistique': {
    kicker: 'Espace entreprise',
    title: 'Logistique',
    description: 'Entrepôts, livraisons et acheminement.',
  },
  '/entreprise/documents': {
    kicker: 'Espace entreprise',
    title: 'Documents',
    description: 'Classement, partage et suivi des versions.',
  },
  '/entreprise/rapports': {
    kicker: 'Espace entreprise',
    title: 'Rapports',
    description: 'Des synthèses actionnables pour décider plus vite.',
  },
};

const routesWithModuleHeaders = new Set([
  '/maximus/controle',
  '/maximus/surveillance',
  '/entreprise/controle',
  '/entreprise/dashboard',
  '/entreprise/stocks',
  '/entreprise/commerce',
  '/entreprise/ventes',
  '/entreprise/finance',
  '/entreprise/rh',
  '/entreprise/achats',
  '/entreprise/comptabilite',
  '/entreprise/paie',
  '/entreprise/crm',
  '/entreprise/fournisseurs',
  '/entreprise/logistique',
  '/entreprise/documents',
  '/entreprise/presences',
  '/entreprise/rapports',
  '/entreprise/organisation',
  '/entreprise/guide-configuration',
  '/entreprise/acces',
  '/entreprise/autorisations',
  '/entreprise/employes',
  '/entreprise/roles',
  ...modulePaths,
]);

const routesWithOwnedHeadings = new Set([
  ...routesWithModuleHeaders,
  '/maximus/assistant',
  '/maximus/abonnements',
  '/maximus/parametres/portefeuille',
]);

function AppContent() {
  const { alert, confirm } = useAppDialog();
  const [data, setData] = useState<StoreData>(() => emptyStoreData());
  const [registrationCatalogVersion, setRegistrationCatalogVersion] = useState(0);
  const [publicRegistrationEnabled, setPublicRegistrationEnabled] = useState<boolean | null>(null);
  const [installationProfile, setInstallationProfile] = useState<InstallationProfile | null>(null);
  const [installationReady, setInstallationReady] = useState(false);
  const [installationError, setInstallationError] = useState('');
  const [installationRetry, setInstallationRetry] = useState(0);
  const [appStateVersion, setAppStateVersion] = useState(0);
  const [appStateError, setAppStateError] = useState('');
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const [appStateReady, setAppStateReady] = useState(
    () => !localStorage.getItem('maximus-session'),
  );
  const [session, setSession] = useState<Session | null>(
    () => localStorage.getItem('maximus-session') as Session | null,
  );
  const subscriptionBillingMode = useCompanySubscriptionBillingMode(session);
  const [companyLoginReturnPath, setCompanyLoginReturnPath] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [serverModuleStatuses, setServerModuleStatuses] = useState<Record<string, ModuleAvailability> | null>(null);
  const [serverModuleAccess, setServerModuleAccess] = useState<ServerModuleAccess[] | null>(null);
  const [serverModuleAccessReady, setServerModuleAccessReady] = useState(false);
  const [serverModuleAccessCompanyId, setServerModuleAccessCompanyId] = useState<string | null>(null);
  const [serverModuleAccessError, setServerModuleAccessError] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('maximus-sidebar-collapsed') === 'true',
  );
  const [pathname, setLocation] = useLocation();
  const search = useSearch();
  const location = search ? `${pathname}?${search}` : pathname;
  const dataRef = useRef(data);
  const appStateSaveQueue = useRef(Promise.resolve());
  const pendingAppStateDeletes = useRef<Array<{ session: Session; collection: string; ids: string[] }>>([]);
  const appStateVersionRef = useRef(appStateVersion);
  const appStateRefreshRef = useRef<{ session: Session; promise: Promise<boolean> } | null>(null);
  const sessionRef = useRef<Session | null>(session);
  const localMutationVersionRef = useRef(0);
  const loginTransitionRef = useRef(false);
  const moduleAccessCacheRef = useRef(
    new Map<string, { access: ServerModuleAccess[]; updatedAt: number }>(),
  );
  const observedNotificationsRef = useRef<{ contextKey: string; ids: Set<string> } | null>(null);
  const deliveredNotificationIdsRef = useRef(new Set<string>());
  dataRef.current = data;
  appStateVersionRef.current = appStateVersion;
  sessionRef.current = session;
  useEffect(() => {
    setApiDatasetMode('real');
    pendingAppStateDeletes.current = pendingAppStateDeletes.current
      .filter(deletion => deletion.session === session);
  }, [session]);
  const intelligentRegistrationEnabled = isPublicIntelligentRegistrationEnabled(
    publicRegistrationEnabled,
    installationProfile?.registrationEnabled,
  );
  useEffect(() => {
    localStorage.setItem('maximus-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);
  const notify = (message: string, kind: 'success' | 'error' | 'info' | 'warning' = 'info') =>
    showAppToast(message, kind);
  useEffect(() => {
    let cancelled = false;
    setInstallationReady(false);
    setInstallationError('');
    void installationApi
      .profile()
      .then((profile) => {
        if (cancelled) return;
        setInstallationProfile(profile);
        if (profile.companyOnly && localStorage.getItem('maximus-session') === 'admin') {
          localStorage.removeItem('maximus-session');
          localStorage.removeItem(companyLoginContextStorageKey);
          setCompanyLoginReturnPath(null);
          setSession(null);
          setAppStateReady(true);
          void authApi.logout().catch(() => undefined);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setInstallationProfile(null);
          setInstallationError(error instanceof Error ? error.message : 'La configuration de cette installation est indisponible.');
        }
      })
      .finally(() => {
        if (!cancelled) setInstallationReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [installationRetry]);
  useEffect(() => {
    if (!localStorage.getItem('maximus-session')) return undefined;
    void authApi
      .session()
      .then(({ user }) => {
        if (!user) {
          setSession(null);
          localStorage.removeItem('maximus-session');
          localStorage.removeItem(companyLoginContextStorageKey);
          setCompanyLoginReturnPath(null);
          return;
        }
        const nextSession = sessionFromAuthUser(user);
        const persistedTestCompanyId = localStorage.getItem('maximus-sector-test-company');
        if (nextSession === 'admin' && persistedTestCompanyId) {
          setData((previous) => {
            const next = structuredClone(previous) as StoreData;
            next.companies = next.companies.filter((company) => company.id !== persistedTestCompanyId);
            next.orgNodes = next.orgNodes.filter((node) => node.companyId !== persistedTestCompanyId);
            next.employees = next.employees.filter((employee) => employee.companyId !== persistedTestCompanyId);
            next.roles = next.roles.filter((role) => role.companyId !== persistedTestCompanyId);
            return next;
          });
          localStorage.removeItem('maximus-sector-test-company');
        }
        setSession(nextSession);
        localStorage.setItem('maximus-session', nextSession);
        const restoredCompanyLoginPath = companyLoginPathFromStoredContext(
          localStorage.getItem(companyLoginContextStorageKey),
          user.companyId,
        );
        setCompanyLoginReturnPath(restoredCompanyLoginPath);
        if (!restoredCompanyLoginPath) localStorage.removeItem(companyLoginContextStorageKey);
      })
      .catch(() => {
        setSession(null);
        localStorage.removeItem('maximus-session');
        localStorage.removeItem(companyLoginContextStorageKey);
        setCompanyLoginReturnPath(null);
      });
  }, []);
  useEffect(() => {
    if (
      session
      || installationProfile?.companyOnly
      || !['/', '/inscription', '/onboarding'].includes(pathname)
    ) return undefined;
    let cancelled = false;
    void registrationCatalogApi.bootstrap()
      .then(({ catalog, version }) => {
        if (cancelled) return;
        setData((previous) =>
          sanitizeStoreData({
            ...previous,
            ...(catalog.sectorPresets !== null && catalog.sectorPresets !== undefined
              ? { sectorPresets: catalog.sectorPresets }
              : {}),
            moduleOverrides: catalog.moduleOverrides ?? previous.moduleOverrides,
            moduleStatuses: catalog.moduleStatuses ?? previous.moduleStatuses,
            customModules: catalog.customModules ?? previous.customModules,
            removedModules: catalog.removedModules ?? previous.removedModules,
            catalogVersion: catalog.catalogVersion ?? previous.catalogVersion,
          }),
        );
        setPublicRegistrationEnabled(catalog.registrationEnabled === true);
        setRegistrationCatalogVersion(version);
      })
      .catch(() => {
        if (cancelled) return;
        // Les secteurs intégrés restent disponibles si le catalogue distant est indisponible.
        setPublicRegistrationEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [installationProfile?.companyOnly, pathname, session]);
  const refreshAppState = async (waitForPendingSave = true) => {
    const requestSession = session;
    if (!requestSession || requestSession.startsWith('company:sector-test-')) return true;
    if (appStateRefreshRef.current?.session === requestSession) {
      return appStateRefreshRef.current.promise;
    }

    const pendingSave = waitForPendingSave
      ? appStateSaveQueue.current.catch(() => undefined)
      : Promise.resolve();
    let request: Promise<boolean>;
    request = pendingSave
      .then(async () => {
        if (sessionRef.current !== requestSession) return false;
        const { data: remoteData, scope, version, dataset } = await appStateApi.bootstrap();
        if (sessionRef.current !== requestSession) return false;
        setApiDatasetMode(dataset);
        const nextData = sanitizeStoreData(remoteData);
        if (!appStateScopeMatchesSession(requestSession, scope, nextData)) {
          throw new AppStateRequestError('La réponse métier ne correspond pas à la session active.', 409);
        }
        dataRef.current = nextData;
        setData(nextData);
        setAppStateError('');
        setSubscriptionBlocked(false);
        setAppStateReady(true);
        appStateVersionRef.current = version;
        setAppStateVersion(version);
        return true;
      })
      .catch((error) => {
        if (sessionRef.current !== requestSession) return false;
        if (error instanceof AppStateRequestError && error.code === 'SUBSCRIPTION_REQUIRED') {
          setSubscriptionBlocked(true);
          setAppStateReady(false);
          setAppStateError(error.message);
          return false;
        }
        if (error instanceof AppStateRequestError && [401, 403].includes(error.status)) {
          setSubscriptionBlocked(false);
          setSession(null);
          localStorage.removeItem('maximus-session');
          localStorage.removeItem(companyLoginContextStorageKey);
          setCompanyLoginReturnPath(null);
          localStorage.removeItem('maximus-sector-test-company');
          notify('Votre session MAXIMUS n’est plus active.', 'warning');
          return false;
        }
        setSubscriptionBlocked(false);
        const message = error instanceof Error ? error.message : 'Les données métier sont indisponibles.';
        setAppStateError(message);
        return false;
      })
      .finally(() => {
        if (appStateRefreshRef.current?.promise === request) {
          appStateRefreshRef.current = null;
        }
      });

    appStateRefreshRef.current = { session: requestSession, promise: request };
    return request;
  };

  useEffect(() => {
    if (!session || session.startsWith('company:sector-test-')) {
      setAppStateReady(true);
      return;
    }
    const shouldBlockForInitialLoad = !loginTransitionRef.current && !appStateReady;
    loginTransitionRef.current = false;
    if (shouldBlockForInitialLoad) setAppStateReady(false);
    const requestSession = session;
    void refreshAppState().then((ready) => {
      if (sessionRef.current === requestSession) setAppStateReady(ready);
    });
  }, [session]);
  useAutoRefresh(() => {
    void refreshAppState();
  }, {
    enabled: Boolean(session && !session.startsWith('company:sector-test-')),
    intervalMs: 30_000,
  });
  useEffect(() => {
    if (session !== 'admin') return;
    const activeCompanies = data.companies.filter((company) => company.status === 'ACTIF');
    void Promise.all(
      activeCompanies.flatMap((company) => [
        synchronizeCompanyModuleAccess(company.id, company.allowedModules),
      ]),
    ).catch((error) => {
      notify(error instanceof Error ? `Synchronisation incomplète : ${error.message}` : 'Synchronisation des entreprises incomplète.', 'warning');
    });
  }, [session]);

  const mutate = (fn: (draft: StoreData) => void, message?: string | null, persist = true) => {
    const previous = dataRef.current;
    const next = structuredClone(previous) as StoreData;
    fn(next);
    const safeNext = sanitizeStoreData(next);
    const deletions = [
      'employees', 'roles', 'orgNodes', 'products', 'movements', 'sales', 'activities', 'purchaseOrders',
      'supplierRecords', 'deliveries', 'businessDocuments', 'accountingEntries',
      'payrollSlips', 'crmOpportunities',
    ].flatMap(collection => {
      const before = (previous as unknown as Record<string, unknown>)[collection];
      const after = (safeNext as unknown as Record<string, unknown>)[collection];
      if (!Array.isArray(before) || !Array.isArray(after)) return [];
      const nextIds = new Set(after.map(item => (item as { id?: unknown })?.id).filter(Boolean).map(String));
      const ids = before
        .map(item => (item as { id?: unknown })?.id)
        .filter((id): id is string => Boolean(id) && !nextIds.has(String(id)))
        .map(String);
      return ids.length ? [{ collection, ids }] : [];
    });
    const deleteSession = session;
    if (deleteSession && persist && deletions.length) {
      pendingAppStateDeletes.current = [
        ...pendingAppStateDeletes.current,
        ...deletions.map(deletion => ({ ...deletion, session: deleteSession })),
      ];
    }
    const mutationVersion = ++localMutationVersionRef.current;
    const mutationSession = session;
    const successMessage = mutationSuccessMessage(message, Boolean(session), persist);
    dataRef.current = safeNext;
    setData(safeNext);
    if (session && persist) {
      appStateSaveQueue.current = appStateSaveQueue.current
        .catch(() => undefined)
        .then(async () => {
          if (sessionRef.current !== mutationSession) {
            pendingAppStateDeletes.current = pendingAppStateDeletes.current
              .filter(deletion => deletion.session !== mutationSession);
            return null;
          }
          const deleted = pendingAppStateDeletes.current
            .filter(deletion => deletion.session === mutationSession)
            .map(({ collection, ids }) => ({ collection, ids }));
          pendingAppStateDeletes.current = pendingAppStateDeletes.current
            .filter(deletion => deletion.session !== mutationSession);
          let version: number;
          try {
            ({ version } = await appStateApi.save(dataRef.current, appStateVersionRef.current, deleted));
          } catch (error) {
            if (mutationSession && sessionRef.current === mutationSession) {
              pendingAppStateDeletes.current = [
                ...deleted.map(deletion => ({ ...deletion, session: mutationSession })),
                ...pendingAppStateDeletes.current,
              ];
            }
            throw error;
          }
          if (sessionRef.current !== mutationSession) return null;
          return version;
        })
        .then((version) => {
          if (version === null || sessionRef.current !== mutationSession) return;
          appStateVersionRef.current = version;
          setAppStateVersion(version);
          if (successMessage) notify(successMessage, 'success');
        })
        .catch((error) => {
          if (mutationVersion === localMutationVersionRef.current) {
            dataRef.current = previous;
            setData(previous);
          }
          if (error instanceof AppStateRequestError && error.status === 409) {
            void refreshAppState(false);
          }
          notify(error instanceof Error ? error.message : 'La sauvegarde des données métier a échoué.', 'error');
          throw error;
        });
    } else if (successMessage) {
      notify(successMessage, 'success');
    }
  };
  const updateCompanyModuleAccess = async (
    companyId: string,
    moduleId: ModuleId,
    status: ModuleAvailability,
    options: { featureIds?: string[]; configuration?: Record<string, unknown> } = {},
  ) => {
    await setCompanyModuleAccess(companyId, moduleId, status, options);
    const successMessage =
      status === 'MAINTENANCE'
        ? 'Module placé en maintenance pour cette entreprise.'
        : status === 'INACTIF'
          ? 'Module désactivé pour cette entreprise.'
          : status === 'BETA'
            ? 'Module passé en mode bêta pour cette entreprise.'
            : 'Module activé pour cette entreprise.';
    mutate((draft) => {
      const company = draft.companies.find((item) => item.id === companyId);
      if (!company) return;
      company.allowedModules =
        status !== 'INACTIF'
          ? [...new Set([...company.allowedModules, moduleId])]
          : company.allowedModules.filter((item) => item !== moduleId);
      company.refusedModules = company.requestedModules.filter((item) => !company.allowedModules.includes(item));
      if (options.featureIds) {
        company.requestedModuleFeatures = {
          ...(company.requestedModuleFeatures ?? {}),
          [moduleId]: [...options.featureIds],
        };
      }
      const configuredPackIds = options.configuration?.packIds;
      if (Array.isArray(configuredPackIds)) {
        company.requestedModulePackIds = {
          ...(company.requestedModulePackIds ?? {}),
          [moduleId]: configuredPackIds.filter((value): value is string => typeof value === 'string'),
        };
      }
      const configuredFeaturePermissions = options.configuration?.featurePermissions;
      if (configuredFeaturePermissions && typeof configuredFeaturePermissions === 'object' && !Array.isArray(configuredFeaturePermissions)) {
        company.requestedModulePermissions = {
          ...(company.requestedModulePermissions ?? {}),
          [moduleId]: Object.fromEntries(
            Object.entries(configuredFeaturePermissions as Record<string, unknown>)
              .filter(([, permissions]) => Array.isArray(permissions))
              .map(([featureId, permissions]) => [
                featureId,
                [...new Set((permissions as unknown[]).filter((permission): permission is string => typeof permission === 'string'))],
              ]),
          ),
        };
      }
    }, successMessage);
  };
  const sessionEmployeeId = session?.startsWith('employee:') ? session.slice('employee:'.length) : null;
  const sessionEmployee = sessionEmployeeId
    ? data.employees.find((employee) => employee.id === sessionEmployeeId)
    : null;
  const activeCompanyId =
    session?.startsWith('company:')
      ? session.slice('company:'.length)
      : sessionEmployee?.companyId;
  const sectorTestCompanyId = activeCompanyId?.startsWith('sector-test-') ? activeCompanyId : null;
  const activeCompany = data.companies.find((company) => company.id === activeCompanyId);
  const activeCompanyAllowedModulesKey = activeCompany?.allowedModules.join(',') ?? '';
  const notificationIsAdmin = session === 'admin' && !installationProfile?.companyOnly;
  const notificationCompanyId = activeCompanyId ?? '';
  useEffect(() => {
    const unlockOnGesture = () => {
      prepareNotificationSound();
      window.removeEventListener('pointerdown', unlockOnGesture, true);
      window.removeEventListener('keydown', unlockOnGesture, true);
    };
    window.addEventListener('pointerdown', unlockOnGesture, { capture: true, once: true });
    window.addEventListener('keydown', unlockOnGesture, { capture: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockOnGesture, true);
      window.removeEventListener('keydown', unlockOnGesture, true);
    };
  }, []);
  useEffect(() => {
    if (!activeCompanyId || !session || session === 'admin' || sectorTestCompanyId) return undefined;

    const sendHeartbeat = () => {
      if (document.visibilityState === 'visible') {
        void authApi.heartbeat().catch(() => undefined);
      }
    };
    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 60_000);
    document.addEventListener('visibilitychange', sendHeartbeat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sendHeartbeat);
    };
  }, [activeCompanyId, sectorTestCompanyId, session]);
  useEffect(() => {
    if (!session || !appStateReady) {
      observedNotificationsRef.current = null;
      deliveredNotificationIdsRef.current.clear();
      return;
    }

    const contextKey = `${session}:${notificationIsAdmin ? 'admin' : notificationCompanyId}`;
    const visibleNotifications = getVisibleNotifications(data.notifications, {
      isAdmin: notificationIsAdmin,
      companyId: notificationCompanyId,
    });

    if (observedNotificationsRef.current?.contextKey !== contextKey) {
      observedNotificationsRef.current = {
        contextKey,
        ids: new Set(visibleNotifications.map((notification) => notification.id)),
      };
      deliveredNotificationIdsRef.current.clear();
      return;
    }

    const observed = observedNotificationsRef.current;
    const newlyAdded = visibleNotifications.filter(
      (notification) => !observed.ids.has(notification.id) && !notification.read,
    );
    visibleNotifications.forEach((notification) => observed.ids.add(notification.id));
    const notAlreadyDelivered = newlyAdded.filter(
      (notification) => !deliveredNotificationIdsRef.current.has(notification.id),
    );
    notAlreadyDelivered.forEach((notification) => deliveredNotificationIdsRef.current.add(notification.id));

    if (notAlreadyDelivered.length === 0 || document.visibilityState !== 'visible') return;

    const latest = notAlreadyDelivered[0];
    showAppToast(`${latest.title} : ${latest.text}`, 'info');
    void playNotificationSound();
  }, [
    appStateReady,
    data.notifications,
    notificationCompanyId,
    notificationIsAdmin,
    session,
  ]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;

    const handlePushMessage = (event: MessageEvent<unknown>) => {
      if (!sessionRef.current || !event.data || typeof event.data !== 'object') return;
      const message = event.data as {
        type?: unknown;
        notification?: { id?: unknown; title?: unknown; body?: unknown };
      };
      if (message.type !== 'MAXIMUS_PUSH_NOTIFICATION' || !message.notification) return;

      const { id, title, body } = message.notification;
      if (typeof id === 'string' && id !== '') {
        if (deliveredNotificationIdsRef.current.has(id)) return;
        deliveredNotificationIdsRef.current.add(id);
      }
      if (typeof title === 'string' && typeof body === 'string') {
        showAppToast(`${title} : ${body}`, 'info');
      }
      void playNotificationSound();
    };

    navigator.serviceWorker.addEventListener('message', handlePushMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handlePushMessage);
  }, []);
  useEffect(() => {
    if (!activeCompanyId || session === 'admin' || !session || sectorTestCompanyId) {
      setServerModuleStatuses(null);
      setServerModuleAccess(null);
      setServerModuleAccessReady(true);
      setServerModuleAccessCompanyId(null);
      setServerModuleAccessError('');
      return;
    }

    let cancelled = false;
    const cacheKey = `${activeCompanyId}:${activeCompanyAllowedModulesKey}`;
    const cached = moduleAccessCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.updatedAt < 30_000) {
      setServerModuleAccess(cached.access);
      setServerModuleStatuses(Object.fromEntries(cached.access.map((module) => [module.id, module.status])));
      setServerModuleAccessReady(true);
      setServerModuleAccessCompanyId(activeCompanyId);
      return () => {
        cancelled = true;
      };
    }

    setServerModuleAccessReady(false);
    setServerModuleAccessCompanyId(null);
    setServerModuleAccessError('');
    void loadCompanyModuleAccess(activeCompanyId, activeCompany?.allowedModules ?? [])
      .then((access) => {
        if (!cancelled) {
          moduleAccessCacheRef.current.set(cacheKey, { access, updatedAt: Date.now() });
          setServerModuleAccess(access);
          setServerModuleStatuses(Object.fromEntries(access.map((module) => [module.id, module.status])));
          setServerModuleAccessReady(true);
          setServerModuleAccessCompanyId(activeCompanyId);
        }
      })
      .catch((error) => {
        if (!cancelled) {
           setServerModuleStatuses(null);
           setServerModuleAccess(null);
           setServerModuleAccessReady(false);
          setServerModuleAccessCompanyId(activeCompanyId);
          setServerModuleAccessError(
            error instanceof Error
              ? error.message
              : 'Les accès modules de cette entreprise ne sont pas confirmés par le serveur.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeCompanyId,
    activeCompanyAllowedModulesKey,
    sectorTestCompanyId,
    session,
  ]);
  const activeCompanyTheme = companyThemeVariables(activeCompany);
  const activeNavStyle: CSSProperties | undefined = activeCompany
    ? {
        backgroundColor: `hsl(${activeCompanyTheme['--sidebar-active']})`,
        color: `hsl(${activeCompanyTheme['--sidebar-active-foreground']})`,
      }
    : undefined;
  useLayoutEffect(() => {
    applyCompanyTheme(activeCompany);
    return () => applyCompanyTheme(undefined);
  }, [activeCompany?.id, activeCompany?.primaryColor, activeCompany?.accentColor, activeCompany?.sidebarColor]);
  const applyAuthenticatedUser = (user: AuthUser, companyLoginPath?: string) => {
    const nextSession = sessionFromAuthUser(user);
    const companyLoginContext = companyLoginPath
      ? createCompanyLoginReturnContext(user.companyId, companyLoginPath)
      : null;
    const clearedData = emptyStoreData();
    dataRef.current = clearedData;
    setData(clearedData);
    appStateVersionRef.current = 0;
    setAppStateVersion(0);
    setAppStateError('');
    setSubscriptionBlocked(false);
    moduleAccessCacheRef.current.clear();
    loginTransitionRef.current = true;
    setAppStateReady(false);
    setSession(nextSession);
    localStorage.setItem('maximus-session', nextSession);
    setCompanyLoginReturnPath(companyLoginContext?.path ?? null);
    if (companyLoginContext) {
      localStorage.setItem(companyLoginContextStorageKey, JSON.stringify(companyLoginContext));
    } else {
      localStorage.removeItem(companyLoginContextStorageKey);
    }
    setLocation(user.role === 'maximus_admin' ? '/maximus/dashboard' : '/entreprise/dashboard');
  };
  const login = async (_space: 'admin' | 'company', email: string, password: string) => {
    const { user } = await authApi.login(email, password);
    applyAuthenticatedUser(user);
  };
  const startSectorTest = (preset: SectorPreset) => {
    const testCompanyId = `sector-test-${preset.id}`;
    const testNodeId = `sector-test-node-${preset.id}`;
    const testRoleId = `sector-test-role-${preset.id}`;
    const selectedModules = [...new Set(preset.moduleIds)];
    const configuredModules = getConfiguredModules(data);
    const selectedModuleFeatures = Object.fromEntries(
      selectedModules.map((moduleId) => {
        const module = configuredModules.find((candidate) => candidate.id === moduleId);
        const selectedPacks = (module?.featurePacks ?? []).filter((pack) =>
          preset.modulePackIds?.[moduleId]?.includes(pack.id),
        );
        const packFeatureIds = selectedPacks.flatMap((pack) => pack.featureIds);
        const featureIds = module
          ? getEffectiveModuleFeatureIds(
              module,
              packFeatureIds.length ? packFeatureIds : preset.moduleFeatures?.[moduleId],
            )
          : new Set<string>();
        return [moduleId, [...featureIds]];
      }),
    ) as Partial<Record<ModuleId, string[]>>;
    const selectedModulePermissions = Object.fromEntries(
      selectedModules.map((moduleId) => {
        const module = configuredModules.find((candidate) => candidate.id === moduleId);
        const selectedPacks = (module?.featurePacks ?? []).filter((pack) =>
          preset.modulePackIds?.[moduleId]?.includes(pack.id),
        );
        const packPermissions = selectedPacks.reduce<FeaturePermissionMap>(
          (permissions, pack) => ({ ...permissions, ...(pack.featurePermissions ?? {}) }),
          {},
        );
        return [
          moduleId,
          Object.fromEntries(
            (selectedModuleFeatures[moduleId] ?? []).map((featureId) => [
              featureId,
              [...(packPermissions[featureId] ?? ['voir'])],
            ]),
          ),
        ];
      }),
    ) as Partial<Record<ModuleId, FeaturePermissionMap>>;
    const testCompany: Company = {
      id: testCompanyId,
      name: preset.name,
      manager: `Administration ${preset.name}`,
      email: `admin.${preset.id}@maximus.local`,
      phone: '',
      country: 'Sénégal',
      sector: preset.name,
      status: 'ACTIF',
      requestedModules: selectedModules,
      requestedModulePackIds: Object.fromEntries(
        Object.entries(preset.modulePackIds ?? {}).map(([moduleId, packIds]) => [moduleId, [...(packIds ?? [])]]),
      ),
      requestedModuleFeatures: Object.fromEntries(
        Object.entries(selectedModuleFeatures).map(([moduleId, featureIds]) => [moduleId, [...(featureIds ?? [])]]),
      ),
      requestedModulePermissions: selectedModulePermissions,
      allowedModules: selectedModules,
      refusedModules: modules.map((module) => module.id).filter((moduleId) => !selectedModules.includes(moduleId)),
      createdAt: new Date().toISOString().slice(0, 10),
      deletionLocked: true,
      managerRoleId: testRoleId,
    };
    const testNode: OrgNode = {
      id: testNodeId,
      companyId: testCompanyId,
      code: 'TEST',
      name: preset.name,
      parentId: null,
      moduleIds: selectedModules,
      modulePackIds: Object.fromEntries(
        Object.entries(preset.modulePackIds ?? {}).map(([moduleId, packIds]) => [moduleId, [...(packIds ?? [])]]),
      ),
      moduleFeatures: selectedModuleFeatures,
    };
    mutate((draft) => {
      draft.companies = [
        ...draft.companies.filter((company) => !company.id.startsWith('sector-test-')),
        testCompany,
      ];
      draft.orgNodes = [
        ...draft.orgNodes.filter((node) => !node.companyId?.startsWith('sector-test-')),
        testNode,
      ];
      draft.roles = draft.roles.filter((role) => !role.companyId?.startsWith('sector-test-'));
      synchronizeUnitPackRoles(draft, testCompany, testNode);

      const generatedPackRoles = draft.roles.filter(
        (role) => role.companyId === testCompanyId && role.sectorId === testNodeId && role.packId,
      );
      const modulePermissions = generatedPackRoles.reduce<Record<string, string[]>>((permissions, role) => {
        Object.entries(role.modulePermissions).forEach(([key, values]) => {
          permissions[key] = [...new Set([...(permissions[key] ?? []), ...values])];
        });
        return permissions;
      }, {});
      selectedModules.forEach((moduleId) => {
        if (!Object.keys(modulePermissions).some((key) => key === moduleId || key.startsWith(`${moduleId}:`) || key.startsWith('presence.'))) {
          modulePermissions[moduleId] = ['voir'];
        }
      });
      draft.roles.push({
        id: testRoleId,
        name: `Administrateur · ${preset.name}`,
        description: `Droits temporaires de l’entreprise préprogrammée « ${preset.name} », calculés depuis ses modules et packs.`,
        companyId: testCompanyId,
        sectorId: testNodeId,
        modulePermissions,
      });
    }, undefined, false);
    localStorage.setItem('maximus-sector-test-company', testCompanyId);
    const nextSession = `company:${testCompanyId}` as Session;
    setSession(nextSession);
    localStorage.setItem('maximus-session', nextSession);
    setLocation('/entreprise/dashboard');
    notify(`Test réel lancé pour le secteur « ${preset.name} ».`);
  };
  const exitSectorTest = () => {
    if (!sectorTestCompanyId) return logout();
    mutate((draft) => {
      draft.companies = draft.companies.filter((company) => company.id !== sectorTestCompanyId);
      draft.orgNodes = draft.orgNodes.filter((node) => node.companyId !== sectorTestCompanyId);
      draft.employees = draft.employees.filter((employee) => employee.companyId !== sectorTestCompanyId);
      draft.roles = draft.roles.filter((role) => role.companyId !== sectorTestCompanyId);
    }, undefined, false);
    localStorage.removeItem('maximus-sector-test-company');
    setSession('admin');
    localStorage.setItem('maximus-session', 'admin');
    setLocation('/maximus/secteurs');
    notify('Test réel terminé. Retour à la configuration des secteurs.', 'success');
  };
  const companyLoginMatch = pathname.match(/^\/(?:entreprise|kora)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/connexion$/);
  const companyLoginSlug = companyLoginMatch ? decodeURIComponent(companyLoginMatch[1]) : null;
  const logoutTo = (destinationOverride?: string) => {
    const isCompanySession = Boolean(session && session !== 'admin');
    const destination = destinationOverride ?? installationLogoutPath(
      Boolean(installationProfile?.companyOnly), isCompanySession ? companyLoginReturnPath : null,
    );
    applyCompanyTheme(undefined);
    const clearedData = emptyStoreData();
    dataRef.current = clearedData;
    setData(clearedData);
    appStateVersionRef.current = 0;
    setAppStateVersion(0);
    setAppStateError('');
    setSubscriptionBlocked(false);
    moduleAccessCacheRef.current.clear();
    setAppStateReady(true);
    setSession(null);
    localStorage.removeItem('maximus-session');
    localStorage.removeItem(companyLoginContextStorageKey);
    setCompanyLoginReturnPath(null);
    setLocation(destination);
    void disableCurrentBrowserPushSubscription()
      .catch(() => undefined)
      .then(() => authApi.logout())
      .catch(() => undefined);
  };
  // A button passes its click event; never interpret that event as a return URL.
  const logout = () => logoutTo();
  useEffect(() => {
    if (
      !companyLoginSlug
      || !session
      || !appStateReady
    ) {
      return;
    }
    logoutTo(location);
  }, [appStateReady, companyLoginSlug, location, session]);
  useEffect(() => {
    const state = window.history.state as { maximus?: boolean; maximusIndex?: number } | null;
    if (!state?.maximus) {
      window.history.replaceState({ ...(state ?? {}), maximus: true, maximusIndex: 0 }, '', window.location.href);
    }
  }, []);
  const navigate = (path: string) => {
    const state = window.history.state as { maximusIndex?: number } | null;
    const currentIndex = typeof state?.maximusIndex === 'number' ? state.maximusIndex : 0;
    const nextPath = canonicalAppPath(path);
    setLocation(nextPath, {
      state: {
        ...(window.history.state ?? {}),
        maximus: true,
        maximusIndex: currentIndex + 1,
      },
    });
    setMobileOpen(false);
  };
  const goBack = (fallback: string) => {
    const state = window.history.state as { maximus?: boolean; maximusIndex?: number } | null;
    if (state?.maximus && (state.maximusIndex ?? 0) > 0) {
      window.history.back();
      return;
    }
    navigate(fallback);
  };

  if (!installationReady) {
    return <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] p-6">
      <section className="card-surface w-full max-w-md rounded-2xl p-7 text-center">
        <h1 className="text-lg font-bold">Préparation de votre espace…</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Vérification de la configuration de l’installation MAXIMUS.
        </p>
      </section>
    </div>;
  }
  const installationEntry = resolveInstallationEntry(installationProfile);
  if (installationEntry === 'unavailable') {
    return <InstallationUnavailable
      message={installationError || 'L’adresse utilisée ou la configuration de cette installation n’est pas reconnue. Vérifiez l’adresse fournie par votre entreprise.'}
      onRetry={() => setInstallationRetry((value) => value + 1)}
    />;
  }
  if (installationProfile?.companyOnly && pathname.startsWith('/maximus')) {
    return <InstallationCompanyOnlyNotice onBack={() => setLocation('/')} />;
  }
  if (location === '/inscription' && installationProfile?.companyOnly)
    return <InstallationCompanyOnlyNotice onBack={() => setLocation('/')} />;
  if (location === '/inscription')
    return session === 'admin' ? (
      <AdminCreateCompanyPage
        data={data}
        mutate={mutate}
        onComplete={() => {
          notify('Entreprise créée et activée depuis l’administration MAXIMUS.', 'success');
          setLocation('/maximus/entreprises');
        }}
        onCancel={() => setLocation('/maximus/entreprises')}
      />
    ) : (
      <Signup
        key={`signup-${registrationCatalogVersion}`}
        data={data}
        intelligentRegistrationEnabled={intelligentRegistrationEnabled}
        onIntelligent={() => setLocation('/onboarding')}
        onComplete={() => {
          notify('Votre demande a bien été envoyée.', 'success');
          setLocation('/');
        }}
      />
    );
  if (location === '/onboarding' && installationProfile?.companyOnly) {
    return <InstallationCompanyOnlyNotice onBack={() => setLocation('/')} />;
  }
  if (location === '/onboarding' && !session) {
    if (!intelligentRegistrationEnabled) {
      return <PublicRegistrationClosed onBack={() => setLocation('/')} />;
    }
    return (
      <IntelligentOnboardingPage
        data={data}
        onManual={() => setLocation('/inscription')}
        onComplete={() => {
          notify('Votre demande a bien été envoyée.', 'success');
          setLocation('/');
        }}
        onSubmitRequest={async ({ draftId, identity }) => {
          const { passwordConfirm: _passwordConfirm, ...requestIdentity } = identity;
          await onboardingApi.confirmDraft(draftId, requestIdentity);
        }}
      />
    );
  }
  if (pathname === '/client-app' || pathname.startsWith('/client-app/')) {
    const pwaEntry = parseClientPwaPath(pathname);
    if (pwaEntry?.slug) return <PublicShopPage slug={pwaEntry.slug} clientApp />;
    if (pwaEntry?.domain) return <PublicShopPage domain clientApp />;
  }
  if (pathname === '/' && installationEntry === 'shop') {
    return <PublicShopPage domain />;
  }
  if (companyLoginSlug && session && appStateReady) {
    return <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] p-6">
      <section className="card-surface w-full max-w-md rounded-2xl p-7 text-center">
        <h1 className="text-lg font-bold">Changement d’espace en cours…</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          La session de l’autre entreprise est en cours de fermeture.
        </p>
      </section>
    </div>;
  }
  if (companyLoginSlug && !session) {
    if (installationProfile?.companyOnly) {
      if (companyLoginSlug !== installationProfile.company?.slug) {
        return <InstallationCompanyOnlyNotice onBack={() => setLocation('/')} />;
      }
      return <CompanyLoginPage installationCompany={installationProfile.company!} onAuthenticated={applyAuthenticatedUser} />;
    }
    return (
      <CompanyLoginPage
        slug={companyLoginSlug}
        onAuthenticated={(user) => {
          applyAuthenticatedUser(user, pathname);
        }}
      />
    );
  }
  const publicShopMatch = location.split('?')[0].match(/^\/shop\/([^/]+)(.*)$/);
  if (publicShopMatch) {
    return <PublicShopPage slug={decodeURIComponent(publicShopMatch[1])} />;
  }
  if (session && !appStateReady) {
    if (subscriptionBlocked) {
      return (
        <Suspense fallback={<div className="min-h-screen bg-[hsl(var(--background))]" />}>
          <SubscriptionAccessGate
            isCompanyAdmin={session.startsWith('company:')}
            message={appStateError}
            onRetryAccess={refreshAppState}
            onLogout={logout}
          />
        </Suspense>
      );
    }
    return <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] p-6">
      <section className="card-surface w-full max-w-md rounded-2xl p-7 text-center">
        <h1 className="text-lg font-bold">{appStateError ? 'Les données métier ne sont pas accessibles' : 'Chargement de l’espace…'}</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          {appStateError || 'Connexion à votre espace entreprise en cours.'}
        </p>
        {appStateError && <button type="button" onClick={() => {
          setAppStateError('');
          void refreshAppState().then((ready) => setAppStateReady(ready));
        }} className="mt-5 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]">Réessayer</button>}
      </section>
    </div>;
  }
  const loginEmployees = [
    ...data.employees,
  ];
  if (location === '/' || !session) {
    if (installationProfile?.companyOnly && installationProfile.company) {
      return <CompanyLoginPage installationCompany={installationProfile.company} onAuthenticated={applyAuthenticatedUser} />;
    }
    return (
      <Login
        onLogin={login}
        employees={loginEmployees}
        registrationEnabled={intelligentRegistrationEnabled}
        installationProfile={installationProfile}
      />
    );
  }
  const isAdmin = session === 'admin' && !installationProfile?.companyOnly;
  const companyAdmin = session.startsWith('company:');
  const employeeId = sessionEmployeeId;
  const employee = employeeId ? (data.employees.find((e) => e.id === employeeId) ?? null) : null;
  const companyId = activeCompanyId ?? '';
  const currentCompany = activeCompany;
  const effectiveHiddenWorkspaceFeatures = resolveCompanyWorkspaceHiddenFeatures(
    currentCompany?.hiddenWorkspaceFeatures,
    companyAdmin,
    subscriptionBillingMode,
  );
  const {
    accessRole,
    employeeNode,
    allowed,
    canManagePeople,
    commerceTabIds,
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
    sidebarFeatureGroups,
    stockPermissions,
    sectorManager,
  } = buildAppAccessContext({
    data,
    session,
    employee,
    activeCompanyId,
    activeCompany: currentCompany,
    sectorTestCompanyId,
    serverModuleStatuses,
    serverModuleAccess,
    serverModuleAccessReady:
      serverModuleAccessReady && (!activeCompanyId || serverModuleAccessCompanyId === activeCompanyId),
  });
  const adminAssistantScope = buildAdminAssistantScope(data, 'Administration principale');
  const baseMeta =
    pageMeta[normalizeRoutePath(location)] ??
    modulePageMeta[normalizeRoutePath(location)] ??
    (location.startsWith('/maximus/entreprises/')
      ? {
          kicker: 'Administration',
          title: 'Réglages de l’entreprise',
          description: 'Gérez les modules, les autorisations et les accès de cette entreprise.',
        }
      : pageMeta[isAdmin ? '/maximus/dashboard' : '/entreprise/dashboard']);
  const companyRoutePath = normalizeRoutePath(location);
  const currentMeta =
    !isAdmin && currentCompany
      ? companyRoutePath === '/entreprise/dashboard'
        ? {
            kicker: currentCompany.name,
            title: `Pilotage de ${currentCompany.name}`,
            description: `${currentCompany.sector} · Une vue claire pour décider plus vite.`,
          }
        : { ...baseMeta, kicker: currentCompany.name }
      : baseMeta;
  const currentPath = companyRoutePath;
  const hidePageHeader = routesWithOwnedHeadings.has(currentPath)
    || currentPath === '/maximus/dashboard'
    || currentPath === '/entreprise/dashboard';
  const companyInitials =
    currentCompany?.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || 'KD';
  const notificationContext = { isAdmin, companyId };
  const unreadNotifications = getVisibleNotifications(data.notifications, notificationContext).filter(
    (notification) => !notification.read,
  ).length;
  return (
    <NavigationSettingsContext.Provider value={{ isCompanyAdmin: companyAdmin && !isAdmin, onSaved: () => refreshAppState() }}>
    <div className={`app-shell ${isAdmin ? '' : 'company-workspace'} flex h-[100dvh] min-h-0 overflow-hidden`} style={activeCompanyTheme as CSSProperties}>
      <Sidebar
        session={session}
        location={location}
        allowed={allowed}
        sidebarFeatureGroups={sidebarFeatureGroups}
        canManagePeople={canManagePeople}
        onNavigate={navigate}
        onLogout={sectorTestCompanyId ? exitSectorTest : logout}
        employee={employee}
        companyName={currentCompany?.name}
        companyPhoto={currentCompany?.profilePhoto}
        adminLogo="/maximus-mark.svg"
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        activeNavStyle={activeNavStyle}
        hiddenWorkspaceFeatures={effectiveHiddenWorkspaceFeatures}
        navigationMode={companyNavigationMode(currentCompany)}
      />
      <main className="app-main min-w-0 flex-1 overflow-y-auto overscroll-contain" tabIndex={-1}>
        <Topbar
          workspaceName={isAdmin ? 'MAXIMUS · Administration' : currentCompany?.name ?? 'Espace entreprise'}
          mobileOpen={mobileOpen}
          isAdmin={isAdmin}
          onNavigate={navigate}
          onToggleMenu={() => setMobileOpen(true)}
          notificationPath={isAdmin ? '/maximus/notifications' : '/entreprise/notifications'}
          unreadCount={unreadNotifications}
          onRefresh={async () => {
            window.dispatchEvent(new Event('maximus:refresh'));
            await refreshAppState();
          }}
          onHelp={() => {
            void alert({
              title: 'Aide MAXIMUS',
              description: 'Explorez les vues depuis la navigation de votre espace.',
              confirmLabel: 'Compris',
            });
          }}
        />
        <div className="page-pad page-content mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 xl:px-10">
          {!isAdmin && companyId && currentCompany && companyRoutePath !== '/entreprise/notifications' && (
            <CompanyPushNotificationPrompt
              key={`${companyId}-floating`}
              companyId={companyId}
              companyName={currentCompany.name}
              placement="floating"
            />
          )}
          {!isAdmin && companyId && (
            <CompanySubscriptionExpiryNotice
              companyId={companyId}
              isCompanyAdmin={companyAdmin}
              onNavigate={navigate}
            />
          )}
          {installationProfile?.companyOnly && (companyAdmin || sectorManager) && (
            <InstallationSyncNotice sync={installationProfile.sync} onRefresh={() => setInstallationRetry((value) => value + 1)} />
          )}
          {sectorTestCompanyId && (
            <div
              data-testid="sector-test-banner"
              className="mb-5 flex flex-col gap-3 rounded-xl border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.08)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <strong className="block text-xs text-[hsl(var(--primary))]">Test réel de secteur en cours</strong>
                <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">
                  Vous êtes dans l’espace entreprise réel avec les modules autorisés par ce secteur.
                </span>
              </div>
              <button
                type="button"
                data-testid="button-exit-sector-test"
                onClick={exitSectorTest}
                className="shrink-0 rounded-lg border border-[hsl(var(--primary)/.35)] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.1)]"
              >
                Quitter le test
              </button>
            </div>
          )}
          {!isAdmin && companyId && companyNavigationMode(currentCompany) === 'horizontal' && (
            <CompanyFeatureRail groups={sidebarFeatureGroups} location={location} onNavigate={navigate} />
          )}
          {!hidePageHeader && (
            <PageHeader
              {...currentMeta}
              location={location}
               onBack={() => goBack(isAdmin ? '/maximus/dashboard' : '/entreprise/dashboard')}
            />
          )}
          {serverModuleAccessError && serverModuleAccessCompanyId === activeCompanyId && !isAdmin && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-[hsl(var(--destructive)/.35)] bg-[hsl(var(--destructive)/.08)] px-4 py-3 text-sm text-[hsl(var(--destructive))]"
            >
              <strong className="block">Accès modules non confirmé</strong>
              <span className="mt-1 block text-xs leading-5">
                {serverModuleAccessError} Les modules sont masqués par sécurité. Un administrateur MAXIMUS doit
                resynchroniser cette entreprise avant sa prochaine utilisation.
              </span>
            </div>
          )}
          <ErrorBoundary resetKey={location}>
            <Suspense
              fallback={
                <div className="card-surface rounded-2xl p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  Chargement de l’espace…
                </div>
              }
            >
              {isAdmin ? (
                <AdminRouter
                  location={location}
                  data={data}
                  mutate={mutate}
                  notify={notify}
                  onNavigate={navigate}
                  onRefresh={refreshAppState}
                  onBack={goBack}
                  onModuleAccess={updateCompanyModuleAccess}
                   assistantScope={adminAssistantScope}
                    onAskAssistant={(question, history) => maximusAssistantApi.ask(question, history)}
                    onPreviewAssistantAction={(action: MaximusAssistantAction) => maximusAssistantApi.previewAction(action)}
                    onExecuteAssistantAction={(action: MaximusAssistantAction) =>
                      maximusAssistantApi.executeAction(action).then(async response => {
                        await refreshAppState();
                        return response;
                      })
                    }
                   onTestSector={startSectorTest}
                  screens={{
                    dashboard: AdminDashboard,
                     assistant: MaximusAssistantPage,
                    control: ControlCenterPage,
                     surveillance: SystemHealthPage,
                    organization: OrganizationAdminPage,
                    companyDetail: CompanyModulesDetail,
                    companies: CompaniesPage,
                    requests: RequestsPage,
                    modules: InteractiveModulesPage,
                    sectors: SectorPresetsPage,
                    subscriptions: SubscriptionsPage,
                    notifications: NotificationsPage,
                    journal: JournalPage,
                    platformSettings: PlatformSettingsPage,
                    empty: EmptyState,
                  }}
                />
              ) : (
                <CompanyRouter
                  location={location}
                  mutate={mutate}
                  notify={notify}
                  data={data}
                  onNavigate={navigate}
                  onBack={goBack}
                  allowed={allowed}
                  canManagePeople={canManagePeople}
                  companyAdmin={companyAdmin}
                  sectorManager={sectorManager}
                  scopeNodeId={employeeNode?.id}
                  companyId={companyId}
                  employee={employee}
                  employees={data.employees}
                  presenceEmployees={presenceEmployees}
                  hasPermission={hasPermission}
                  hasPresencePermission={hasPresencePermission}
                  presenceFeatureIds={selectedPresenceFeatureIds}
                  ecommerceFeatureIds={selectedEcommerceFeatureIds}
                  ecommerceFeaturePermissions={ecommerceFeaturePermissions}
                  payrollFeatureIds={selectedPayrollFeatureIds}
                  payrollFeaturePermissions={payrollFeaturePermissions}
                  commerceTabPermissions={commerceTabPermissions}
                  moduleFeaturePermissions={moduleFeaturePermissions}
                  transportFeatureIds={selectedTransportFeatureIds}
                  transportFeaturePermissions={transportFeaturePermissions}
                  stockPermissions={Object.keys(stockPermissions ?? {}).length ? stockPermissions : undefined}
                  commerceTabIds={commerceTabIds}
                  moduleStatuses={serverModuleStatuses ?? {}}
                   serverModuleAccess={serverModuleAccess}
                    serverModuleAccessReady={
                      serverModuleAccessReady
                      && (!activeCompanyId || serverModuleAccessCompanyId === activeCompanyId)
                    }
                    serverModuleAccessError={serverModuleAccessError}
                   hiddenWorkspaceFeatures={effectiveHiddenWorkspaceFeatures}
                  screens={{
                    dashboard: RoleAwareCompanyDashboard,
                    control: ControlCenterPage,
                    notifications: NotificationsPage,
                    setupGuide: CompanySetupGuide,
                    organization: CompanyOrganizationAdmin,
                    empty: EmptyState,
                    stocks: StockModulePage,
                    ecommerce: EcommerceModulePage,
                    immobilier: ImmobilierModulePage,
                    amicales: AmicaleModulePage,
                    finance: FinancePage,
                    commerce: CommerceModulePage,
                    operational: OperationalModulePage,
                    transport: TransportModulePage,
                    payroll: PayrollModulePage,
                    humanResources: HumanResourcesWorkspace,
                    presence: PresenceModulePage,
                    reports: OperationalReportsPage,
                  }}
                />
              )}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      <Toaster />
    </div>
    </NavigationSettingsContext.Provider>
  );
}

function Login({
  onLogin,
  employees,
  registrationEnabled,
  installationProfile,
}: {
  onLogin: (space: 'admin' | 'company', email: string, password: string) => Promise<void>;
  employees: StoreData['employees'];
  registrationEnabled: boolean;
  installationProfile: InstallationProfile | null;
}) {
  const showDemoAccounts = false;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginHelp, setLoginHelp] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const loginWithCredentials = (space: 'admin' | 'company', nextEmail: string, nextPassword: string) => {
    if (pendingEmail) return;
    setError('');
    setPendingEmail(nextEmail);
    void onLogin(space, nextEmail, nextPassword)
      .catch((loginError) => setError(loginError instanceof Error ? loginError.message : 'La connexion MAXIMUS a échoué.'))
      .finally(() => setPendingEmail(''));
  };
  const submitLogin = (space: 'admin' | 'company') => loginWithCredentials(space, email, password);
  const demoAccounts = showDemoAccounts
    ? [
        ...defaultDemoAccounts,
        ...employees
          .filter(
            (account) =>
              account.status === 'ACTIF' &&
              Boolean(account.loginPassword) &&
              !defaultDemoAccounts.some((demoAccount) => demoAccount.email === account.email.toLowerCase()),
          )
          .map((account) => ({
            id: account.id,
            label: `${account.firstName} ${account.lastName} · ${account.position}`,
            email: account.email,
            password: account.loginPassword ?? '',
          })),
      ]
    : [];
  const selectDemoAccount = (account: (typeof demoAccounts)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
    loginWithCredentials(account.id === 'maximus-admin' ? 'admin' : 'company', account.email, account.password);
  };
  return (
    <AuthLayout
      testId="page-login"
      showcase={
        <>
          <Brand inverse large />
          <div className="mt-16 max-w-xl">
            <p className="mono mb-5 text-[10px] font-bold uppercase tracking-[.24em] text-[hsl(var(--accent))]">
              La gestion d’entreprise, simplement
            </p>
            <h2 className="text-5xl font-bold leading-[1.02] tracking-[-.055em] xl:text-6xl">
              Toute votre entreprise.
              <br />
              <span className="text-[hsl(var(--accent))]">Au même endroit.</span>
            </h2>
            <p className="mt-6 max-w-md text-base leading-7 text-[hsl(var(--sidebar-foreground)/.7)]">
              MAXIMUS réunit vos équipes, vos opérations et vos chiffres essentiels pour vous aider à mieux gérer
              aujourd’hui et à grandir demain.
            </p>
          </div>
          <p className="mono mt-12 text-[10px] uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.5)]">
            Sénégal · Côte d’Ivoire · UEMOA
          </p>
        </>
      }
    >
          <div className="mb-8 lg:hidden">
            <Brand large />
          </div>
          <AuthCard
            eyebrow={installationProfile?.companyOnly ? 'Espace entreprise dédié' : 'Accédez à votre espace'}
            title={installationProfile?.companyOnly && installationProfile.company
              ? `Bienvenue chez ${installationProfile.company.name}`
              : 'Connexion à MAXIMUS'}
            description="Connectez-vous pour retrouver les outils et les informations de votre entreprise au même endroit."
            footer={!installationProfile?.companyOnly ? (
              <div className="text-center text-sm text-[hsl(var(--muted-foreground))]">
                Pas encore d’espace ?{' '}
                <Link data-testid="link-signup" href="/inscription" className="font-bold text-[hsl(var(--primary))] underline-offset-4 hover:underline">
                  Créer une entreprise
                </Link>
                {!registrationEnabled && (
                  <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                    L’inscription automatique est momentanément indisponible. Le formulaire manuel reste disponible.
                  </p>
                )}
              </div>
            ) : undefined}
          >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitLogin('company');
            }}
            className="space-y-5"
          >
            <Field
              label="Adresse email"
              value={email}
              onChange={setEmail}
              type="email"
              testId="input-login-email"
              help="Adresse du compte MAXIMUS, de l’entreprise ou de l’employé."
            />
            <Field
              label="Mot de passe"
              value={password}
              onChange={setPassword}
              type="password"
              testId="input-login-password"
              help="Mot de passe associé à l’adresse email saisie."
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="link"
                size="sm"
                data-testid="button-forgot-password"
                aria-expanded={loginHelp}
                onClick={() => setLoginHelp((value) => !value)}
                className="h-auto min-h-0 px-0"
              >
                Aide à la connexion
              </Button>
            </div>
            {loginHelp && (
              <Alert>
                <AlertDescription className="text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                  Utilisez l’adresse email et le mot de passe fournis par votre administrateur. Tous les comptes se
                  connectent depuis ce même formulaire.
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive" data-testid="login-error">
                <AlertDescription className="text-xs font-semibold">{error}</AlertDescription>
              </Alert>
            )}
            <Button
              data-testid="button-login"
              disabled={Boolean(pendingEmail)}
              size="lg"
              className="w-full gap-2 font-bold disabled:cursor-wait"
              type="submit"
            >
              <LogIn size={17} className={pendingEmail ? 'animate-pulse' : ''} />
              {pendingEmail ? 'Connexion en cours…' : 'Se connecter'}
            </Button>
          </form>
          </AuthCard>
          {showDemoAccounts && demoAccounts.length > 0 && (
            <div className="mt-8 rounded-xl border border-dashed border-[hsl(var(--border))] p-4">
              <span className="text-xs font-bold text-[hsl(var(--foreground))]">Comptes de démonstration</span>
              <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                Les accès ci-dessous sont prêts à l’emploi. Cliquez sur un compte pour vous connecter directement.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {demoAccounts.map((account) => (
                  <button
                    type="button"
                    disabled={Boolean(pendingEmail)}
                    data-testid={`button-demo-account-${account.id}`}
                    key={account.id}
                    onClick={() => selectDemoAccount(account)}
                    className={`rounded-lg border px-3 py-2 text-left transition hover:border-[hsl(var(--primary)/.55)] hover:bg-[hsl(var(--primary)/.06)] disabled:cursor-wait disabled:opacity-60 ${email === account.email ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.06)]' : ''}`}
                  >
                    <span className="block text-xs font-bold">{account.label}</span>
                    <span className="mt-0.5 block text-[11px] text-[hsl(var(--muted-foreground))]">{account.email}</span>
                    <span
                      data-testid={`demo-account-password-${account.id}`}
                      className="mt-1 block text-[10px] font-semibold text-[hsl(var(--primary))]"
                    >
                      Mot de passe : {account.password}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
    </AuthLayout>
  );
}

function InstallationCompanyOnlyNotice({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] p-6">
      <section className="card-surface w-full max-w-md rounded-2xl p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]">
          <Building2 size={22} />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Espace entreprise dédié</h1>
        <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
          Cette installation est réservée à une seule entreprise. Les inscriptions et l’administration générale
          MAXIMUS sont disponibles uniquement sur l’instance centrale.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 rounded-lg bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"
        >
          Retour à la connexion
        </button>
      </section>
    </div>
  );
}

function Signup({
  data,
  intelligentRegistrationEnabled,
  onIntelligent,
  onComplete,
}: {
  data: StoreData;
  intelligentRegistrationEnabled: boolean;
  onIntelligent: () => void;
  onComplete: () => void;
}) {
  const fallbackPreset: SectorPreset = {
    id: 'default',
    name: 'Configuration manuelle',
    moduleIds: ['commerce', 'stocks', 'presences'],
  };
  const initialPreset = fallbackPreset;
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [manager, setManager] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Sénégal');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [sector, setSector] = useState('');
  const [selectedModules, setSelectedModules] = useState<ModuleId[]>([...initialPreset.moduleIds]);
  const [selectedModulePackIds, setSelectedModulePackIds] = useState<Partial<Record<ModuleId, string[]>>>({});
  const [selectedModuleFeatures, setSelectedModuleFeatures] = useState<Partial<Record<ModuleId, string[]>>>(
    () =>
      Object.fromEntries(
        initialPreset.moduleIds.map((moduleId) => {
          const module = modules.find((item) => item.id === moduleId);
          return [
            moduleId,
            module ? [...getEffectiveModuleFeatureIds(module, initialPreset.moduleFeatures?.[moduleId] ?? [])] : [],
          ];
        }),
      ) as Partial<Record<ModuleId, string[]>>,
  );
  const [selectedModulePermissions, setSelectedModulePermissions] = useState<
    Partial<Record<ModuleId, FeaturePermissionMap>>
  >(
    () =>
      Object.fromEntries(
        initialPreset.moduleIds.map((moduleId) => {
          const module = modules.find((item) => item.id === moduleId);
          const featureIds = module
            ? getEffectiveModuleFeatureIds(module, initialPreset.moduleFeatures?.[moduleId] ?? [])
            : [];
          return [moduleId, defaultFeaturePermissions(featureIds)];
        }),
      ) as Partial<Record<ModuleId, FeaturePermissionMap>>,
  );
  const [moduleError, setModuleError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const publishedModules = getConfiguredModules({
    moduleOverrides: data.moduleOverrides,
    customModules: data.customModules,
    removedModules: data.removedModules,
  });
  const configuredModule = (moduleId: ModuleId) => {
    return publishedModules.find((module) => module.id === moduleId);
  };
  const changeSector = (nextSector: string) => {
    const preset = data.sectorPresets.find((item) => item.name === nextSector);
    const nextModules = preset ? [...preset.moduleIds] : [...fallbackPreset.moduleIds];
    setSector(nextSector);
    if (preset?.modulePackIds && Object.keys(preset.modulePackIds).length > 0) {
      applySectorPacks(preset);
      setModuleError('');
      return;
    }
    setSelectedModules(nextModules);
    setSelectedModulePackIds({});
    setSelectedModuleFeatures(
      Object.fromEntries(
        nextModules.map((moduleId) => {
          const module = configuredModule(moduleId);
          const requested = preset?.moduleFeatures?.[moduleId];
          return [moduleId, module ? [...getEffectiveModuleFeatureIds(module, requested ?? [])] : []];
        }),
      ) as Partial<Record<ModuleId, string[]>>,
    );
    setSelectedModulePermissions(
      Object.fromEntries(
        nextModules.map((moduleId) => {
          const module = configuredModule(moduleId);
          const featureIds = module ? getEffectiveModuleFeatureIds(module, preset?.moduleFeatures?.[moduleId] ?? []) : [];
          return [moduleId, defaultFeaturePermissions(featureIds)];
        }),
      ) as Partial<Record<ModuleId, FeaturePermissionMap>>,
    );
    setModuleError('');
  };
  const applySectorPacks = (preset: SectorPreset) => {
    const packEntries = Object.entries(preset.modulePackIds ?? {}).filter(([, packIds]) => (packIds ?? []).length) as [
      ModuleId,
      string[],
    ][];
    const entries = packEntries.length
      ? packEntries
      : (Object.entries(preset.moduleFeatures ?? {}) as [ModuleId, string[]][]);
    setSelectedModules(packEntries.length ? packEntries.map(([moduleId]) => moduleId) : [...preset.moduleIds]);
    setSelectedModulePackIds(Object.fromEntries(packEntries.map(([moduleId, packIds]) => [moduleId, [...packIds]])));
    setSelectedModuleFeatures(
      Object.fromEntries(
        entries.map(([moduleId, featureIds]) => {
          const module = configuredModule(moduleId);
          const packFeatures = packEntries.length
            ? (module?.featurePacks ?? [])
                .filter((pack) => preset.modulePackIds?.[moduleId]?.includes(pack.id))
                .flatMap((pack) => pack.featureIds)
            : featureIds;
          return [moduleId, module ? [...getEffectiveModuleFeatureIds(module, packFeatures)] : [...packFeatures]];
        }),
      ) as Partial<Record<ModuleId, string[]>>,
    );
    setSelectedModulePermissions(
      Object.fromEntries(
        entries.map(([moduleId]) => {
          const module = configuredModule(moduleId);
          const selectedPacks =
            module?.featurePacks?.filter((pack) => preset.modulePackIds?.[moduleId]?.includes(pack.id)) ?? [];
          const featureIds = module
            ? getEffectiveModuleFeatureIds(
                module,
                selectedPacks.length
                  ? selectedPacks.flatMap((pack) => pack.featureIds)
                  : preset.moduleFeatures?.[moduleId] ?? [],
              )
            : [];
          const permissions = selectedPacks.reduce<FeaturePermissionMap>(
            (all, pack) => ({ ...all, ...(pack.featurePermissions ?? {}) }),
            {},
          );
          return [moduleId, defaultFeaturePermissions(featureIds, permissions)];
        }),
      ) as Partial<Record<ModuleId, FeaturePermissionMap>>,
    );
    setModuleError('');
  };
  const toggle = (id: ModuleId) => {
    const enabled = selectedModules.includes(id);
    setSelectedModules((previous) => (enabled ? previous.filter((moduleId) => moduleId !== id) : [...previous, id]));
    setSelectedModuleFeatures((current) => {
      if (enabled) {
        const next = { ...current };
        delete next[id];
        setSelectedModulePackIds((packIds) => {
          const nextPacks = { ...packIds };
          delete nextPacks[id];
          return nextPacks;
        });
        return next;
      }
      const module = configuredModule(id);
      if (module?.featurePacks?.length) setSelectedModulePackIds((current) => ({ ...current, [id]: [] }));
      const availableFeatures: string[] = [];
      setSelectedModulePermissions((current) => ({ ...current, [id]: defaultFeaturePermissions(availableFeatures) }));
      return { ...current, [id]: module ? [...getEffectiveModuleFeatureIds(module, availableFeatures)] : [] };
    });
    if (enabled)
      setSelectedModulePermissions((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    setModuleError('');
  };
  const togglePack = (moduleId: ModuleId, packId: string) => {
    const module = configuredModule(moduleId);
    if (!module) return;
    const error = getModulePackError(module, [packId]);
    if (error && !selectedModulePackIds[moduleId]?.includes(packId)) {
      setModuleError(error);
      return;
    }
    setModuleError('');
    setSelectedModulePackIds((current) => {
      const nextIds = current[moduleId]?.includes(packId)
        ? (current[moduleId] ?? []).filter((id) => id !== packId)
        : [...(current[moduleId] ?? []), packId];
      const selectedPacks = (module.featurePacks ?? []).filter((pack) => nextIds.includes(pack.id));
      const featureIds = [...getEffectiveModuleFeatureIds(module, selectedPacks.flatMap((pack) => pack.featureIds))];
      setSelectedModuleFeatures((features) => ({
        ...features,
        [moduleId]: [...getEffectiveModuleFeatureIds(module, featureIds)],
      }));
      setSelectedModulePermissions((permissions) => ({
        ...permissions,
        [moduleId]: defaultFeaturePermissions(
          featureIds,
          selectedPacks.reduce<FeaturePermissionMap>(
            (all, pack) => ({ ...all, ...(pack.featurePermissions ?? {}) }),
            {},
          ),
        ),
      }));
      return { ...current, [moduleId]: nextIds };
    });
  };
  const toggleFeature = (moduleId: ModuleId, featureId: string) => {
    const module = configuredModule(moduleId);
    if (!module) return;
    setSelectedModuleFeatures((current) => {
      const selected = new Set(current[moduleId] ?? []);
      if (selected.has(featureId)) selected.delete(featureId);
      else selected.add(featureId);
      setSelectedModulePermissions((permissions) => {
        const next = { ...(permissions[moduleId] ?? {}) };
        if (selected.has(featureId)) next[featureId] = next[featureId]?.length ? next[featureId] : ['voir'];
        else delete next[featureId];
        return { ...permissions, [moduleId]: next };
      });
      return { ...current, [moduleId]: [...getEffectiveModuleFeatureIds(module, [...selected])] };
    });
  };
  const selectedPreset = data.sectorPresets.find((preset) => preset.name === sector);
  const selectedModuleSet = new Set(selectedModules);
  const selectedPackCount = Object.values(selectedModulePackIds).reduce(
    (total, packIds) => total + (packIds?.length ?? 0),
    0,
  );
  const selectedFeatureCount = selectedModules.reduce(
    (total, moduleId) => total + (selectedModuleFeatures[moduleId]?.length ?? 0),
    0,
  );
  const orderedModules = [...publishedModules].sort(
    (left, right) => Number(selectedModuleSet.has(right.id)) - Number(selectedModuleSet.has(left.id)),
  );
  const submitSignupRequest = async () => {
    if (submitting) return;
    if (selectedModules.length === 0) {
      setModuleError('Le secteur doit proposer au moins un module pour envoyer la demande.');
      return;
    }
    for (const moduleId of selectedModules) {
      const module = configuredModule(moduleId);
      const error = module
        ? getModulePackError(module, selectedModulePackIds[moduleId] ?? [])
        : `Le module « ${moduleId} » n’est plus publié.`;
      if (error) {
        setModuleError(error);
        return;
      }
    }
    const requestedModuleFeatures = Object.fromEntries(
      selectedModules.map((moduleId) => {
        const module = configuredModule(moduleId);
        return [
          moduleId,
          module
            ? normalizeFeatureIdsForSelectedPacks(
                module,
                selectedModuleFeatures[moduleId] ?? [],
                selectedModulePackIds[moduleId] ?? [],
              )
            : [],
        ];
      }),
    ) as Partial<Record<ModuleId, string[]>>;
    const requestedModulePermissions = Object.fromEntries(
      selectedModules.map((moduleId) => [
        moduleId,
        defaultFeaturePermissions(
          requestedModuleFeatures[moduleId] ?? [],
          selectedModulePermissions[moduleId],
        ),
      ]),
    ) as Partial<Record<ModuleId, FeaturePermissionMap>>;

    setSubmitting(true);
    setSubmitError('');
    setModuleError('');
    try {
      await companyRequestApi.create({
        name: name.trim(),
        manager: manager.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        country: country.trim(),
        sector: sector.trim(),
        requestedModules: selectedModules,
        requestedModulePackIds: Object.fromEntries(
          Object.entries(selectedModulePackIds).filter(([, packIds]) => (packIds ?? []).length),
        ),
        requestedModuleFeatures,
        requestedModulePermissions,
      });
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'La demande n’a pas pu être enregistrée.');
    } finally {
      setSubmitting(false);
    }
  };
  if (submitted) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] p-6">
        <div className="card-surface w-full max-w-xl rounded-2xl p-8 text-center fade-up">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]">
            <Check size={25} />
          </span>
          <p className="mono mt-6 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Demande envoyée</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-.04em]">
            {sector.trim() ? 'Votre demande est en attente.' : 'Votre entreprise est en attente de validation.'}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            {sector.trim()
              ? 'L’administration MAXIMUS examine votre demande. Les modules du secteur choisi seront configurés après validation.'
              : 'Votre demande est en cours d’examen par l’administration MAXIMUS. Vous pourrez configurer votre organisation depuis votre espace après activation.'}
          </p>
          <button
            data-testid="button-back-after-signup"
            onClick={onComplete}
            className="btn mt-8 rounded-lg bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--background))]">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.9)] px-4 py-4 backdrop-blur sm:px-6 lg:px-12">
        <Brand />
        <Link
          data-testid="link-back-login"
          href="/"
          className="text-sm font-semibold text-[hsl(var(--muted-foreground))]"
        >
          Retour à la connexion
        </Link>
      </header>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:gap-14 lg:py-16 fade-up">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="mono text-[11px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">
            Nouvel espace entreprise
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-[-.05em] sm:text-4xl">Commencez avec une base claire.</h1>
          <p className="mt-3 text-[hsl(var(--muted-foreground))]">
            Choisissez un secteur pour envoyer directement votre demande à MAXIMUS. Sans secteur, vous pourrez configurer
            manuellement les modules et fonctionnalités.
          </p>
          {intelligentRegistrationEnabled ? (
            <button
              type="button"
              onClick={onIntelligent}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.06)] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--primary)/.12)]"
            >
              <Sparkles size={16} />
              Décrire mon entreprise à MAXIMUS
            </button>
          ) : (
            <p className="mt-5 rounded-lg bg-[hsl(var(--muted))] px-4 py-3 text-xs font-semibold text-[hsl(var(--muted-foreground))]">
              L’inscription automatique est temporairement indisponible. Vous pouvez continuer avec le formulaire manuel ci-dessous.
            </p>
          )}
        </div>
        <div className="min-w-0">
        <div className="mb-10 flex items-center gap-3">
          <Step n={1} label="Votre entreprise" active={step === 1} done={step > 1} />
          {!sector.trim() && (
            <>
              <div className="h-px flex-1 bg-[hsl(var(--border))]" />
              <Step n={2} label="Fonctionnalités" active={step === 2} done={false} />
            </>
          )}
        </div>
        {step === 1 ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (sector.trim()) {
                void submitSignupRequest();
                return;
              }
              setStep(2);
            }}
            className="card-surface rounded-2xl p-6 sm:p-8"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Nom de l’entreprise"
                placeholder="Ex. votre entreprise"
                value={name}
                onChange={setName}
                testId="input-company-name"
              />
              <Field
                label="Responsable"
                placeholder="Prénom Nom"
                value={manager}
                onChange={setManager}
                testId="input-company-manager"
              />
              <Field
                label="Email professionnel"
                placeholder="vous@entreprise.com"
                value={email}
                onChange={setEmail}
                type="email"
                testId="input-company-email"
              />
              <Field
                label="Téléphone"
                placeholder="+221 77 000 00 00"
                value={phone}
                onChange={setPhone}
                testId="input-company-phone"
              />
              <Field
                label="Pays"
                placeholder="Sénégal"
                value={country}
                onChange={setCountry}
                testId="input-company-country"
              />
              <label className="block text-sm font-semibold">
                Secteur
                <select
                  data-testid="select-company-sector"
                  value={sector}
                  onChange={(e) => changeSector(e.target.value)}
                  className="mt-2 w-full rounded-lg border bg-transparent px-3 py-3 text-sm font-normal"
                >
                  <option value="">Aucun secteur — configurer manuellement</option>
                  {data.sectorPresets.map((preset) => (
                    <option key={preset.id} value={preset.name}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[10px] font-normal leading-4 text-[hsl(var(--muted-foreground))]">
                  {sector
                    ? 'Le secteur sera transmis à MAXIMUS; les modules seront configurés après validation.'
                    : 'Choisissez un secteur ou laissez ce champ vide pour configurer les modules manuellement.'}
                </span>
              </label>
              <Field
                label="Mot de passe administrateur"
                placeholder="Au moins 8 caractères"
                value={password}
                onChange={setPassword}
                type="password"
                testId="input-company-password"
              />
              <Field
                label="Confirmer le mot de passe"
                placeholder="Répétez le mot de passe"
                value={passwordConfirm}
                onChange={setPasswordConfirm}
                type="password"
                testId="input-company-password-confirm"
              />
            </div>
            {password && passwordConfirm && password !== passwordConfirm && (
              <p className="mt-4 text-xs font-semibold text-[hsl(var(--destructive))]">
                Les mots de passe ne correspondent pas.
              </p>
            )}
            <p className="mt-4 rounded-lg bg-[hsl(var(--muted))] p-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              Ce mot de passe servira à l’administrateur de l’entreprise après validation de votre demande.
            </p>
              {sector && moduleError && (
                <p role="alert" className="mt-4 rounded-lg bg-[hsl(var(--destructive)/.08)] px-3 py-2 text-xs font-semibold text-[hsl(var(--destructive))]">
                  {moduleError}
                </p>
              )}
              {submitError && (
                <p role="alert" className="mt-4 rounded-lg bg-[hsl(var(--destructive)/.08)] px-3 py-2 text-xs font-semibold text-[hsl(var(--destructive))]">
                  {submitError}
                </p>
              )}
            <button
              type="submit"
                disabled={!name || !manager || !email || password.length < 8 || password !== passwordConfirm || submitting}
              data-testid="button-next-signup"
              className="btn mt-8 flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-40"
            >
                {sector ? (submitting ? 'Envoi…' : 'Envoyer la demande') : 'Continuer'}
                {sector ? <Check size={16} /> : <ChevronRight size={16} />}
            </button>
          </form>
        ) : (
          <div className="card-surface rounded-2xl p-5 sm:p-8">
            <section className="border-b border-[hsl(var(--border))] pb-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">
                    Étape 2 sur 2
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-.03em]">Choisissez vos modules</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                    Activez uniquement les espaces utiles à votre entreprise. Vous pourrez ajuster les détails
                    après l’activation de votre compte.
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-[hsl(var(--primary)/.1)] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]">
                  <Check size={14} />
                  {selectedModules.length} module{selectedModules.length > 1 ? 's' : ''} activé{selectedModules.length > 1 ? 's' : ''}
                </span>
              </div>
            </section>

            <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Résumé de la sélection">
              {[
                { label: 'Modules activés', value: selectedModules.length, detail: 'espaces de travail' },
                { label: 'Packs sélectionnés', value: selectedPackCount, detail: 'configurations prêtes à l’emploi' },
                { label: 'Fonctionnalités', value: selectedFeatureCount, detail: 'droits inclus au démarrage' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.28)] px-4 py-3">
                  <p className="mono text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{item.label}</p>
                  <p className="mt-1 text-xl font-bold">{item.value}</p>
                  <p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{item.detail}</p>
                </div>
              ))}
            </section>

            <section className="mt-6 rounded-xl border border-[hsl(var(--accent)/.3)] bg-[hsl(var(--accent)/.06)] p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--accent)/.15)] text-[hsl(var(--accent))]">
                  <Sparkles size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--accent))]">
                    {sector ? `Suggestion pour le secteur ${sector}` : 'Configuration manuelle'}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-[hsl(var(--muted-foreground))]">
                    {selectedPreset
                      ? 'Les packs ci-dessous ont été préparés pour ce secteur. Vous pouvez les retirer ou les compléter.'
                      : 'Une sélection de départ est affichée. Choisissez les modules et les packs adaptés à votre activité.'}
                  </p>
                  {selectedPreset?.modulePackIds && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(selectedPreset.modulePackIds).flatMap(([moduleId, packIds]) =>
                        (packIds ?? []).map((packId) => (
                          <span
                            key={`${moduleId}-${packId}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--card))] px-2.5 py-1 text-[11px] font-semibold"
                          >
                            <Check size={12} className="text-[hsl(var(--primary))]" />
                            {configuredModule(moduleId as ModuleId)?.featurePacks?.find((pack) => pack.id === packId)?.name ?? packId}
                          </span>
                        )),
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {moduleError && (
              <p
                data-testid="signup-module-error"
                className="mt-5 rounded-lg bg-[hsl(var(--destructive)/.08)] px-3 py-2 text-xs font-semibold text-[hsl(var(--destructive))]"
              >
                {moduleError}
              </p>
            )}
            <div className="mt-6 space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">Modules disponibles</h3>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    Cliquez sur un module pour l’activer ou afficher sa configuration.
                  </p>
                </div>
                <span className="mono text-[10px] text-[hsl(var(--muted-foreground))]">{modules.length} au total</span>
              </div>
              {orderedModules.map((baseModule) => {
                const mod = configuredModule(baseModule.id) ?? baseModule;
                const enabled = selectedModules.includes(mod.id);
                const featureOptions = getModuleFeatureOptions(mod);
                const selectedFeatureIds = getEffectiveModuleFeatureIds(mod, selectedModuleFeatures[mod.id] ?? []);
                const selectableFeatureIds = new Set(normalizeFeatureIdsForSelectedPacks(
                  mod, featureOptions.map(feature => feature.id), selectedModulePackIds[mod.id] ?? [],
                ));
                const ModuleIcon = moduleIconById[mod.id];
                return (
                  <div
                    key={mod.id}
                    className={`overflow-hidden rounded-xl border transition ${enabled ? 'border-[hsl(var(--primary)/.45)] bg-[hsl(var(--primary)/.035)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card)/.35)]'}`}
                  >
                    <button
                      type="button"
                      data-testid={`button-module-${mod.id}`}
                      onClick={() => toggle(mod.id)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${enabled ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}
                      >
                        {ModuleIcon ? <ModuleIcon size={17} /> : <LayoutGrid size={17} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm">{mod.name}</strong>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${enabled ? 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>
                            {enabled ? 'Activé' : 'Disponible'}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                          {mod.description}
                        </span>
                      </span>
                      <ChevronDown
                        size={16}
                        className={`mt-1 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${enabled ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {enabled && (
                      <div className="border-t border-[hsl(var(--primary)/.16)] px-4 pb-4 pt-4">
                        {getModulePackError(mod, selectedModulePackIds[mod.id] ?? []) && (
                          <p role="alert" className="mb-3 text-xs text-[hsl(var(--destructive))]">
                            {getModulePackError(mod, selectedModulePackIds[mod.id] ?? [])}
                            <button type="button" data-testid={`button-signup-clear-stale-packs-${mod.id}`} className="ml-2 underline" onClick={() => {
                              setSelectedModulePackIds(current => ({ ...current, [mod.id]: [] }));
                              setSelectedModuleFeatures(current => ({ ...current, [mod.id]: [] }));
                              setSelectedModulePermissions(current => ({ ...current, [mod.id]: {} }));
                              setModuleError('');
                            }}>Retirer les packs</button>
                          </p>
                        )}
                        {(mod.featurePacks?.length ?? 0) > 0 && (
                          <div className="mb-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold">Packs disponibles — facultatifs</p>
                                <button type="button" data-testid={`button-signup-no-pack-${mod.id}`} className="mt-1 text-xs underline" onClick={() => {
                                  setSelectedModulePackIds(current => ({ ...current, [mod.id]: [] }));
                                  setSelectedModuleFeatures(current => ({ ...current, [mod.id]: [] }));
                                  setSelectedModulePermissions(current => ({ ...current, [mod.id]: {} }));
                                  setModuleError('');
                                }}>Choisir sans pack</button>
                                <p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">Un pack active plusieurs fonctionnalités en une fois. Sans pack, choisissez vos fonctionnalités ci-dessous.</p>
                              </div>
                              <span className="mono shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
                                {selectedModulePackIds[mod.id]?.length ?? 0}/{mod.featurePacks?.length ?? 0}
                              </span>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {mod.featurePacks?.map((pack) => {
                                const selected = selectedModulePackIds[mod.id]?.includes(pack.id) ?? false;
                                return (
                                  <label
                                    key={pack.id}
                                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition ${selected ? 'border-[hsl(var(--primary)/.45)] bg-[hsl(var(--primary)/.08)]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--card))]'}`}
                                  >
                                    <input
                                      data-testid={`checkbox-signup-pack-${mod.id}-${pack.id}`}
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => togglePack(mod.id, pack.id)}
                                      className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                                    />
                                    <span className="min-w-0">
                                      <strong className="block text-xs">{pack.name}</strong>
                                      <span className="mt-1 block text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
                                        {pack.description ?? `${pack.featureIds.length} fonctionnalité(s) incluses`}
                                      </span>
                                      <span className="mt-1.5 block text-[10px] font-semibold text-[hsl(var(--primary))]">
                                        {pack.featureIds.length} fonctionnalité{pack.featureIds.length > 1 ? 's' : ''} incluse{pack.featureIds.length > 1 ? 's' : ''}
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {(
                          <div className="rounded-lg bg-[hsl(var(--muted)/.38)] p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold">Fonctionnalités à activer</p>
                                <p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">Affinez le contenu de ce module si nécessaire.</p>
                              </div>
                              <span className="mono shrink-0 rounded-full bg-[hsl(var(--card))] px-2 py-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                                {selectedFeatureIds.size}/{featureOptions.length}
                              </span>
                            </div>
                            <div className="grid gap-1 sm:grid-cols-2">
                              {featureOptions.filter(feature => selectableFeatureIds.has(feature.id)).map((feature) => {
                                const included = selectedFeatureIds.has(feature.id);
                                return (
                                  <label
                                    key={feature.id}
                                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-xs transition hover:bg-[hsl(var(--card)/.8)]"
                                  >
                                    <input
                                      data-testid={`checkbox-signup-feature-${mod.id}-${feature.id}`}
                                      type="checkbox"
                                      checked={included}
                                      onChange={() => toggleFeature(mod.id, feature.id)}
                                      className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                                    />
                                    <span className={included ? 'font-semibold' : 'text-[hsl(var(--muted-foreground))]'}>{feature.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-8 flex gap-3">
              <button
                data-testid="button-back-signup"
                onClick={() => setStep(1)}
                className="rounded-lg border px-5 py-3 text-sm font-bold"
              >
                Retour
              </button>
               {submitError && (
                 <p role="alert" className="mb-4 rounded-lg bg-[hsl(var(--destructive)/.08)] px-3 py-2 text-xs font-semibold text-[hsl(var(--destructive))]">
                   {submitError}
                 </p>
               )}
               <button
                  disabled={selectedModules.length === 0 || submitting}
                data-testid="button-submit-signup"
                  onClick={() => void submitSignupRequest()}
                 aria-busy={submitting}
                className="btn flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"
              >
                 {submitting ? 'Enregistrement…' : 'Envoyer la demande'} <Check size={16} />
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function PublicRegistrationClosed({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[hsl(var(--background))]">
      <header className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[hsl(var(--foreground))] text-[hsl(var(--background))]">
            <Building2 size={18} />
          </div>
          <span className="font-bold tracking-tight">MAXIMUS</span>
        </div>
        <span className="text-sm text-[hsl(var(--muted-foreground))]">Inscription</span>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <section className="card-surface w-full max-w-lg rounded-2xl border p-8 text-center sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
            <LockKeyhole size={26} />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Les inscriptions sont momentanément fermées</h1>
          <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            L’administration MAXIMUS n’accepte pas de nouvelles demandes pour le moment. Réessayez ultérieurement.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-7 rounded-lg bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"
          >
            Retour à la connexion
          </button>
        </section>
      </main>
    </div>
  );
}

function OrganizationAdminPage({
  data,
  mutate,
  onNavigate,
}: {
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
  onNavigate: (path: string) => void;
}) {
  const [companyId, setCompanyId] = useState(
    data.companies.find((company) => company.status === 'ACTIF')?.id ?? data.companies[0]?.id ?? '',
  );
  const company = data.companies.find((item) => item.id === companyId);
  if (!company)
    return (
      <EmptyState
        title="Entreprise introuvable"
        text="Créez ou activez d’abord une entreprise."
        action={() => onNavigate('/maximus/entreprises')}
      />
    );
  return (
    <div className="space-y-5">
      <label className="card-surface block rounded-xl p-4 text-sm font-semibold">
        Entreprise administrée
        <select
          data-testid="select-organization-company"
          value={companyId}
          onChange={(event) => setCompanyId(event.target.value)}
          className="mt-2 w-full rounded-lg border bg-[hsl(var(--card))] px-3 py-3 text-sm"
        >
          {data.companies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.status}
            </option>
          ))}
        </select>
      </label>
      <CompanyOrganizationAdmin company={company} data={data} mutate={mutate} />
    </div>
  );
}
function CompanyProfilePage({
  company,
  data,
  mutate,
}: {
  company: Company;
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
}) {
  type ProfileForm = Pick<Company, 'name' | 'manager' | 'email' | 'phone' | 'country' | 'sector'>;
  const [form, setForm] = useState<ProfileForm>({
    name: company.name,
    manager: company.manager,
    email: company.email,
    phone: company.phone,
    country: company.country,
    sector: company.sector,
  });
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const setField = (field: keyof ProfileForm) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    setForm({
      name: company.name,
      manager: company.manager,
      email: company.email,
      phone: company.phone,
      country: company.country,
      sector: company.sector,
    });
    setNewPassword('');
    setPasswordConfirm('');
    setError('');
  }, [company.id, company.name, company.manager, company.email, company.phone, company.country, company.sector]);

  const save = async () => {
    const name = form.name.trim();
    const manager = form.manager.trim();
    const email = form.email.trim().toLowerCase();
    const password = newPassword.trim();
    if (!name || !manager || !email) {
      setError('Le nom de l’entreprise, le responsable et l’email sont obligatoires.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Saisissez une adresse email valide.');
      return;
    }
    if (data.companies.some((item) => item.id !== company.id && item.email.toLowerCase() === email)) {
      setError('Une autre entreprise utilise déjà cette adresse email.');
      return;
    }
    if (password && password.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    try {
      if (password) await authApi.updateCompanyPassword(company.id, password);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Le mot de passe n’a pas pu être mis à jour.');
      return;
    }
    mutate(
      (draft) => {
        const target = draft.companies.find((item) => item.id === company.id);
        if (target) {
          target.name = name;
          target.manager = manager;
          target.email = email;
          target.phone = form.phone.trim();
          target.country = form.country.trim();
          target.sector = form.sector.trim();
        }
      },
      password ? 'Profil et mot de passe mis à jour.' : 'Profil entreprise mis à jour.',
    );
    setNewPassword('');
    setPasswordConfirm('');
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <section className="card-surface rounded-2xl p-6">
        <div className="mb-7">
          <p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Profil entreprise</p>
          <h2 className="mt-2 text-2xl font-bold">{company.name}</h2>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Ces informations sont utilisées dans votre espace et lors de votre connexion.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Nom de l’entreprise *"
            value={form.name}
            onChange={setField('name')}
            testId="input-profile-company-name"
          />
          <Field
            label="Responsable *"
            value={form.manager}
            onChange={setField('manager')}
            testId="input-profile-manager"
          />
          <Field
            label="Email administrateur *"
            value={form.email}
            onChange={setField('email')}
            type="email"
            testId="input-profile-email"
          />
          <Field label="Téléphone" value={form.phone} onChange={setField('phone')} testId="input-profile-phone" />
          <Field label="Pays" value={form.country} onChange={setField('country')} testId="input-profile-country" />
          <Field label="Secteur" value={form.sector} onChange={setField('sector')} testId="input-profile-sector" />
        </div>
        <div className="mt-7 border-t pt-6">
          <h3 className="font-bold">Modifier le mot de passe</h3>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Laissez ces champs vides pour conserver le mot de passe actuel.
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field
              label="Nouveau mot de passe"
              value={newPassword}
              onChange={setNewPassword}
              type="password"
              placeholder="Au moins 8 caractères"
              testId="input-profile-password"
            />
            <Field
              label="Confirmer le mot de passe"
              value={passwordConfirm}
              onChange={setPasswordConfirm}
              type="password"
              placeholder="Répétez le mot de passe"
              testId="input-profile-password-confirm"
            />
          </div>
        </div>
        {error && (
          <p
            data-testid="profile-error"
            className="mt-5 rounded-lg bg-[hsl(var(--destructive)/.08)] px-3 py-2 text-xs font-semibold text-[hsl(var(--destructive))]"
          >
            {error}
          </p>
        )}
        <div className="mt-7 flex justify-end">
          <button
            data-testid="button-save-profile"
            onClick={save}
            className="btn rounded-lg bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"
          >
            Enregistrer le profil
          </button>
        </div>
      </section>
      <section className="card-surface h-fit rounded-2xl p-6">
        <h2 className="font-bold">Accès de votre espace</h2>
        <div className="mt-5 space-y-4 text-sm">
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Statut</p>
            <p className="mt-1 font-bold">{company.status}</p>
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Connexion</p>
            <p className="mt-1 leading-6">
              Utilisez l’email administrateur et votre mot de passe depuis « Espace entreprise ».
            </p>
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Modules autorisés</p>
            <p className="mt-1 font-bold">{company.allowedModules.length} module(s)</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function CompanyEditModal({
  company,
  data,
  mutate,
  onClose,
}: {
  company: Company;
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
  onClose: () => void;
}) {
  type CompanyForm = Pick<Company, 'name' | 'manager' | 'email' | 'phone' | 'country' | 'sector'>;
  const [form, setForm] = useState<CompanyForm>({
    name: company.name,
    manager: company.manager,
    email: company.email,
    phone: company.phone,
    country: company.country,
    sector: company.sector,
  });
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const setField = (field: keyof CompanyForm) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  const save = async () => {
    const name = form.name.trim();
    const manager = form.manager.trim();
    const email = form.email.trim().toLowerCase();
    const nextPassword = password.trim();
    if (!name || !manager || !email) {
      setError('Le nom de l’entreprise, le responsable et l’email sont obligatoires.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Saisissez une adresse email valide.');
      return;
    }
    if (data.companies.some((item) => item.id !== company.id && item.email.toLowerCase() === email)) {
      setError('Une autre entreprise utilise déjà cette adresse email.');
      return;
    }
    if (nextPassword && nextPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (nextPassword !== passwordConfirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    try {
      await companyRequestApi.update(company.id, {
        name,
        manager,
        email,
        phone: form.phone.trim(),
        country: form.country.trim(),
        sector: form.sector.trim(),
      });
      if (nextPassword) await authApi.updateCompanyPassword(company.id, nextPassword);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Le mot de passe n’a pas pu être mis à jour.');
      return;
    }
    mutate(
      (draft) => {
        const target = draft.companies.find((item) => item.id === company.id);
        if (target) {
          Object.assign(target, {
            ...form,
            name,
            manager,
            email,
            phone: form.phone.trim(),
            country: form.country.trim(),
            sector: form.sector.trim(),
          });
        }
      },
      nextPassword ? 'Entreprise et mot de passe mis à jour.' : 'Entreprise mise à jour.',
    );
    onClose();
  };
  return (
    <Modal title={`Modifier ${company.name}`} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nom de l’entreprise *"
          value={form.name}
          onChange={setField('name')}
          testId="input-edit-company-name"
        />
        <Field
          label="Responsable *"
          value={form.manager}
          onChange={setField('manager')}
          testId="input-edit-company-manager"
        />
        <Field
          label="Email administrateur *"
          value={form.email}
          onChange={setField('email')}
          type="email"
          testId="input-edit-company-email"
        />
        <Field label="Téléphone" value={form.phone} onChange={setField('phone')} testId="input-edit-company-phone" />
        <Field label="Pays" value={form.country} onChange={setField('country')} testId="input-edit-company-country" />
        <Field label="Secteur" value={form.sector} onChange={setField('sector')} testId="input-edit-company-sector" />
        <Field
          label="Nouveau mot de passe"
          value={password}
          onChange={setPassword}
          type="password"
          placeholder="Laisser vide pour conserver"
          testId="input-edit-company-password"
        />
        <Field
          label="Confirmer le mot de passe"
          value={passwordConfirm}
          onChange={setPasswordConfirm}
          type="password"
          placeholder="Répétez le mot de passe"
          testId="input-edit-company-password-confirm"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-[hsl(var(--destructive)/.08)] px-3 py-2 text-xs font-semibold text-[hsl(var(--destructive))]"
        >
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2.5 text-xs font-bold">
          Annuler
        </button>
        <ActionButton primary testId="button-save-company-edit" onClick={save}>
          Enregistrer les modifications
        </ActionButton>
      </div>
    </Modal>
  );
}

function AdminDashboard({ data, onNavigate }: { data: StoreData; onNavigate: (path: string) => void }) {
  const [pendingRequests, setPendingRequests] = useState<number | null>(null);
  const refreshPendingRequests = async () => {
    try {
      const result = await companyRequestApi.list();
      setPendingRequests(result.requests.length);
    } catch {
      setPendingRequests(null);
    }
  };
  useEffect(() => {
    void refreshPendingRequests();
  }, []);
  useAutoRefresh(refreshPendingRequests);
  const pending = pendingRequests ?? data.companies.filter((c) => c.status === 'EN ATTENTE').length;
  const activeCompanies = data.companies.filter((c) => c.status === 'ACTIF');
  const catalogModules = getConfiguredModules(data);
  const activatedModuleIds = new Set(activeCompanies.flatMap((company) => company.allowedModules));
  return (
    <div className="dashboard-page flex flex-col gap-3 sm:gap-6">
      <DashboardHero
        eyebrow="Centre de contrôle"
        title="Vue d’ensemble des espaces clients"
        description="Consultez les demandes, ajustez les modules autorisés et gardez une trace de chaque décision."
        actions={
          <>
            <Button type="button" data-testid="button-dashboard-requests" onClick={() => onNavigate('/maximus/demandes')} className="gap-2">
              <FileClock size={15} aria-hidden="true" />
              Traiter les demandes
            </Button>
            <Button type="button" variant="outline" data-testid="button-dashboard-companies" onClick={() => onNavigate('/maximus/entreprises')} className="gap-2">
              <Building2 size={15} aria-hidden="true" />
              Entreprises
            </Button>
          </>
        }
      />
      <div className="mobile-stat-grid grid gap-4 md:grid-cols-3">
        <Metric
          label="Entreprises actives"
          value={String(activeCompanies.length)}
          detail={`${data.companies.length} espace(s) au total`}
          icon={Building2}
          accent
        />
        <Metric
          label="Demandes à traiter"
          value={String(pending).padStart(2, '0')}
          detail={pending ? 'requiert votre attention' : 'aucune demande en attente'}
          icon={FileClock}
          warning={pending > 0}
        />
        <Metric
          label="Modules activés"
          value={String(activatedModuleIds.size).padStart(2, '0')}
          detail={`sur ${catalogModules.length} au catalogue`}
          icon={LayoutGrid}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,.75fr)]">
        <DashboardPanel
          eyebrow="Traçabilité"
          title="Activité récente"
          icon={History}
          flush
          action={{ label: 'Voir le journal', onClick: () => onNavigate('/maximus/journal'), testId: 'button-see-journal' }}
        >
          {data.activities.length ? (
            <div className="divide-y">
              {data.activities.slice(0, 5).map((a, i) => (
                <ActivityRow key={a.id} activity={a} delay={i} />
              ))}
            </div>
          ) : (
            <div className="p-5"><PanelEmpty icon={History} title="Aucune activité récente" /></div>
          )}
        </DashboardPanel>
        <DashboardPanel
          eyebrow="Espaces"
          title="État des entreprises"
          icon={Building2}
          action={{ label: 'Tout voir', onClick: () => onNavigate('/maximus/entreprises'), testId: 'button-see-companies' }}
        >
          {data.companies.length ? (
            <ul className="space-y-1">
              {data.companies.slice(0, 8).map((c) => (
                <li data-testid={`row-company-status-${c.id}`} key={c.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-[hsl(var(--muted)/.5)]">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary)/.1)] text-xs font-black text-[hsl(var(--primary))]">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{c.name}</p>
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{c.allowedModules.length} module(s) actif(s)</p>
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          ) : (
            <PanelEmpty icon={Building2} title="Aucune entreprise" text="Les espaces clients apparaîtront ici après validation." />
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}
function RoleAwareCompanyDashboard({
  data,
  onNavigate,
  allowed,
  companyId,
  hiddenWorkspaceFeatures,
}: {
  data: StoreData;
  onNavigate: (path: string) => void;
  allowed: ModuleId[];
  companyId: string;
  hiddenWorkspaceFeatures?: CompanyWorkspaceFeatureId[];
}) {
  const inCompany = <T extends { companyId?: string }>(item: T) => !item.companyId || item.companyId === companyId;
  const canCommerce = allowed.includes('commerce') || allowed.includes('ventes');
  const canStocks = allowed.includes('stocks');
  const canFinance = allowed.includes('finance') || allowed.includes('comptabilite');
  const canTeam = allowed.some((moduleId) => ['rh', 'presences', 'paie'].includes(moduleId));
  const canPurchases = allowed.includes('achats');
  const canReports = allowed.includes('rapports');
  const canControl = !hiddenWorkspaceFeatures?.includes('controle');
  const commercePath = allowed.includes('commerce') ? '/entreprise/commerce' : '/entreprise/ventes';
  const financePath = allowed.includes('finance') ? '/entreprise/finance' : '/entreprise/comptabilite';
  const teamPath = allowed.includes('presences')
    ? '/entreprise/presences'
    : allowed.includes('paie')
      ? '/entreprise/paie'
      : '/entreprise/rh';

  const sales = data.sales.filter(inCompany);
  const products = data.products.filter(inCompany);
  const employees = data.employees.filter(inCompany);
  const purchaseOrders = data.purchaseOrders.filter(inCompany);
  const controlTasks = data.controlTasks.filter(inCompany);
  const activities = data.activities.filter(inCompany);
  const validSales = sales.filter((sale) => sale.status === 'VALIDÉ');
  const revenue = validSales.reduce((sum, sale) => sum + sale.amount, 0);
  const lowStockProducts = products.filter((product) => product.stock <= product.threshold);
  const activeEmployees = employees.filter((employee) => employee.status === 'ACTIF');
  const pendingPurchases = purchaseOrders.filter((purchase) => !['VALIDÉ', 'CONFIRMÉ'].includes(purchase.status));
  const pendingTasks = controlTasks.filter((task) => !['VALIDÉ', 'TERMINÉ'].includes(task.status));

  const quickLinks = [
    canCommerce && {
      id: 'commerce',
      path: commercePath,
      label: 'Ventes & clients',
      icon: ShoppingCart,
    },
    canStocks && {
      id: 'stocks',
      path: '/entreprise/stocks',
      label: 'Stock & achats',
      icon: Package,
    },
    canFinance && {
      id: 'finance',
      path: financePath,
      label: 'Finance',
      icon: WalletCards,
    },
    canTeam && {
      id: 'team',
      path: teamPath,
      label: allowed.includes('presences') ? 'Équipe & présences' : allowed.includes('paie') ? 'Paie' : 'Ressources humaines',
      icon: Users,
    },
    allowed.includes('ecommerce') && {
      id: 'ecommerce',
      path: '/entreprise/ecommerce?tab=dashboard',
      label: 'Boutique en ligne',
      icon: Store,
    },
    allowed.includes('transport') && {
      id: 'transport',
      path: '/entreprise/transport',
      label: 'Transport',
      icon: CarFront,
    },
  ].filter(Boolean) as Array<{
    id: string;
    path: string;
    label: string;
    icon: typeof ShoppingCart;
  }>;

  const primaryLink = quickLinks[0];
  const metrics = [
    canCommerce || canFinance ? (
      <Metric
        key="revenue"
        label="Chiffre d’affaires validé"
        value={shortMoney(revenue)}
        suffix=" FCFA"
        detail={`${validSales.length} vente(s) validée(s)`}
        icon={CircleDollarSign}
        accent
      />
    ) : null,
    canCommerce ? (
      <Metric
        key="sales"
        label="Ventes validées"
        value={String(validSales.length)}
        detail="dans les données disponibles"
        icon={ShoppingCart}
      />
    ) : null,
    canStocks ? (
      <Metric
        key="stock"
        label="Produits à surveiller"
        value={String(lowStockProducts.length).padStart(2, '0')}
        detail={lowStockProducts.length ? 'seuil de sécurité atteint' : 'aucune alerte de seuil'}
        icon={Package}
        warning={lowStockProducts.length > 0}
      />
    ) : null,
    canTeam ? (
      <Metric
        key="team"
        label="Équipe active"
        value={String(activeEmployees.length)}
        detail={`${employees.length} compte(s) dans votre périmètre`}
        icon={Users}
      />
    ) : null,
  ].filter(Boolean);

  const signals = [
    canStocks && lowStockProducts.length > 0 && (
      <SignalItem key="stock" tone="warning" testId="button-dashboard-low-stock" icon={Package} onClick={() => onNavigate('/entreprise/stocks')}
        title={`${lowStockProducts.length} produit(s) à réapprovisionner`} text="Le seuil de sécurité est atteint." />
    ),
    canPurchases && pendingPurchases.length > 0 && (
      <SignalItem key="purchases" testId="button-dashboard-pending-purchases" icon={ClipboardCheck} onClick={() => onNavigate('/entreprise/achats')}
        title={`${pendingPurchases.length} achat(s) à suivre`} text="Commandes ou réceptions non finalisées." />
    ),
    canControl && pendingTasks.length > 0 && (
      <SignalItem key="tasks" testId="button-dashboard-pending-tasks" icon={ClipboardCheck} onClick={() => onNavigate('/entreprise/controle')}
        title={`${pendingTasks.length} tâche(s) à traiter`} text="Coordination et décisions de votre périmètre." />
    ),
  ].filter(Boolean);

  return (
    <div className="dashboard-page flex flex-col gap-3 sm:gap-6">
      <DashboardHero
        eyebrow="Pilotage de l’entreprise"
        title="Une vue claire pour décider plus vite."
        description="Les indicateurs et alertes de vos modules autorisés. Les données affichées respectent votre entreprise et votre rôle."
        actions={(primaryLink || canReports) ? (
          <>
            {primaryLink && (
              <Button type="button" data-testid="button-dashboard-primary-action" onClick={() => onNavigate(primaryLink.path)} className="gap-2">
                <primaryLink.icon size={15} aria-hidden="true" />
                Ouvrir {primaryLink.label}
              </Button>
            )}
            {canReports && (
              <Button type="button" variant="outline" data-testid="button-dashboard-reports" onClick={() => onNavigate('/entreprise/rapports')} className="gap-2">
                <FileBarChart size={15} aria-hidden="true" />
                Voir les rapports
              </Button>
            )}
          </>
        ) : undefined}
      />

      {metrics.length ? (
        <div className={`mobile-stat-grid grid gap-4 md:grid-cols-2 ${metrics.length > 2 ? 'xl:grid-cols-4' : 'xl:grid-cols-2'}`}>{metrics}</div>
      ) : (
        <PanelEmpty icon={ShieldCheck} title="Aucun accès opérationnel" text="Votre rôle n’a pas encore reçu de module ou de sous-autorisation." />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DashboardPanel eyebrow="Décisions à prendre" title="Les signaux du jour" icon={Bell}>
          {signals.length ? <div className="space-y-2.5">{signals}</div> : (
            <PanelEmpty icon={Check} title="Tout est en ordre" text="Aucune alerte opérationnelle dans votre périmètre." />
          )}
        </DashboardPanel>
        <DashboardPanel eyebrow="Accès rapides" title="Vos espaces MAXIMUS" icon={Gauge}>
          {quickLinks.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {quickLinks.slice(0, 4).map((link) => (
                <QuickLinkTile key={link.id} testId={`button-dashboard-link-${link.id}`} icon={link.icon} label={link.label} onClick={() => onNavigate(link.path)} />
              ))}
            </div>
          ) : (
            <PanelEmpty icon={LayoutGrid} title="Aucun espace configuré" />
          )}
        </DashboardPanel>
      </div>

      {canCommerce && (
        <DashboardPanel
          eyebrow="Activité commerciale"
          title="Dernières ventes"
          icon={ShoppingCart}
          flush
          action={{ label: 'Tout voir', onClick: () => onNavigate('/entreprise/commerce'), testId: 'button-dashboard-see-sales' }}
        >
          {sales.length ? (
            <>
              <div className="hidden xl:block">
                <DataTable
                  headers={['Référence', 'Client', 'Montant', 'Statut', 'Date']}
                  rows={sales.slice(0, 5).map((sale) => [
                    sale.reference,
                    sale.client,
                    money(sale.amount),
                    <StatusBadge status={sale.status} />,
                    sale.date,
                  ])}
                />
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:hidden">
                {sales.slice(0, 5).map((sale) => (
                  <article key={sale.id} data-testid={`card-dashboard-sale-${sale.id}`} className="rounded-xl border bg-[hsl(var(--muted)/.5)] p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{sale.reference}</p>
                        <p className="mt-1 break-words text-xs text-[hsl(var(--muted-foreground))]">{sale.client}</p>
                      </div>
                      <StatusBadge status={sale.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t pt-3 text-xs">
                      <span className="font-bold">{money(sale.amount)}</span>
                      <span className="text-[hsl(var(--muted-foreground))]">{sale.date}</span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="p-5"><PanelEmpty icon={ShoppingCart} title="Aucune vente enregistrée" text="Les ventes validées apparaîtront ici." /></div>
          )}
        </DashboardPanel>
      )}

      <DashboardPanel
        eyebrow="Traçabilité"
        title="Activité récente"
        icon={History}
        flush
        action={canControl ? { label: 'Voir le contrôle', onClick: () => onNavigate('/entreprise/controle'), testId: 'button-dashboard-see-control' } : undefined}
      >
        {activities.length ? (
          <div className="divide-y">
            {activities.slice(0, 5).map((activity, index) => <ActivityRow key={activity.id} activity={activity} delay={index} />)}
          </div>
        ) : (
          <div className="p-5"><PanelEmpty icon={History} title="Aucune activité récente" /></div>
        )}
      </DashboardPanel>
    </div>
  );
}

function CompaniesPage({
  data,
  mutate,
  onNavigate,
  detail,
}: {
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
  onNavigate: (p: string) => void;
  detail: boolean;
}) {
  const { alert, confirm } = useAppDialog();
  const [search, setSearch] = useState(() => sessionStorage.getItem('maximus-company-search') ?? '');
  const [filter, setFilter] = useState('Toutes');
  const directoryCompanies = getCompanyDirectoryCompanies(data.companies);
  const [selected, setSelected] = useState<Company | null>(
    detail ? (directoryCompanies[0] ?? null) : null,
  );
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [updatingDeletionLock, setUpdatingDeletionLock] = useState<string | null>(null);
  const [updatingDemoMode, setUpdatingDemoMode] = useState<string | null>(null);
  const [connectivityState, setConnectivityState] = useState<{
    status: 'loading' | 'ready' | 'error';
    byCompanyId: Record<string, CompanyConnectivity>;
  }>({ status: 'loading', byCompanyId: {} });
  useEffect(() => {
    let cancelled = false;
    const refreshConnectivity = async () => {
      try {
        const response = await companyRequestApi.connectivity();
        if (cancelled) return;
        setConnectivityState({
          status: 'ready',
          byCompanyId: Object.fromEntries(response.companies.map((company) => [company.companyId, company])),
        });
      } catch {
        if (!cancelled) setConnectivityState((current) => ({ ...current, status: 'error' }));
      }
    };
    void refreshConnectivity();
    const timer = window.setInterval(() => void refreshConnectivity(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  const renderCompanyConnectivity = (company: Company) => {
    if (connectivityState.status === 'loading') {
      return <span className="text-xs text-[hsl(var(--muted-foreground))]">Chargement…</span>;
    }
    if (connectivityState.status === 'error') {
      return <span className="text-xs text-[hsl(var(--muted-foreground))]">Indisponible</span>;
    }
    const presence = connectivityState.byCompanyId[company.id];
    if (presence?.online) {
      return (
        <span className="inline-flex items-center gap-2 text-xs font-semibold">
          <span className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]" aria-hidden="true" />
          {presence.connectionSource === 'installation' ? 'Installation connectée' : 'En ligne'}
        </span>
      );
    }
    const lastActivityAt = presence?.lastSeenAt ?? presence?.lastLoginAt;
    return (
      <span className="text-xs text-[hsl(var(--muted-foreground))]">
        {lastActivityAt
          ? `Vu le ${new Date(lastActivityAt).toLocaleString('fr-FR')}`
          : 'Aucune activité enregistrée'}
      </span>
    );
  };
  const list = directoryCompanies
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .filter(
      (c) =>
        filter === 'Toutes' ||
        (filter === 'Actives' && c.status === 'ACTIF') ||
        (filter === 'En attente' && c.status === 'EN ATTENTE') ||
        (filter === 'Suspendues' && c.status === 'SUSPENDU'),
    );
  const dedicatedCompanies = list.filter((company) => Boolean(company.primaryInstallationId));
  const sharedCompanies = list.filter((company) => !company.primaryInstallationId);
  const deleteCompany = async (company: Company) => {
    if (
      !(await confirm({
        title: 'Supprimer cette entreprise ?',
        description: `L’entreprise « ${company.name} » et ses données d’organisation seront supprimées. Cette action est irréversible.`,
        confirmLabel: 'Supprimer',
        tone: 'danger',
      }))
    )
      return;
    try {
      await companyRequestApi.remove(company.id);
      mutate((draft) => {
        draft.companies = draft.companies.filter((item) => item.id !== company.id);
        draft.employees = draft.employees.filter((item) => item.companyId !== company.id);
        draft.roles = draft.roles.filter((item) => item.companyId !== company.id);
        draft.orgNodes = draft.orgNodes.filter((item) => item.companyId !== company.id);
      }, 'Entreprise archivée et accès révoqués.');
    } catch (error) {
      await alert({
        title: 'Suppression impossible',
        description: error instanceof Error ? error.message : 'L’entreprise n’a pas pu être archivée.',
        confirmLabel: 'Compris',
        tone: 'danger',
      });
    }
  };
  const toggleDeletionLock = async (company: Company) => {
    setUpdatingDeletionLock(company.id);
    try {
      const response = await companyRequestApi.updateDeletionLock(company.id, company.deletionLocked === false);
      mutate((draft) => {
        const item = draft.companies.find((candidate) => candidate.id === company.id);
        if (item) item.deletionLocked = response.company.deletionLocked;
      }, response.company.deletionLocked ? 'Suppression verrouillée.' : 'Suppression déverrouillée.');
    } catch (error) {
      await alert({
        title: 'Modification impossible',
        description: error instanceof Error ? error.message : 'Le verrou de suppression n’a pas pu être modifié.',
        confirmLabel: 'Compris',
        tone: 'danger',
      });
    } finally {
      setUpdatingDeletionLock(null);
    }
  };
  const toggleDemoMode = async (company: Company) => {
    const enabling = company.demoMode !== true;
    if (!(await confirm({
      title: enabling ? 'Activer le mode Démonstration ?' : 'Désactiver le mode Démonstration ?',
      description: enabling
        ? 'Les utilisateurs verront des données fictives modifiables. Les données réelles resteront intactes et les paiements et virements réels seront bloqués.'
        : 'Les données réelles de cette entreprise seront réaffichées. Les données de démonstration resteront conservées pour une prochaine activation.',
      confirmLabel: enabling ? 'Activer le mode' : 'Désactiver le mode',
    }))) return;

    setUpdatingDemoMode(company.id);
    try {
      const response = await companyRequestApi.updateDemoMode(company.id, enabling);
      mutate((draft) => {
        const item = draft.companies.find((candidate) => candidate.id === company.id);
        if (item) item.demoMode = response.enabled;
      }, response.enabled ? 'Mode Démonstration activé.' : 'Mode Démonstration désactivé.');
    } catch (error) {
      await alert({
        title: 'Changement de mode impossible',
        description: error instanceof Error ? error.message : 'Le mode Démonstration n’a pas pu être modifié.',
        confirmLabel: 'Compris',
        tone: 'danger',
      });
    } finally {
      setUpdatingDemoMode(null);
    }
  };
  if (selected)
    return (
      <CompanyDetail
        company={data.companies.find((c) => c.id === selected.id) ?? selected}
        mutate={mutate}
        onBack={() => {
          setSelected(null);
          onNavigate('/maximus/entreprises');
        }}
      />
    );
  const renderCompanyTable = (title: string, companies: Company[]) => companies.length > 0 ? (
    <div className="overflow-hidden rounded-2xl border">
      <div className="border-b bg-[hsl(var(--muted)/.35)] px-5 py-3">
        <h3 className="font-bold">{title}</h3>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {title.startsWith('Installations dédiées')
            ? 'Ces entreprises utilisent leur propre accès ERP principal. Le lien central reste réservé à une restauration explicite.'
            : 'Ces entreprises utilisent actuellement l’accès ERP mutualisé MAXIMUS.'}
        </p>
      </div>
      <DataTable
        headers={['Entreprise', 'Responsable', 'Pays', 'Modules', 'Statut', 'Connexion', 'Actions']}
        rows={companies.map((c) => [
          <button
            data-testid={`button-open-company-${c.id}`}
            aria-label={`Ouvrir ${c.name}`}
            onClick={() => {
              setSelected(c);
              onNavigate(`/maximus/entreprises/${encodeURIComponent(c.id)}`);
            }}
            className="flex items-center gap-3 text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary)/.1)] text-[10px] font-black text-[hsl(var(--primary))]">
              {c.name.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong className="block">{c.name}</strong>
              <small className="text-xs text-[hsl(var(--muted-foreground))]">{c.email}</small>
            </span>
          </button>,
          c.manager,
          c.country,
          `${c.allowedModules.length} / ${c.requestedModules.length}`,
          <StatusBadge status={c.status} />,
          renderCompanyConnectivity(c),
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid={`button-open-company-installation-${c.id}`}
              aria-label={`Ouvrir l’installation de ${c.name}`}
              title={`Installation de ${c.name}`}
              onClick={(event) => {
                event.stopPropagation();
                setSelected(c);
                onNavigate(`/maximus/entreprises/${encodeURIComponent(c.id)}`);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--primary)/.35)] px-2.5 py-2 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.08)]"
            >
              <KeyRound size={14} />
              <span>Installation</span>
            </button>
            <button
              type="button"
              data-testid={`button-edit-company-${c.id}`}
              aria-label={`Modifier ${c.name}`}
              title={`Modifier ${c.name}`}
              onClick={(event) => {
                event.stopPropagation();
                setEditingCompany(c);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold hover:bg-[hsl(var(--muted))]"
            >
              <Edit3 size={14} />
              <span>Modifier</span>
            </button>
            <button
              type="button"
              data-testid={`button-toggle-company-deletion-lock-${c.id}`}
              aria-label={`${c.deletionLocked !== false ? 'Déverrouiller' : 'Verrouiller'} la suppression de ${c.name}`}
              title={`${c.deletionLocked !== false ? 'Déverrouiller' : 'Verrouiller'} la suppression de ${c.name}`}
              disabled={updatingDeletionLock === c.id}
              onClick={(event) => {
                event.stopPropagation();
                void toggleDeletionLock(c);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold hover:bg-[hsl(var(--muted))] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <LockKeyhole size={14} />
              <span>{c.deletionLocked !== false ? 'Déverrouiller' : 'Verrouiller'}</span>
            </button>
            <label
              className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-bold"
              title={c.primaryInstallationId
                ? 'Le mode Démonstration se gère depuis l’installation dédiée de cette entreprise.'
                : 'Afficher des données de démonstration isolées pour cette entreprise.'}
              onClick={(event) => event.stopPropagation()}
            >
              <Switch
                checked={c.demoMode === true}
                disabled={Boolean(c.primaryInstallationId) || updatingDemoMode === c.id}
                aria-label={`${c.demoMode ? 'Désactiver' : 'Activer'} le mode Démonstration pour ${c.name}`}
                data-testid={`switch-company-demo-mode-${c.id}`}
                onCheckedChange={() => void toggleDemoMode(c)}
              />
              <span>Démonstration</span>
            </label>
            <button
              data-testid={`button-delete-company-${c.id}`}
              aria-label={`Supprimer ${c.name}`}
              title={c.deletionLocked !== false ? `Suppression verrouillée pour ${c.name}` : `Supprimer ${c.name}`}
              disabled={c.deletionLocked !== false}
              onClick={() => deleteCompany(c)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={14} />
              <span>Supprimer</span>
            </button>
          </div>,
        ])}
      />
    </div>
  ) : null;
  return (
    <section className="card-surface overflow-hidden rounded-2xl">
      <div className="border-b p-5">
        <Toolbar
          search={search}
          setSearch={(value) => {
            setSearch(value);
            sessionStorage.setItem('maximus-company-search', value);
          }}
        >
          <ActionButton primary testId="button-add-company" onClick={() => onNavigate('/inscription')}>
            Ajouter une entreprise
          </ActionButton>
        </Toolbar>
        <div className="flex gap-2 overflow-x-auto">
          {['Toutes', 'Actives', 'Suspendues'].map((label) => (
            <FilterChip key={label} label={label} active={filter === label} onClick={() => setFilter(label)} />
          ))}
        </div>
      </div>
      <div className="space-y-5 p-5">
        {renderCompanyTable('Installations dédiées / locales principales', dedicatedCompanies)}
        {renderCompanyTable('Accès mutualisé MAXIMUS', sharedCompanies)}
        {list.length === 0 && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Aucune entreprise ne correspond aux filtres actuels.
          </p>
        )}
      </div>
      {editingCompany && (
        <CompanyEditModal
          company={editingCompany}
          data={data}
          mutate={mutate}
          onClose={() => setEditingCompany(null)}
        />
      )}
    </section>
  );
}
function FilterChip({ label, active = false, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      data-testid={`button-filter-${label.toLowerCase().replace(/\s/g, '-')}`}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'hover:bg-[hsl(var(--muted))]'}`}
    >
      {label}
    </button>
  );
}
function CompanyDetail({
  company,
  mutate,
  onBack,
}: {
  company: Company;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
  onBack: () => void;
}) {
  const { confirm } = useAppDialog();
  const authGate = useAuthorizationGate({
    resetKey: company.id,
    confirm,
    onError: (error) => showAppToast(error instanceof Error ? error.message : 'La modification n’a pas pu être enregistrée.', 'error'),
  });
  const usesDedicatedPrimary = Boolean(company.primaryInstallationId);
  const [active, setActive] = useState(company.allowedModules);
  const [installationBusy, setInstallationBusy] = useState(false);
  const [installationEndpoint, setInstallationEndpoint] = useState('');
  const [installationRefreshKey, setInstallationRefreshKey] = useState(0);
  const [loginSettings, setLoginSettings] = useState<{
    customAllowed: boolean;
    mode: 'MAXIMUS' | 'CUSTOM';
    slug: string;
    url: string | null;
  } | null>(null);
  const [loginSaving, setLoginSaving] = useState(false);
  const [customDomains, setCustomDomains] = useState<EcommerceDomain[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [domainLoading, setDomainLoading] = useState(true);
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainOperation, setDomainOperation] = useState<'create' | 'verify' | 'delete' | null>(null);
  const [domainError, setDomainError] = useState('');
  const toggle = (id: ModuleId) =>
    setActive((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  useEffect(() => {
    let cancelled = false;
    void companyRequestApi.loginSettings(company.id)
      .then(({ settings }) => {
        if (!cancelled) setLoginSettings(settings);
      })
      .catch(() => {
        if (!cancelled) setLoginSettings(null);
      });
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  useEffect(() => {
    let cancelled = false;
    setDomainLoading(true);
    setDomainError('');
    void createEcommerceApi(company.id).bootstrap()
      .then(({ domains }) => {
        if (!cancelled) setCustomDomains(Array.isArray(domains) ? domains : []);
      })
      .catch((error) => {
        if (!cancelled) {
          setCustomDomains([]);
          setDomainError(error instanceof Error ? error.message : 'Les domaines personnalisés sont indisponibles.');
        }
      })
      .finally(() => {
        if (!cancelled) setDomainLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  const saveLoginSettings = async (input: { customAllowed?: boolean; mode?: 'MAXIMUS' | 'CUSTOM' }): Promise<boolean> => {
    setLoginSaving(true);
    try {
      const result = await companyRequestApi.updateLoginSettings(company.id, input);
      setLoginSettings(result.settings);
      mutate((draft) => {
        const target = draft.companies.find((item) => item.id === company.id);
        if (target) Object.assign(target, result.company);
      }, input.customAllowed === false ? 'La connexion personnalisée a été désactivée.' : 'Paramètres de connexion enregistrés.');
      return true;
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : 'Les paramètres de connexion n’ont pas pu être enregistrés.', 'error');
      return false;
    } finally {
      setLoginSaving(false);
    }
  };

  const refreshCustomDomains = async () => {
    const { domains } = await createEcommerceApi(company.id).bootstrap();
    setCustomDomains(Array.isArray(domains) ? domains : []);
  };

  const createCustomDomain = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const domain = domainInput.trim();
    if (!domain) return;
    setDomainSaving(true);
    setDomainOperation('create');
    setDomainError('');
    try {
      const created = await createEcommerceApi(company.id).createDomain(domain);
      setCustomDomains((current) => [...current.filter((item) => item.id !== created.id), created]);
      setDomainInput('');
      showAppToast('Domaine ajouté.', 'success');
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Le domaine n’a pas pu être créé.');
    } finally {
      setDomainSaving(false);
      setDomainOperation(null);
    }
  };

  const verifyCustomDomain = async (domain: EcommerceDomain) => {
    setDomainSaving(true);
    setDomainOperation('verify');
    setDomainError('');
    try {
      const verified = await createEcommerceApi(company.id).verifyDomain(domain.id);
      setCustomDomains((current) => current.map((item) => item.id === verified.id ? verified : item));
      showAppToast('Vérification DNS actualisée.', 'success');
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'La vérification DNS a échoué.');
      void refreshCustomDomains().catch(() => undefined);
    } finally {
      setDomainSaving(false);
      setDomainOperation(null);
    }
  };

  const deleteCustomDomain = async (domain: EcommerceDomain) => {
    if (!window.confirm(`Retirer le domaine « ${domain.domain} » ?`)) return;
    setDomainSaving(true);
    setDomainOperation('delete');
    setDomainError('');
    try {
      await createEcommerceApi(company.id).deleteDomain(domain.id);
      setCustomDomains((current) => current.filter((item) => item.id !== domain.id));
      showAppToast('Domaine retiré.', 'success');
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Le domaine n’a pas pu être retiré.');
    } finally {
      setDomainSaving(false);
      setDomainOperation(null);
    }
  };

  const downloadInstallationManifest = async () => {
    try {
      const manifest = await companyRequestApi.installationManifest(company.id);
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `maximus-installation-${company.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : 'Le manifeste d’installation n’a pas pu être exporté.', 'error');
    }
  };

  const prepareInstallation = async (mode: 'dedicated' | 'on_premise') => {
    if (installationBusy) return;
    if (company.status !== 'ACTIF') {
      showAppToast('Activez l’entreprise avant de préparer son installation.', 'error');
      return;
    }
    setInstallationBusy(true);
    try {
      const result = await companyRequestApi.issueInstallation(company.id, {
        mode,
        createNew: true,
        ...(installationEndpoint.trim() ? { endpointUrl: installationEndpoint.trim() } : {}),
      });
      const blob = new Blob([JSON.stringify(result.bootstrap, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `maximus-bootstrap-${company.id}-${mode}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setInstallationRefreshKey((value) => value + 1);
      showAppToast('Fichier d’installation téléchargé. Conservez-le en lieu sûr : il contient un jeton secret.', 'success');
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : 'L’enrôlement de l’installation n’a pas pu être préparé.', 'error');
    } finally {
      setInstallationBusy(false);
    }
  };

  const revokeInstallation = async () => {
    const confirmed = await confirm({
      title: 'Révoquer toutes les installations de cette entreprise ?',
      description: `Tous les jetons de « ${company.name} » seront révoqués. Pour ne révoquer qu’une installation, utilisez son bouton dans « Accès ERP et installations ». Les serveurs déjà démarrés ne seront pas arrêtés.`,
      confirmLabel: 'Révoquer tous les jetons',
      tone: 'danger',
    });
    if (!confirmed) return;
    setInstallationBusy(true);
    try {
      await companyRequestApi.revokeInstallation(company.id);
      setInstallationRefreshKey((value) => value + 1);
      showAppToast('Tous les jetons sont révoqués. Les serveurs en fonctionnement ne sont pas arrêtés.', 'success');
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : 'La révocation a échoué.', 'error');
    } finally {
      setInstallationBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <button
        data-testid="button-back-companies"
        onClick={onBack}
        className="text-xs font-bold text-[hsl(var(--primary))]"
      >
        ← Retour aux entreprises
      </button>
      <div className="card-surface rounded-2xl p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row">
          <div className="flex gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] text-lg font-black text-[hsl(var(--primary-foreground))]">
              {company.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h2 className="text-2xl font-bold">{company.name}</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {company.sector} · {company.country}
              </p>
              <div className="mt-3">
                <StatusBadge status={company.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              testId="button-prepare-dedicated-installation"
              onClick={() => void prepareInstallation('dedicated')}
            >
              Préparer le VPS dédié
            </ActionButton>
            <ActionButton
              testId="button-prepare-on-premise-installation"
              onClick={() => void prepareInstallation('on_premise')}
            >
              Préparer l’installation locale
            </ActionButton>
            <ActionButton
              testId="button-download-installation-manifest"
              onClick={() => void downloadInstallationManifest()}
            >
              Télécharger le manifeste d’installation
            </ActionButton>
            <ActionButton
              testId="button-suspend-company"
              icon={company.status === 'SUSPENDU' ? RefreshCw : ShieldCheck}
              onClick={() =>
                mutate(
                  (d) => {
                    const c = d.companies.find((x) => x.id === company.id);
                    if (c) c.status = c.status === 'SUSPENDU' ? 'ACTIF' : 'SUSPENDU';
                  },
                  company.status === 'SUSPENDU' ? 'Entreprise réactivée.' : 'Entreprise suspendue.',
                )
              }
            >
              {company.status === 'SUSPENDU' ? 'Réactiver' : 'Suspendre'}
            </ActionButton>
          </div>
        </div>
        <div className="mt-8 grid gap-4 border-t pt-5 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Responsable</p>
            <p className="mt-1 font-bold">{company.manager}</p>
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Email</p>
            <p className="mt-1 font-bold">{company.email}</p>
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Demande reçue</p>
            <p className="mt-1 font-bold">{company.createdAt}</p>
          </div>
        </div>
      </div>
      <section className="card-surface rounded-2xl border border-[hsl(var(--primary)/.25)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <KeyRound size={18} className="text-[hsl(var(--primary))]" />
              <p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">
                Réservé à l’administration MAXIMUS
              </p>
            </div>
            <h2 className="mt-2 text-xl font-bold">Installation dédiée ou locale</h2>
            <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              Préparez une installation séparée pour cette entreprise. Les employés utiliseront les comptes
              de cette installation et sa propre page de connexion, pas l’administration MAXIMUS.
              Transférez le fichier d’enrôlement uniquement au responsable du serveur concerné.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[hsl(var(--primary)/.1)] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]">
            Entreprise {company.status === 'ACTIF' ? 'active' : 'à activer'}
          </span>
        </div>
        <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="font-bold">1. Préparer</p>
            <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              Choisissez le type de serveur et téléchargez le bootstrap secret.
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-bold">2. Transférer</p>
            <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              Envoyez le JSON au VPS avec SSH/SCP, jamais dans le code ou une URL publique.
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-bold">3. Installer</p>
            <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              Le script du VPS récupère ensuite les modules, packs et permissions publiés.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <ActionButton
            primary
            testId="button-prepare-dedicated-installation-card"
            onClick={() => void prepareInstallation('dedicated')}
          >
            Préparer le VPS dédié
          </ActionButton>
          <ActionButton
            testId="button-prepare-on-premise-installation-card"
            onClick={() => void prepareInstallation('on_premise')}
          >
            Préparer le serveur local
          </ActionButton>
          <ActionButton
            testId="button-download-installation-manifest-card"
            onClick={() => void downloadInstallationManifest()}
          >
            Télécharger le manifeste
          </ActionButton>
          <button
            type="button"
            data-testid="button-revoke-installation"
            disabled={installationBusy}
            onClick={() => void revokeInstallation()}
            className="inline-flex items-center justify-center rounded-lg border border-[hsl(var(--destructive)/.35)] px-3 py-2 text-xs font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {installationBusy ? 'Opération en cours…' : 'Révoquer tous les jetons'}
          </button>
        </div>
        <label className="mt-5 block max-w-xl text-sm font-semibold">
          Adresse ERP prévue (facultative)
          <input type="url" value={installationEndpoint} onChange={(event) => setInstallationEndpoint(event.target.value)}
            placeholder="https://gestion.entreprise.com" disabled={installationBusy}
            className="mt-2 w-full rounded-xl border bg-[hsl(var(--background))] px-3 py-2.5 font-normal"
          />
          <span className="mt-2 block text-xs font-normal leading-5 text-[hsl(var(--muted-foreground))]">
            Pour le local : http://127.0.0.1:8080 ou l’adresse intranet. Un domaine public doit être vérifié avant activation.
          </span>
        </label>
        <p className="mt-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
          Une entreprise doit être <strong>ACTIF</strong> avant la préparation. La révocation bloque les
          synchronisations futures ; elle ne remplace pas l’arrêt du service web du VPS.
        </p>
      </section>
      <CompanyInstallationAccess
        companyId={company.id}
        companyName={company.name}
        refreshKey={installationRefreshKey}
        loginUrl={usesDedicatedPrimary ? null : loginSettings?.url}
      />
      <section className="card-surface rounded-2xl p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">
              {usesDedicatedPrimary ? 'Accès central historique' : 'Hébergement mutualisé'}
            </p>
            <h2 className="mt-2 font-bold">
              {usesDedicatedPrimary ? 'Connexion centrale réservée à la restauration' : 'Connexion sur MAXIMUS central'}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              {usesDedicatedPrimary
                ? 'Cette entreprise utilise son installation ERP principale. Le lien central n’est pas son accès quotidien et reste conservé uniquement pour une restauration explicite.'
                : 'Ces réglages concernent uniquement l’accès mutualisé. Sur une installation dédiée ou locale, la connexion entreprise est automatique et indépendante de cette autorisation.'}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${loginSettings?.customAllowed ? 'bg-emerald-100 text-emerald-700' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>
            {loginSettings?.customAllowed ? 'Autorisé' : 'Non autorisé'}
          </span>
        </div>
        {!usesDedicatedPrimary && <div className="mt-5"><AuthorizationGate gate={authGate} testId="legacy-login-authorization-gate"><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${loginSettings?.customAllowed ? 'border-emerald-300 bg-emerald-50/60' : 'bg-[hsl(var(--muted)/.4)]'}`}>
          <input
            type="checkbox"
            data-testid="checkbox-company-custom-login"
            checked={Boolean(loginSettings?.customAllowed)}
              disabled={!loginSettings || loginSaving}
            onChange={(event) => {
              const customAllowed = event.target.checked;
               void saveLoginSettings({ customAllowed });
            }}
            className="mt-1"
          />
          <span>
            <strong className="block text-sm">Autoriser la page de connexion personnalisée</strong>
            <span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              Le lien est généré à partir du nom de l’entreprise et reste stable même si son nom est modifié plus tard.
            </span>
          </span>
        </label></AuthorizationGate></div>}
        {!usesDedicatedPrimary && <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block text-sm font-semibold">
            Mode actuellement utilisé
            <select
              data-testid="select-company-login-mode"
              value={loginSettings?.mode ?? 'MAXIMUS'}
              disabled={!loginSettings?.customAllowed || loginSaving}
              onChange={(event) => {
               void saveLoginSettings({ mode: event.target.value as 'MAXIMUS' | 'CUSTOM' });
              }}
              className="mt-2 w-full rounded-lg border bg-[hsl(var(--card))] px-3 py-3 text-sm"
            >
              <option value="MAXIMUS">Connexion MAXIMUS actuelle</option>
              <option value="CUSTOM">Page personnalisée</option>
            </select>
          </label>
          <div className="rounded-xl bg-[hsl(var(--muted)/.55)] p-4">
            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Lien généré</p>
            {loginSettings?.url ? (
              <>
                <p className="mt-2 break-all font-mono text-xs">{window.location.origin}{loginSettings.url}</p>
                <button type="button" onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}${loginSettings.url}`)} className="mt-3 rounded-lg border px-3 py-2 text-xs font-bold">Copier le lien</button>
              </>
            ) : <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Le lien reste masqué tant que la page personnalisée n’est pas activée.</p>}
          </div>
        </div>}
        <div className="mt-6 border-t pt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-bold">Domaines de la boutique e-commerce</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                Ces adresses ouvrent la boutique pour les clients, pas l’ERP des employés. Configurez une adresse distincte dans « Accès ERP et installations » pour la gestion interne.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs font-bold">
              {domainLoading ? 'Chargement…' : `${customDomains.length} domaine${customDomains.length > 1 ? 's' : ''}`}
            </span>
          </div>
          <form onSubmit={createCustomDomain} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 text-sm font-semibold">
              Nom de domaine
              <input
                data-testid="input-company-custom-domain"
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                placeholder="connexion.exemple.sn"
                disabled={domainSaving}
                className="mt-2 w-full rounded-lg border bg-[hsl(var(--card))] px-3 py-3 text-sm font-normal"
              />
            </label>
            <button
              type="submit"
              data-testid="button-create-company-custom-domain"
              disabled={domainSaving || !domainInput.trim()}
              className="rounded-lg bg-[hsl(var(--primary))] px-4 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {domainSaving && domainOperation === 'create' ? 'Enregistrement…' : 'Créer le domaine'}
            </button>
          </form>
          {domainError && (
            <p data-testid="company-custom-domain-error" className="mt-3 rounded-lg bg-[hsl(var(--destructive)/.08)] px-3 py-2 text-xs font-semibold text-[hsl(var(--destructive))]">
              {domainError}
            </p>
          )}
          <div className="mt-4 space-y-3">
            {customDomains.length === 0 && !domainLoading ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-[hsl(var(--muted-foreground))]">
                Aucun domaine personnalisé n’est encore configuré pour cette entreprise.
              </p>
            ) : customDomains.map((domain) => (
              <article key={domain.id} data-testid={`card-company-custom-domain-${domain.id}`} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="break-all">{domain.domain}</strong>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${domain.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {domain.status === 'ACTIVE' ? 'ACTIF' : 'EN ATTENTE DNS'}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[hsl(var(--muted-foreground))] sm:grid-cols-2">
                      <p><span className="font-bold">TXT :</span> {domain.verificationName} → <code className="break-all">{domain.verificationValue}</code></p>
                      <p><span className="font-bold">CNAME :</span> {domain.domain} → <code className="break-all">{domain.targetHost}</code></p>
                    </div>
                    {domain.lastError && <p className="mt-2 text-xs font-semibold text-[hsl(var(--destructive))]">{domain.lastError}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      data-testid={`button-verify-company-custom-domain-${domain.id}`}
                      disabled={domainSaving}
                      onClick={() => void verifyCustomDomain(domain)}
                      className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50"
                    >
                      {domainSaving && domainOperation === 'verify' ? 'Vérification…' : 'Vérifier'}
                    </button>
                    <button
                      type="button"
                      data-testid={`button-delete-company-custom-domain-${domain.id}`}
                      disabled={domainSaving}
                      onClick={() => void deleteCustomDomain(domain)}
                      className="rounded-lg border border-[hsl(var(--destructive)/.35)] px-3 py-2 text-xs font-bold text-[hsl(var(--destructive))] disabled:opacity-50"
                    >
                      {domainSaving && domainOperation === 'delete' ? 'Retrait…' : 'Retirer'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="card-surface rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold">Modules autorisés</h2>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Ajustez le périmètre de l’espace.</p>
          </div>
          <span className="mono text-xs text-[hsl(var(--muted-foreground))]">{active.length} / 5</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {modules.map((m) => (
            <button
              data-testid={`button-toggle-company-module-${m.id}`}
              key={m.id}
              onClick={() => toggle(m.id)}
              className={`flex items-center justify-between rounded-xl border p-4 text-left ${active.includes(m.id) ? 'border-[hsl(var(--primary)/.4)] bg-[hsl(var(--primary)/.05)]' : 'bg-[hsl(var(--muted)/.4)] opacity-65'}`}
            >
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-[hsl(var(--muted))] p-2">
                  <LayoutGrid size={16} />
                </span>
                <div>
                  <strong className="text-sm">{m.name}</strong>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{m.description}</p>
                </div>
              </div>
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border ${active.includes(m.id) ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : ''}`}
              >
                {active.includes(m.id) && <Check size={13} />}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <ActionButton
            primary
            testId="button-save-company-modules"
            onClick={() =>
              mutate((d) => {
                const c = d.companies.find((x) => x.id === company.id);
                if (c) {
                  c.allowedModules = active;
                  c.refusedModules = c.requestedModules.filter((x) => !active.includes(x));
                }
              }, 'Configuration enregistrée.')
            }
          >
            Enregistrer la configuration
          </ActionButton>
        </div>
      </section>
    </div>
  );
}

function RequestsPage({
  data,
  mutate,
  notify,
  onNavigate,
}: {
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
  notify: (message: string) => void;
  onNavigate: (p: string) => void;
}) {
  const [requests, setRequests] = useState<CompanyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCompanyId, setPendingCompanyId] = useState<string | null>(null);
  const refreshRequests = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await companyRequestApi.list();
      setRequests(result.requests);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Les demandes sont indisponibles.');
    } finally {
      if (!silent) setLoading(false);
    }
  };
  useEffect(() => {
    void refreshRequests();
  }, []);
  useAutoRefresh(() => refreshRequests(true));
  const approveRequest = async (company: Company) => {
    setPendingCompanyId(company.id);
    try {
      const result = await companyRequestApi.approve(company.id);
      mutate((d) => {
        const target = d.companies.find((item) => item.id === company.id);
        if (target) {
          Object.assign(target, result.company);
        } else {
          d.companies.push(result.company);
        }
      }, 'Entreprise activée et compte administrateur synchronisé.');
      setRequests((current) => current.filter((item) => item.id !== company.id));
    } catch (error) {
      notify(error instanceof Error ? error.message : 'La synchronisation du compte entreprise a échoué.');
    } finally {
      setPendingCompanyId(null);
    }
  };
  const rejectRequest = async (company: Company) => {
    setPendingCompanyId(company.id);
    try {
      await companyRequestApi.reject(company.id);
      mutate((d) => {
        const target = d.companies.find((item) => item.id === company.id);
        if (target) target.status = 'REFUSÉ';
      });
      setRequests((current) => current.filter((item) => item.id !== company.id));
      notify('Demande refusée.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Le refus de la demande a échoué.');
    } finally {
      setPendingCompanyId(null);
    }
  };
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="card-surface rounded-2xl p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Chargement des demandes…</div>
      ) : requests.length === 0 ? (
        <EmptyState
          title="Aucune demande en attente"
          text="Toutes les demandes ont été traitées."
          action={() => onNavigate('/maximus/entreprises')}
        />
      ) : (
        requests.map((request) => {
          const c = request.company;
          return (
          <section data-testid={`card-request-${c.id}`} key={c.id} className="card-surface rounded-2xl p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
              <div className="flex gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--accent)/.24)] font-black">
                  {c.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <h2 className="font-bold">{c.name}</h2>
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    {c.manager} · {c.email} · {c.country}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {c.requestedModules.map((moduleId) => {
                      const requestedFeatures = c.requestedModuleFeatures?.[moduleId];
                      const module = modules.find((item) => item.id === moduleId);
                      return (
                        <div key={moduleId} className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-[10px]">
                          <strong className="block">{module?.name ?? moduleId}</strong>
                          <span className="text-[hsl(var(--muted-foreground))]">
                            {requestedFeatures === undefined
                              ? 'Fonctionnalités par défaut'
                              : `${requestedFeatures.length} fonctionnalité${requestedFeatures.length > 1 ? 's' : ''} choisie${requestedFeatures.length > 1 ? 's' : ''}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <ActionButton
                  testId={`button-refuse-request-${c.id}`}
                  icon={X}
                  disabled={pendingCompanyId === c.id}
                  onClick={() => void rejectRequest(c)}
                >
                  Refuser
                </ActionButton>
                <ActionButton
                  primary
                  testId={`button-approve-request-${c.id}`}
                  icon={Check}
                  disabled={pendingCompanyId === c.id}
                  onClick={() => void approveRequest(c)}
                >
                  {pendingCompanyId === c.id ? 'Synchronisation…' : 'Autoriser l’espace'}
                </ActionButton>
              </div>
            </div>
          </section>
          );
        })
      )}
    </div>
  );
}
function CatalogWorkflowBar({
  data,
  mutate,
}: {
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
}) {
  const { confirm } = useAppDialog();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const impact = getCatalogImpact(data);
  const validation = validateCatalogDraft(data);
  const hasDraft = Boolean(data.catalogDraft);

  if (!hasDraft) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.04)] px-4 py-3">
        <div className="flex items-center gap-2 text-xs">
          <Check size={15} className="text-[hsl(var(--primary))]" />
          <span>
            Catalogue publié · version <strong>{data.catalogVersion ?? 1}</strong>
          </span>
        </div>
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Toute modification sera d’abord enregistrée en brouillon.
        </span>
      </div>
    );
  }

  const discard = async () => {
    if (
      !(await confirm({
        title: 'Annuler le brouillon du catalogue ?',
        description: 'Toutes les modifications non publiées sur les modules, packs et secteurs seront abandonnées.',
        confirmLabel: 'Annuler le brouillon',
        tone: 'danger',
      }))
    )
      return;
    mutate((draft) => discardCatalogDraft(draft), 'Brouillon du catalogue annulé.');
  };

  const publish = () => {
    if (validation.errors.length > 0) return;
    mutate((draft) => publishCatalogDraft(draft), `Catalogue publié · version ${(data.catalogVersion ?? 1) + 1}.`);
  };

  return (
    <section
      data-testid="catalog-workflow-bar"
      className="rounded-2xl border border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.05)] p-4"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-[hsl(var(--primary)/.14)] p-2 text-[hsl(var(--primary))]">
            <GitBranch size={17} />
          </span>
          <div>
            <p className="text-xs font-bold">Brouillon du catalogue</p>
            <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
              Les changements ne seront proposés aux inscriptions et aux entreprises qu’après publication.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="button-catalog-impact"
            onClick={() => setDetailsOpen((value) => !value)}
            className="rounded-lg border px-3 py-2 text-[10px] font-bold"
          >
            {detailsOpen ? 'Masquer les impacts' : 'Voir les impacts'}
          </button>
          <button type="button" onClick={discard} className="rounded-lg border px-3 py-2 text-[10px] font-bold">
            Annuler
          </button>
          <button
            type="button"
            data-testid="button-publish-catalog"
            disabled={validation.errors.length > 0}
            onClick={publish}
            className="rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-[10px] font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Publier les changements
          </button>
        </div>
      </div>
      {detailsOpen && (
        <div className="mt-4 grid gap-2 border-t border-[hsl(var(--primary)/.15)] pt-4 text-[11px] sm:grid-cols-4">
          <span><strong>{impact.changedModules}</strong> module(s) modifié(s)</span>
          <span><strong>{impact.changedSectors}</strong> secteur(s) modifié(s)</span>
          <span><strong>{impact.affectedCompanies}</strong> entreprise(s) concernée(s)</span>
          <span><strong>{impact.affectedUnits}</strong> unité(s) concernée(s)</span>
        </div>
      )}
      {validation.errors.length > 0 && (
        <div className="mt-3 rounded-lg bg-[hsl(var(--destructive)/.1)] px-3 py-2 text-[11px] font-semibold text-[hsl(var(--destructive))]">
          <p>Publication bloquée : {validation.errors[0]}</p>
          {validation.errors.length > 1 && <p className="mt-1 font-normal">+ {validation.errors.length - 1} autre(s) erreur(s)</p>}
        </div>
      )}
      {validation.errors.length === 0 && validation.warnings.length > 0 && (
        <p className="mt-3 text-[11px] text-[hsl(var(--muted-foreground))]">
          Attention : {validation.warnings[0]}
        </p>
      )}
    </section>
  );
}

function ModulesPage({
  data,
  mutate,
}: {
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {modules.map((m, i) => {
        const active = (data.moduleStatuses?.[m.id] ?? m.status) !== 'INACTIF';
        return (
          <section
            data-testid={`card-module-${m.id}`}
            key={m.id}
            className={`card-surface rounded-2xl p-5 fade-up fade-up-delay-${Math.min(i + 1, 3)}`}
          >
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]">
                <LayoutGrid size={19} />
              </span>
              <StatusBadge status={active ? m.status : 'INACTIF'} />
            </div>
            <h2 className="mt-5 text-lg font-bold">{m.name}</h2>
            <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{m.description}</p>
            <div className="mt-5 space-y-2 border-t pt-4">
              {m.features.map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs">
                  <Check size={14} className="text-[hsl(var(--primary))]" />
                  {f}
                </div>
              ))}
            </div>
            <button
              data-testid={`button-toggle-module-${m.id}`}
              onClick={() =>
                mutate(
                  (draft) => {
                    draft.moduleStatuses = { ...(draft.moduleStatuses ?? {}), [m.id]: active ? 'INACTIF' : m.status };
                  },
                  active ? `${m.name} désactivé.` : `${m.name} activé.`,
                )
              }
              className="mt-5 text-xs font-bold text-[hsl(var(--primary))]"
            >
              {active ? 'Désactiver' : 'Activer'} <ChevronRight className="inline" size={14} />
            </button>
          </section>
        );
      })}
    </div>
  );
}
function SectorPresetsPage({
  data,
  mutate,
  onTestSector,
}: {
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
  onTestSector: (preset: SectorPreset) => void;
}) {
  const { confirm } = useAppDialog();
  const [sectorName, setSectorName] = useState('');
  const [sectorModules, setSectorModules] = useState<ModuleId[]>([]);
  const [sectorPackIds, setSectorPackIds] = useState<Partial<Record<ModuleId, string[]>>>({});
  const [editingSector, setEditingSector] = useState<SectorPreset | null>(null);
  const [sectorError, setSectorError] = useState('');
  const [sectorModalOpen, setSectorModalOpen] = useState(false);
  const catalog = getCatalogSnapshot(data);
  const sectorPresets = catalog.sectorPresets;
  const moduleForSector = (id: ModuleId) => {
    return getConfiguredModules(catalog).find((module) => module.id === id);
  };
  const moduleName = (id: ModuleId) => moduleForSector(id)?.name ?? id;

  const toggleSectorPack = (moduleId: ModuleId, packId: string) => {
    const module = moduleForSector(moduleId);
    if (!module) return;
    setSectorError('');
    setSectorPackIds((current) => {
      const currentIds = current[moduleId] ?? [];
      const nextIds = currentIds.includes(packId) ? currentIds.filter((id) => id !== packId) : [...currentIds, packId];
      const next = { ...current, [moduleId]: nextIds };
      if (nextIds.length === 0) delete next[moduleId];
      return next;
    });
  };

  const toggleSectorModule = (moduleId: ModuleId) => {
    setSectorError('');
    setSectorModules((current) => {
      if (current.includes(moduleId)) {
        setSectorPackIds((packIds) => {
          const next = { ...packIds };
          delete next[moduleId];
          return next;
        });
        return current.filter((id) => id !== moduleId);
      }
      return [...current, moduleId];
    });
  };

  const openSector = (preset?: SectorPreset) => {
    setSectorModalOpen(true);
    setEditingSector(preset ?? null);
    setSectorName(preset?.name ?? '');
    const legacyPackIds = Object.fromEntries(
      (preset?.businessProfiles ?? []).flatMap((profile) => Object.entries(profile.modulePackIds ?? {})),
    ) as Partial<Record<ModuleId, string[]>>;
    const packIds = preset?.modulePackIds ?? legacyPackIds;
    const selectedModuleIds = Object.keys(packIds).length
      ? (Object.keys(packIds) as ModuleId[])
      : preset
        ? [...preset.moduleIds]
        : [];
    setSectorModules(selectedModuleIds);
    setSectorPackIds(
      Object.fromEntries(
        Object.entries(packIds).map(([moduleId, selectedPackIds]) => [moduleId, [...(selectedPackIds ?? [])]]),
      ),
    );
    setSectorError('');
  };

  const buildSectorPreset = (): SectorPreset | null => {
    const normalizedName = sectorName.trim();
    if (!normalizedName) {
      setSectorError('Saisissez le nom du secteur.');
      return null;
    }
    if (
      sectorPresets.some(
        (preset) => preset.id !== editingSector?.id && preset.name.toLowerCase() === normalizedName.toLowerCase(),
      )
    ) {
      setSectorError('Ce secteur existe déjà.');
      return null;
    }
    if (sectorModules.length === 0) {
      setSectorError('Sélectionnez au moins un module.');
      return null;
    }
    const selectedPackEntries = sectorModules.map(
      (moduleId) => [moduleId, sectorPackIds[moduleId] ?? []] as [ModuleId, string[]],
    );
    if (selectedPackEntries.some(([, packIds]) => packIds.length === 0)) {
      setSectorError('Sélectionnez au moins un pack dans chaque module choisi.');
      return null;
    }
    const moduleIds = selectedPackEntries.map(([moduleId]) => moduleId);
    const moduleFeatures = Object.fromEntries(
      selectedPackEntries.map(([moduleId, packIds]) => {
        const module = moduleForSector(moduleId);
        const featureIds =
          module?.featurePacks?.filter((pack) => packIds.includes(pack.id)).flatMap((pack) => pack.featureIds) ?? [];
        return [moduleId, module ? [...getEffectiveModuleFeatureIds(module, featureIds)] : featureIds];
      }),
    ) as Partial<Record<ModuleId, string[]>>;
    return {
      id: editingSector?.id ?? uid('sector'),
      name: normalizedName,
      moduleIds,
      modulePackIds: Object.fromEntries(selectedPackEntries.map(([moduleId, packIds]) => [moduleId, [...packIds]])),
      moduleFeatures,
    };
  };

  const createSector = (event: FormEvent) => {
    event.preventDefault();
    const preset = buildSectorPreset();
    if (!preset) return;
    mutate(
      (draft) => {
        updateCatalogDraft(draft, (catalogDraft) => {
          catalogDraft.sectorPresets = editingSector
            ? catalogDraft.sectorPresets.map((item) => (item.id === editingSector.id ? preset : item))
            : [...catalogDraft.sectorPresets, preset];
        });
      },
      editingSector ? 'Secteur modifié.' : 'Secteur et modules par défaut enregistrés.',
    );
    setSectorName('');
    setSectorModules([]);
    setSectorPackIds({});
    setEditingSector(null);
    setSectorError('');
    setSectorModalOpen(false);
  };

  const testDraftSector = () => {
    const preset = buildSectorPreset();
    if (preset) onTestSector(preset);
  };

  const closeSectorModal = () => {
    setSectorModalOpen(false);
    setEditingSector(null);
    setSectorName('');
    setSectorModules([]);
    setSectorPackIds({});
    setSectorError('');
  };

  const deleteSector = async (preset: SectorPreset) => {
    const affectedCompanies = data.companies.filter((company) => company.sector === preset.name);
    if (
      !(await confirm({
        title: 'Supprimer ce secteur ?',
        description: affectedCompanies.length > 0
          ? `Le secteur « ${preset.name} » ne sera plus proposé lors des nouvelles inscriptions. ${affectedCompanies.length} entreprise(s) existante(s) le conservent comme historique.`
          : `Le secteur « ${preset.name} » ne sera plus proposé lors des nouvelles inscriptions.`,
        confirmLabel: 'Supprimer',
        tone: 'danger',
      }))
    )
      return;
    mutate((draft) => {
      updateCatalogDraft(draft, (catalogDraft) => {
        catalogDraft.sectorPresets = catalogDraft.sectorPresets.filter((item) => item.id !== preset.id);
      });
    }, 'Secteur retiré du brouillon. Publiez les changements pour confirmer.');
  };

  return (
    <div className="space-y-5">
      <CatalogWorkflowBar data={data} mutate={mutate} />
      <section className="card-surface rounded-2xl p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-[hsl(var(--accent)/.2)] p-3 text-[hsl(var(--foreground))]">
              <Building2 size={19} />
            </span>
            <div>
              <p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">
                Configuration du catalogue
              </p>
              <h2 className="mt-2 text-xl font-bold">Configurer un secteur d’activité</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                Un secteur sélectionne directement les packs déjà définis dans les modules. Aucun nom de métier ou de pack
                n’est recréé ici.
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="button-add-sector"
            onClick={() => openSector()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] shadow-sm transition hover:opacity-90"
          >
            <Plus size={15} />
            Ajouter un secteur d’activité
          </button>
        </div>
        {sectorModalOpen && (
          <Modal
            title={editingSector ? 'Modifier le secteur d’activité' : 'Ajouter un secteur d’activité'}
            onClose={closeSectorModal}
            className="max-h-[88vh] w-[min(94vw,1120px)] max-w-[1120px] overflow-y-auto sm:p-8"
          >
            <form onSubmit={createSector} className="space-y-5">
          <label className="block max-w-md text-sm font-semibold">
            Nom du secteur
            <input
              data-testid="input-sector-name"
              value={sectorName}
              onChange={(event) => setSectorName(event.target.value)}
              placeholder="Ex. Bâtiment et travaux publics"
              className="mt-2 w-full rounded-lg border bg-[hsl(var(--card))] px-3 py-3 text-sm font-normal"
            />
          </label>
          <p className="mt-5 text-sm font-semibold">Modules et packs proposés à l’inscription</p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Sélectionnez d’abord un module. Ses packs déjà nommés et configurés apparaîtront ensuite.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.filter((baseModule) => !catalog.removedModules.includes(baseModule.id)).map((baseModule) => {
              const module = moduleForSector(baseModule.id) ?? baseModule;
              const packs = module.featurePacks ?? [];
              const selectedModule = sectorModules.includes(module.id);
              return (
                <div
                  key={module.id}
                  className={`rounded-xl border p-3 transition ${selectedModule ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.06)]' : ''}`}
                >
                  <button
                    type="button"
                    data-testid={`button-sector-module-${module.id}`}
                    onClick={() => toggleSectorModule(module.id)}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selectedModule ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))]'}`}
                    >
                      {selectedModule && <Check size={13} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm">{module.name}</strong>
                      <span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]">
                        {selectedModule
                          ? 'Sélectionnez ses packs ci-dessous.'
                          : 'Sélectionnez ce module pour afficher ses packs.'}
                      </span>
                    </span>
                    <ChevronDown
                      size={16}
                      className={`mt-1 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${selectedModule ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {selectedModule &&
                    (packs.length === 0 ? (
                      <p className="mt-3 border-t pt-3 text-[10px] text-[hsl(var(--muted-foreground))]">
                        Aucun pack disponible dans ce module.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-1 border-t pt-2">
                        {packs.map((pack) => {
                          const selected = sectorPackIds[module.id]?.includes(pack.id) ?? false;
                          return (
                            <label
                              key={pack.id}
                              className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-[10px] hover:bg-[hsl(var(--muted))]"
                            >
                              <input
                                data-testid={`checkbox-sector-pack-${module.id}-${pack.id}`}
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleSectorPack(module.id, pack.id)}
                                className="mt-0.5 accent-[hsl(var(--primary))]"
                              />
                               <span>
                                 <strong className="block">{pack.name}</strong>
                                 <span className="mt-1 block text-[9px] leading-4 text-[hsl(var(--muted-foreground))]">
                                   {pack.description || 'Description à compléter.'}
                                 </span>
                                 <span className="mt-1 block text-[9px] text-[hsl(var(--muted-foreground))]">
                                   {pack.featureIds.length} fonctionnalité(s)
                                 </span>
                               </span>
                            </label>
                          );
                        })}
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
          {sectorError && (
            <p
              data-testid="sector-error"
              className="mt-4 rounded-lg bg-[hsl(var(--destructive)/.08)] px-3 py-2 text-xs font-semibold text-[hsl(var(--destructive))]"
            >
              {sectorError}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="button-test-sector"
              onClick={testDraftSector}
              className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--primary)/.45)] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.06)]"
            >
              <Gauge size={15} />
              Tester ce secteur
            </button>
            <button
              data-testid="button-create-sector"
              type="submit"
              className="btn inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]"
            >
              {editingSector ? <Edit3 size={15} /> : <Plus size={15} />}
              {editingSector ? 'Enregistrer les modifications' : 'Enregistrer le secteur'}
            </button>
            {editingSector && (
              <button
                type="button"
                onClick={closeSectorModal}
                className="rounded-lg border px-4 py-2.5 text-xs font-bold"
              >
                Annuler la modification
              </button>
            )}
          </div>
            </form>
          </Modal>
        )}
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <h2 className="font-bold">Secteurs configurés</h2>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {sectorPresets.length} secteur{sectorPresets.length > 1 ? 's' : ''} disponible
              {sectorPresets.length > 1 ? 's' : ''} à l’inscription
            </p>
          </div>
        </div>
        {sectorPresets.map((preset) => {
          const packCount = Object.values(preset.modulePackIds ?? {}).reduce(
            (total, packIds) => total + (packIds?.length ?? 0),
            0,
          );
          return (
            <article
              data-testid={`card-sector-preset-${preset.id}`}
              key={preset.id}
              className="card-surface flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="rounded-lg bg-[hsl(var(--primary)/.1)] p-3 text-[hsl(var(--primary))]">
                  <Building2 size={19} />
                </span>
                <div>
                  <strong>{preset.name}</strong>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {preset.moduleIds.length} module{preset.moduleIds.length > 1 ? 's' : ''} · {packCount} pack
                    {packCount > 1 ? 's' : ''} sélectionné{packCount > 1 ? 's' : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(preset.modulePackIds ?? {}).flatMap(([moduleId, packIds]) =>
                      (packIds ?? []).map((packId) => (
                        <span
                          key={`${moduleId}-${packId}`}
                          className="rounded-full bg-[hsl(var(--muted))] px-2 py-1 text-[10px] font-semibold"
                        >
                          {moduleName(moduleId as ModuleId)} ·{' '}
                          {moduleForSector(moduleId as ModuleId)?.featurePacks?.find((pack) => pack.id === packId)
                            ?.name ?? packId}
                        </span>
                      )),
                    )}
                  </div>
                </div>
              </div>
              <div className="flex self-start sm:self-center">
                <button
                  type="button"
                  data-testid={`button-test-sector-${preset.id}`}
                  onClick={() => onTestSector(preset)}
                  aria-label={`Tester le secteur ${preset.name}`}
                  className="rounded-lg p-2 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.08)]"
                >
                  <Gauge size={16} />
                </button>
                <button
                  type="button"
                  data-testid={`button-edit-sector-${preset.id}`}
                  onClick={() => openSector(preset)}
                  aria-label={`Modifier le secteur ${preset.name}`}
                  className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  type="button"
                  data-testid={`button-delete-sector-${preset.id}`}
                  onClick={() => deleteSector(preset)}
                  aria-label={`Supprimer le secteur ${preset.name}`}
                  className="rounded-lg p-2 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)]"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          );
        })}
        {sectorPresets.length === 0 && (
          <div className="card-surface rounded-2xl border-dashed p-10 text-center">
            <Building2 className="mx-auto text-[hsl(var(--muted-foreground))]" size={26} />
            <h3 className="mt-4 font-bold">Aucun secteur configuré</h3>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Ajoutez un premier secteur pour guider les inscriptions.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
function SimpleAdminPage({
  type,
  data,
  onNavigate,
}: {
  type: 'users';
  data: StoreData;
  onNavigate: (path: string) => void;
}) {
  return (
    <section className="card-surface overflow-hidden rounded-2xl">
      <div className="border-b p-5">
        <Toolbar search={''} setSearch={() => {}}>
          <ActionButton
            primary
            testId="button-add-user"
            onClick={() => onNavigate('/maximus/entreprises/organisation')}
          >
            Gérer les comptes employés
          </ActionButton>
        </Toolbar>
      </div>
      <DataTable
        headers={['Utilisateur', 'Espace', 'Dernière activité', 'Statut']}
        rows={[
          ...data.employees.map((e) => [
            `${e.firstName} ${e.lastName}`,
            data.companies.find((company) => company.id === e.companyId)?.name ?? 'Entreprise',
            'Compte actif',
            <StatusBadge status={e.status} />,
          ]),
        ]}
      />
    </section>
  );
}
function RolesPage({ data, onNavigate }: { data: StoreData; onNavigate: (path: string) => void }) {
  if (data.roles.length === 0)
    return (
      <EmptyState
        title="Aucun rôle configuré"
        text="Créez les rôles depuis l’organisation de l’entreprise concernée."
        action={() => onNavigate('/maximus/entreprises/organisation')}
      />
    );
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {data.roles.map((role) => (
        <section key={role.id} data-testid={`card-role-${role.id}`} className="card-surface rounded-2xl p-5">
          <div className="flex items-start justify-between">
            <span className="rounded-xl bg-[hsl(var(--primary)/.1)] p-3 text-[hsl(var(--primary))]">
              <KeyRound size={18} />
            </span>
            <button
              data-testid={`button-edit-role-${role.id}`}
              title="Modifier dans l’organisation"
              onClick={() => onNavigate('/maximus/entreprises/organisation')}
              className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]"
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
          <h2 className="mt-5 font-bold">{role.name}</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{role.description}</p>
          <div className="mt-5 space-y-2">
            {Object.keys(role.modulePermissions).map((key) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span>{modules.find((m) => m.id === key)?.name ?? key}</span>
                <span className="text-[hsl(var(--muted-foreground))]">{role.modulePermissions[key].join(' · ')}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
function SubscriptionsPage({
  data,
  onNavigate,
  onRefresh,
}: {
  data: StoreData;
  onNavigate: (path: string) => void;
  onRefresh: () => Promise<boolean>;
}) {
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState(data.subscriptions[0]?.id ?? '');
  const [searchTerm, setSearchTerm] = useState('');
  const [hasActiveBillingSubscriptions, setHasActiveBillingSubscriptions] = useState<boolean | null>(null);
  const subscriptions = filterSubscriptionsForVisibleCompanies(data.subscriptions, data.companies);
  const catalogModules = useMemo(
    () => getConfiguredModules({
      moduleOverrides: data.moduleOverrides,
      removedModules: data.removedModules,
      customModules: data.customModules,
    }).map(({ id, name }) => ({ id, name })),
    [data.customModules, data.moduleOverrides, data.removedModules],
  );
  const formatDate = (value: string | null) => {
    if (!value) return '—';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
  };
  const formatAmount = (value: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;

  useEffect(() => {
    if (subscriptions.some((subscription) => subscription.id === selectedSubscriptionId)) return;
    setSelectedSubscriptionId(subscriptions[0]?.id ?? '');
  }, [subscriptions, selectedSubscriptionId]);

  const filteredSubscriptions = subscriptions.filter((subscription) => {
    const company = data.companies.find((item) => item.id === subscription.companyId);
    const query = searchTerm.trim().toLowerCase();
    return !query || `${company?.name ?? ''} ${subscription.planName} ${subscription.status} ${subscription.paymentStatus}`.toLowerCase().includes(query);
  });
  const selectedSubscription = subscriptions.find((subscription) => subscription.id === selectedSubscriptionId);
  const selectedCompany = data.companies.find((company) => company.id === selectedSubscription?.companyId);
  const selectedPlan = subscriptionPlans.find((plan) => plan.id === selectedSubscription?.planId);
  const selectedEmployees = selectedCompany ? data.employees.filter((employee) => employee.companyId === selectedCompany.id).length : 0;
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'ACTIF' || subscription.status === 'ESSAI');
  const monthlyRevenue = activeSubscriptions.reduce(
    (total, subscription) => total + (subscription.interval === 'ANNUEL' ? subscription.amount / 12 : subscription.amount),
    0,
  );
  const unpaidSubscriptions = subscriptions.filter((subscription) => subscription.paymentStatus === 'IMPAYÉ').length;
  const overdueInvoices = subscriptions.flatMap((subscription) => subscription.invoices).filter((invoice) => invoice.status === 'EN RETARD').length;

  if (subscriptions.length === 0) {
    return (
      <div className="space-y-6">
        <MaximusWalletPanel formatAmount={formatAmount} />
        <SubscriptionPricingManagement
          catalogModules={catalogModules}
          onActiveSubscriptionAvailabilityChange={setHasActiveBillingSubscriptions}
        />
        {hasActiveBillingSubscriptions === false && (
          <EmptyState
            title="Aucun abonnement enregistré"
            text="Aucune souscription mensuelle active n’a été trouvée pour les entreprises."
            action={() => onNavigate('/maximus/demandes')}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-[hsl(var(--primary)/.22)] bg-[linear-gradient(120deg,hsl(var(--sidebar)),hsl(var(--sidebar)/.88))] p-6 text-[hsl(var(--sidebar-foreground))] shadow-sm sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="mono text-[10px] uppercase tracking-[.22em] text-[hsl(var(--accent))]">Gestion financière</p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Abonnements, paiements et échéances.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[hsl(var(--sidebar-foreground)/.72)]">
              Chaque souscription possède son propre plan, son cycle de vie, ses limites et son historique de facturation.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <CreditCard size={20} className="text-[hsl(var(--accent))]" />
            <div>
              <p className="text-xs font-bold">Suivi des souscriptions</p>
              <p className="mt-1 text-[10px] text-[hsl(var(--sidebar-foreground)/.62)]">Plans · paiements · factures</p>
            </div>
          </div>
        </div>
        <div className="absolute -right-14 -top-16 h-48 w-48 rounded-full border border-white/10 bg-white/[.03]" />
      </section>

      <MaximusWalletPanel formatAmount={formatAmount} />
      <SubscriptionPricingManagement catalogModules={catalogModules} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Souscriptions actives', value: activeSubscriptions.length, detail: `${subscriptions.length} enregistrée(s)`, icon: ShieldCheck },
          { label: 'Revenu mensuel prévu', value: formatAmount(monthlyRevenue), detail: 'sur les plans actifs', icon: TrendingUp },
          { label: 'Paiements impayés', value: unpaidSubscriptions, detail: 'souscription(s) à relancer', icon: CreditCard },
          { label: 'Factures en retard', value: overdueInvoices, detail: 'à régulariser', icon: FileBarChart },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <section key={metric.label} className="card-surface rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{metric.label}</p>
                  <p className="mt-3 text-2xl font-bold tracking-tight">{metric.value}</p>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{metric.detail}</p>
                </div>
                <span className="rounded-xl bg-[hsl(var(--primary)/.1)] p-2.5 text-[hsl(var(--primary))]"><Icon size={17} /></span>
              </div>
            </section>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(390px,.98fr)]">
        <section className="card-surface overflow-hidden rounded-2xl">
          <div className="border-b border-[hsl(var(--border))] p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Registre</p>
                <h2 className="mt-2 text-xl font-bold">Souscriptions clientes</h2>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Les données de paiement sont rattachées à une souscription, pas seulement à une entreprise.</p>
              </div>
              <button type="button" onClick={() => onNavigate('/maximus/demandes')} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition hover:bg-[hsl(var(--muted)/.55)]">
                <FileClock size={14} /> Voir les demandes
              </button>
            </div>
            <label className="relative mt-5 block">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Rechercher une entreprise, un plan ou un statut…" className="w-full rounded-lg border bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[hsl(var(--primary))]" />
            </label>
          </div>
          <div className="divide-y divide-[hsl(var(--border))]">
            {filteredSubscriptions.map((subscription) => {
              const company = data.companies.find((item) => item.id === subscription.companyId);
              const isSelected = subscription.id === selectedSubscriptionId;
              return (
                <button type="button" key={subscription.id} data-testid={`subscription-row-${subscription.id}`} onClick={() => setSelectedSubscriptionId(subscription.id)} className={`flex w-full items-center gap-4 px-5 py-4 text-left transition sm:px-6 ${isSelected ? 'bg-[hsl(var(--primary)/.07)]' : 'hover:bg-[hsl(var(--muted)/.35)]'}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${isSelected ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))]'}`}>
                    {(company?.name ?? '?').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm">{company?.name ?? subscription.companyId}</strong><StatusBadge status={subscription.status} /></span>
                    <span className="mt-1 block truncate text-xs text-[hsl(var(--muted-foreground))]">{subscription.planName} · {subscription.paymentStatus}</span>
                  </span>
                  <span className="hidden shrink-0 text-right sm:block"><strong className="block text-sm">{formatAmount(subscription.amount)}</strong><span className="text-[10px] text-[hsl(var(--muted-foreground))]">/ {subscription.interval === 'MENSUEL' ? 'mois' : 'an'}</span></span>
                  <ChevronRight size={16} className={isSelected ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'} />
                </button>
              );
            })}
          </div>
        </section>

        {selectedSubscription && (
          <section className="card-surface rounded-2xl p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Souscription sélectionnée</p>
                <div className="mt-2 flex flex-wrap items-center gap-2"><h2 className="truncate text-xl font-bold">{selectedCompany?.name ?? selectedSubscription.companyId}</h2><StatusBadge status={selectedSubscription.status} /></div>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{selectedSubscription.planName} · créée le {formatDate(selectedSubscription.startedAt)}</p>
              </div>
              {selectedCompany && <button type="button" title="Ouvrir la fiche entreprise" onClick={() => onNavigate(`/maximus/entreprises/${selectedCompany.id}`)} className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))]"><Building2 size={17} /></button>}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[hsl(var(--border))] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Plan</p><strong className="mt-2 block text-lg">{selectedSubscription.planName}</strong><span className="text-[10px] text-[hsl(var(--muted-foreground))]">{selectedPlan?.description}</span></div>
              <div className="rounded-xl border border-[hsl(var(--border))] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Tarif</p><strong className="mt-2 block text-lg">{formatAmount(selectedSubscription.amount)}</strong><span className="text-[10px] text-[hsl(var(--muted-foreground))]">par {selectedSubscription.interval === 'MENSUEL' ? 'mois' : 'an'}</span></div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ['Début', formatDate(selectedSubscription.startedAt)],
                ['Fin', formatDate(selectedSubscription.endsAt)],
                ['Prochain renouvellement', formatDate(selectedSubscription.nextRenewalAt)],
                ['Fin d’essai', formatDate(selectedSubscription.trialEndsAt)],
              ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] pb-2 text-xs"><span className="text-[hsl(var(--muted-foreground))]">{label}</span><strong>{value}</strong></div>)}
            </div>

            <div className="mt-5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.28)] p-4">
              <div className="flex items-start gap-3"><CreditCard size={17} className="mt-0.5 text-[hsl(var(--primary))]" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">Paiement</p><StatusBadge status={selectedSubscription.paymentStatus} /></div><p className="mt-2 text-sm font-semibold">{selectedSubscription.paymentMethod.label}{selectedSubscription.paymentMethod.last4 ? ` · ···· ${selectedSubscription.paymentMethod.last4}` : ''}</p></div></div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold">Limites du plan</p><span className="text-[10px] text-[hsl(var(--muted-foreground))]">{selectedEmployees} / {selectedSubscription.limits.employees} employés</span></div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: 'Employés', used: selectedEmployees, limit: selectedSubscription.limits.employees, Icon: Users },
                  { label: 'Modules', used: selectedSubscription.moduleIds.length, limit: selectedSubscription.limits.modules, Icon: Package },
                  { label: 'Stockage', used: '—', limit: selectedSubscription.limits.storageGb, Icon: FolderKanban },
                ].map(({ label, used, limit, Icon: MetricIcon }) => {
                  return <div key={label} className="rounded-lg border border-[hsl(var(--border))] p-3"><MetricIcon size={14} className="text-[hsl(var(--primary))]" /><strong className="mt-2 block text-sm">{used} <span className="text-[10px] font-normal text-[hsl(var(--muted-foreground))]">/ {limit}{label === 'Stockage' ? ' Go' : ''}</span></strong><span className="text-[10px] text-[hsl(var(--muted-foreground))]">{label}</span></div>;
                })}
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold">Factures récentes</p><span className="text-[10px] text-[hsl(var(--muted-foreground))]">{selectedSubscription.invoices.length} document(s)</span></div>
              <div className="mt-3 space-y-2">
                {selectedSubscription.invoices.map((invoice) => <div key={invoice.id} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2.5"><FileBarChart size={14} className="text-[hsl(var(--primary))]" /><div className="min-w-0 flex-1"><strong className="block truncate text-xs">{invoice.number}</strong><span className="text-[10px] text-[hsl(var(--muted-foreground))]">Échéance {formatDate(invoice.dueAt)}</span></div><span className="hidden text-xs font-bold sm:block">{formatAmount(invoice.amount)}</span><StatusBadge status={invoice.status} /></div>)}
                {selectedSubscription.invoices.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">Aucune facture enregistrée.</p>}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-bold">Historique du cycle de vie</p>
              <div className="mt-3 space-y-3 border-l border-[hsl(var(--border))] pl-4">
                {selectedSubscription.history.map((event) => <div key={event.id} className="relative"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[hsl(var(--primary))]" /><p className="text-xs font-semibold">{event.label}</p><p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{formatDate(event.date)} · {event.actor}</p></div>)}
              </div>
            </div>
          </section>
        )}
      </div>

      <section>
        <div className="mb-3"><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Catalogue</p><h2 className="mt-2 text-xl font-bold">Plans disponibles</h2></div>
        <div className="grid gap-4 md:grid-cols-3">
          {subscriptionPlans.map((plan) => <section key={plan.id} className={`card-surface rounded-2xl p-5 ${selectedSubscription?.planId === plan.id ? 'border-[hsl(var(--primary)/.55)] ring-1 ring-[hsl(var(--primary)/.22)]' : ''}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{plan.name}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{plan.description}</p></div>{selectedSubscription?.planId === plan.id && <StatusBadge status="ACTIF" />}</div><p className="mt-5 text-2xl font-bold">{formatAmount(plan.monthlyAmount)}<span className="text-xs font-normal text-[hsl(var(--muted-foreground))]"> / mois</span></p><div className="mt-4 space-y-2 text-xs text-[hsl(var(--muted-foreground))]"><p className="flex justify-between"><span>Employés</span><strong className="text-[hsl(var(--foreground))]">{plan.limits.employees}</strong></p><p className="flex justify-between"><span>Modules</span><strong className="text-[hsl(var(--foreground))]">{plan.limits.modules}</strong></p><p className="flex justify-between"><span>Stockage</span><strong className="text-[hsl(var(--foreground))]">{plan.limits.storageGb} Go</strong></p></div></section>)}
        </div>
      </section>
    </div>
  );
}

function MaximusWalletPanel({ formatAmount }: { formatAmount: (value: number) => string }) {
  const [bootstrap, setBootstrap] = useState<MaximusWalletBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState('');
  const [mobile, setMobile] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = async (preserveForm = false) => {
    try {
      const response = await platformSettingsApi.maximusWallet();
      setBootstrap(response);
      if (!preserveForm) {
        setMobile(response.wallet.payoutMobile);
        setBeneficiaryName(response.wallet.payoutName);
      }
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Le solde MAXIMUS est indisponible.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);
  useAutoRefresh(() => load(true), { enabled: Boolean(bootstrap) });

  const savePayoutAccount = async () => {
    if (mobile.trim().length < 8 || beneficiaryName.trim().length < 2) {
      setMessage({ tone: 'error', text: 'Indiquez un numéro mobile et un nom de bénéficiaire valides.' });
      return false;
    }
    await platformSettingsApi.updateMaximusPayoutAccount({
      provider: 'WAVE',
      mobile: mobile.trim(),
      beneficiaryName: beneficiaryName.trim(),
    });
    return true;
  };

  const requestWithdrawal = async (event: FormEvent) => {
    event.preventDefault();
    if (!bootstrap) return;
    const requestedAmount = Number(amount);
    if (!Number.isInteger(requestedAmount) || requestedAmount < 1000 || requestedAmount > bootstrap.wallet.availableBalance) {
      setMessage({ tone: 'error', text: 'Le retrait doit être entier, d’au moins 1 000 FCFA et couvert par le solde disponible.' });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const accountSaved = await savePayoutAccount();
      if (!accountSaved) return;
      const response = await platformSettingsApi.requestMaximusWithdrawal({
        amount: requestedAmount,
        provider: 'WAVE',
        mobile: mobile.trim(),
        beneficiaryName: beneficiaryName.trim(),
        idempotencyKey: uid('maximus-withdrawal'),
      });
      setAmount('');
      setMessage({
        tone: response.withdrawal.status === 'FAILED' ? 'error' : 'success',
        text: response.withdrawal.status === 'SUCCEEDED'
          ? 'Le retrait MAXIMUS a été confirmé.'
          : response.withdrawal.status === 'FAILED'
            ? response.withdrawal.failureReason || 'Le retrait MAXIMUS a échoué.'
            : 'Le retrait MAXIMUS est en cours de traitement.',
      });
      await load();
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Le retrait MAXIMUS a échoué.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="maximus-wallet-panel" className="card-surface overflow-hidden rounded-2xl">
      <div className="border-b border-[hsl(var(--border))] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Compte plateforme</p>
            <h2 className="mt-2 text-xl font-bold">Compte MAXIMUS</h2>
          </div>
          <WalletCards size={22} className="text-[hsl(var(--primary))]" />
        </div>
      </div>

      {loading && <p className="p-6 text-sm text-[hsl(var(--muted-foreground))]">Chargement du compte MAXIMUS…</p>}
      {!loading && !bootstrap && <p className="p-6 text-sm text-[hsl(var(--destructive))]">Le compte MAXIMUS n’a pas pu être chargé.</p>}
      {bootstrap && (
        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Disponible', value: bootstrap.wallet.availableBalance, icon: CircleDollarSign },
              { label: 'Réservé', value: bootstrap.wallet.reservedBalance, icon: ShieldCheck },
              { label: 'Total déjà crédité', value: bootstrap.wallet.totalCredited, icon: TrendingUp },
            ].map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="rounded-xl border border-[hsl(var(--border))] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{metric.label}</p>
                    <Icon size={16} className="text-[hsl(var(--primary))]" />
                  </div>
                  <p className="mt-3 text-xl font-bold">{formatAmount(metric.value)}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,.8fr)]">
            <div className="rounded-xl border border-[hsl(var(--border))] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold">Mouvements du compte MAXIMUS</p>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{Math.min(bootstrap.ledger.length, 5)} affiché(s)</span>
              </div>
              <div className="mt-3 space-y-2">
                {bootstrap.ledger.slice(0, 5).map((entry) => {
                  const isCredit = entry.direction === 'CREDIT';
                  const isSubscription = entry.type === 'SUBSCRIPTION_PAYMENT';
                  return (
                    <div key={entry.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2.5">
                      {isCredit
                        ? <ArrowDownToLine size={14} className="text-[hsl(var(--primary))]" />
                        : <ArrowUpFromLine size={14} className="text-[hsl(var(--muted-foreground))]" />}
                      <div className="min-w-0 flex-1">
                        <strong className="block text-xs">{isSubscription ? 'Abonnement payé' : entry.type.replaceAll('_', ' ').toLowerCase()}</strong>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {entry.referenceId ? `Réf. ${entry.referenceId} · ` : ''}
                          {new Date(entry.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <strong className={`text-xs ${isCredit ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                        {isCredit ? '+' : '−'}{formatAmount(entry.amount)}
                      </strong>
                    </div>
                  );
                })}
                {bootstrap.ledger.length === 0 && (
                  <p className="rounded-lg border border-dashed p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">Aucun mouvement n’est encore enregistré.</p>
                )}
              </div>
            </div>

            <form onSubmit={requestWithdrawal} className="rounded-xl border border-[hsl(var(--border))] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold">Retirer le solde MAXIMUS</p>
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Minimum 1 000 FCFA</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold">Montant à recevoir<input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="1000" step="1" placeholder="1000" className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[hsl(var(--primary))]" /></label>
                <label className="text-xs font-semibold">Mobile WAVE<input value={mobile} onChange={(event) => setMobile(event.target.value)} type="tel" placeholder="77 000 00 00" className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[hsl(var(--primary))]" /></label>
              </div>
              <label className="mt-3 block text-xs font-semibold">Bénéficiaire<input value={beneficiaryName} onChange={(event) => setBeneficiaryName(event.target.value)} placeholder="Nom du bénéficiaire" className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[hsl(var(--primary))]" /></label>
              <p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">Le montant est débité du compte MAXIMUS et envoyé au compte configuré via DiamanoPay.</p>
              {message && <p role="alert" className={`mt-3 rounded-lg p-3 text-xs font-semibold ${message.tone === 'error' ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]'}`}>{message.text}</p>}
              <button type="submit" disabled={busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50">
                <ArrowUpFromLine size={15} />{busy ? 'Traitement…' : 'Demander le retrait'}
              </button>
            </form>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold">Derniers retraits MAXIMUS</p>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{bootstrap.withdrawals.length} demande(s)</span>
            </div>
            <div className="mt-3 space-y-2">
              {bootstrap.withdrawals.slice(0, 5).map((withdrawal) => (
                <div key={withdrawal.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2.5">
                  <ArrowUpFromLine size={14} className="text-[hsl(var(--primary))]" />
                  <div className="min-w-0 flex-1"><strong className="block text-xs">{formatAmount(withdrawal.amount)}</strong><span className="text-[10px] text-[hsl(var(--muted-foreground))]">{withdrawal.mobile} · {withdrawal.beneficiaryName}</span></div>
                  <StatusBadge status={withdrawal.status} />
                </div>
              ))}
              {bootstrap.withdrawals.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">Aucun retrait MAXIMUS enregistré.</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function NotificationsPage({
  data,
  mutate,
  context,
}: {
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
  context: { isAdmin: boolean; companyId?: string };
}) {
  const notifications = getVisibleNotifications(data.notifications, context);
  const notificationCompany = context.isAdmin
    ? undefined
    : data.companies.find((company) => company.id === context.companyId);

  return (
    <div className="space-y-3">
      {notificationCompany && (
        <CompanyPushNotificationPrompt
          key={`${notificationCompany.id}-bell`}
          companyId={notificationCompany.id}
          companyName={notificationCompany.name}
          placement="bell"
        />
      )}
      {notifications.length === 0 && (
        <div className="card-surface rounded-2xl p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Aucune notification pour le moment.
        </div>
      )}
      {notifications.map((n) => (
        <section
          data-testid={`notification-${n.id}`}
          key={n.id}
          className={`card-surface flex items-start gap-4 rounded-2xl p-5 ${!n.read ? 'border-l-4 border-l-[hsl(var(--accent))]' : ''}`}
        >
          <span
            className={`rounded-xl p-3 ${n.severity === 'warning' ? 'bg-[hsl(var(--accent)/.2)] text-[hsl(var(--primary))]' : n.severity === 'error' ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--muted))]'}`}
          >
            <Bell size={17} />
          </span>
          <div className="flex-1">
            <div className="flex justify-between gap-3">
              <h2 className="font-bold">{n.title}</h2>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{n.date}</span>
            </div>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{n.text}</p>
            {n.href && (
              <Link href={n.href} className="mt-3 mr-3 inline-block text-xs font-bold text-[hsl(var(--primary))]">
                Ouvrir
              </Link>
            )}
            {!n.read && (
              <button
                data-testid={`button-read-notification-${n.id}`}
                onClick={() =>
                  mutate((d) => {
                    const x = d.notifications.find((y) => y.id === n.id);
                    if (x) x.read = true;
                  }, 'Notification marquée comme lue.')
                }
                className="mt-3 text-xs font-bold text-[hsl(var(--primary))]"
              >
                Marquer comme lue
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
function JournalPage({ data }: { data: StoreData }) {
  const [search, setSearch] = useState('');
  const rows = data.activities.filter((a) =>
    `${a.user} ${a.action} ${a.object}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="card-surface overflow-hidden rounded-2xl">
      <div className="border-b p-5">
        <Toolbar search={search} setSearch={setSearch}>
          <button
            data-testid="button-filter-journal"
            onClick={() => setSearch(search ? '' : 'finance')}
            className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold"
          >
            <SlidersHorizontal size={14} />
            {search ? 'Réinitialiser' : 'Filtrer Finance'}
          </button>
        </Toolbar>
      </div>
      <DataTable
        headers={['Utilisateur', 'Action', 'Module', 'Objet', 'Date', 'État']}
        rows={rows.map((a) => [a.user, a.action, a.module, a.object, a.date, <StatusBadge status={a.status} />])}
      />
    </section>
  );
}

function OrganisationPage({
  data,
  mutate,
}: {
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
}) {
  const [modal, setModal] = useState<OrgNode | 'new' | null>(null);
  const [name, setName] = useState('');
  const [parent, setParent] = useState<string | null>(null);
  const roots = data.orgNodes.filter((n) => !n.parentId);
  const open = (node: OrgNode | 'new') => {
    setModal(node);
    setName(node === 'new' ? '' : node.name);
    setParent(node === 'new' ? null : node.parentId);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="card-surface rounded-2xl p-5 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-bold">Arborescence</h2>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              Déployez vos équipes à la profondeur qui vous convient.
            </p>
          </div>
          <ActionButton primary testId="button-add-org-node" onClick={() => open('new')}>
            Ajouter un nœud
          </ActionButton>
        </div>
        <div className="space-y-2">
          {roots.map((node) => (
            <OrgTree
              key={node.id}
              node={node}
              nodes={data.orgNodes}
              onEdit={open}
              onDelete={(id) =>
                mutate((d) => {
                  d.orgNodes = d.orgNodes.filter((n) => n.id !== id && n.parentId !== id);
                }, 'Nœud supprimé.')
              }
            />
          ))}
        </div>
      </section>
      <section className="card-surface grid-lines rounded-2xl p-5">
        <GitBranch size={19} className="text-[hsl(var(--primary))]" />
        <h2 className="mt-5 font-bold">Une structure vivante</h2>
        <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
           Chaque unité peut accueillir ses propres sous-unités.
        </p>
        <div className="mt-6 border-t pt-4">
          <p className="mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Total nœuds</p>
          <p className="mt-1 text-2xl font-bold">{data.orgNodes.length}</p>
        </div>
      </section>
      {modal && (
        <Modal title={modal === 'new' ? 'Nouveau nœud' : 'Modifier le nœud'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <Field label="Nom" value={name} onChange={setName} testId="input-org-name" />
            <label className="block text-sm font-semibold">
              Parent
              <select
                data-testid="select-org-parent"
                value={parent ?? ''}
                onChange={(e) => setParent(e.target.value || null)}
                className="mt-2 w-full rounded-lg border bg-[hsl(var(--card))] px-3 py-3 text-sm"
              >
                <option value="">Racine</option>
                {data.orgNodes
                  .filter((n) => modal === 'new' || n.id !== (modal as OrgNode).id)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                data-testid="button-cancel-org"
                onClick={() => setModal(null)}
                className="rounded-lg border px-4 py-2 text-sm font-bold"
              >
                Annuler
              </button>
              <ActionButton
                primary
                testId="button-save-org"
                onClick={() => {
                  if (!name) return;
                  mutate((d) => {
                    if (modal === 'new') d.orgNodes.push({ id: uid('org'), name, parentId: parent });
                    else {
                      const x = d.orgNodes.find((n) => n.id === (modal as OrgNode).id);
                      if (x) {
                        x.name = name;
                        x.parentId = parent;
                      }
                    }
                  }, 'Organisation mise à jour.');
                  setModal(null);
                }}
              >
                Enregistrer
              </ActionButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
function OrgTree({
  node,
  nodes,
  onEdit,
  onDelete,
  depth = 0,
}: {
  node: OrgNode;
  nodes: OrgNode[];
  onEdit: (n: OrgNode) => void;
  onDelete: (id: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = nodes.filter((n) => n.parentId === node.id);
  return (
    <div style={{ marginLeft: depth * 22 }}>
      <div className="group flex items-center gap-2 rounded-lg px-2 py-2.5 hover:bg-[hsl(var(--muted)/.6)]">
        <button
          data-testid={`button-expand-org-${node.id}`}
          onClick={() => setExpanded(!expanded)}
          className="text-[hsl(var(--muted-foreground))]"
        >
          {children.length ? (
            <ChevronDown size={15} className={expanded ? '' : '-rotate-90'} />
          ) : (
            <span className="block w-[15px]" />
          )}
        </button>
        <span className="rounded-lg bg-[hsl(var(--primary)/.1)] p-2 text-[hsl(var(--primary))]">
          <Building2 size={14} />
        </span>
        <span className="flex-1 text-sm font-bold">{node.name}</span>
        <button
          data-testid={`button-edit-org-${node.id}`}
          onClick={() => onEdit(node)}
          className="invisible rounded p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] group-hover:visible"
        >
          <Settings size={14} />
        </button>
        <button
          data-testid={`button-delete-org-${node.id}`}
          onClick={() => onDelete(node.id)}
          className="invisible rounded p-1.5 text-[hsl(var(--destructive))] group-hover:visible"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {expanded &&
        children.map((child) => (
          <OrgTree key={child.id} node={child} nodes={nodes} onEdit={onEdit} onDelete={onDelete} depth={depth + 1} />
        ))}
    </div>
  );
}
function EmployeesPage({
  data,
  mutate,
  companyAdmin,
  sectorAdminDepartment,
}: {
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
  companyAdmin: boolean;
  sectorAdminDepartment?: string;
}) {
  const { confirm } = useAppDialog();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<Employee | 'new' | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    position: '',
    department: sectorAdminDepartment ?? 'Commerce',
    role: 'Vendeur',
    loginPassword: '',
    isSectorAdmin: false,
  });
  const list = data.employees
    .filter((e) => !sectorAdminDepartment || e.department === sectorAdminDepartment)
    .filter((e) =>
      `${e.firstName} ${e.lastName} ${e.position} ${e.email}`.toLowerCase().includes(search.toLowerCase()),
    );
  const resetForm = () =>
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      position: '',
      department: sectorAdminDepartment ?? 'Commerce',
      role: 'Vendeur',
      loginPassword: '',
      isSectorAdmin: false,
    });
  const openEmployee = (employee?: Employee) => {
    setModal(employee ?? 'new');
    setForm(
      employee
        ? {
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            phone: employee.phone,
            position: employee.position,
            department: employee.department,
            role: employee.role,
            loginPassword: employee.loginPassword ?? '',
            isSectorAdmin: Boolean(employee.isSectorAdmin),
          }
        : {
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            position: '',
            department: sectorAdminDepartment ?? 'Commerce',
            role: 'Vendeur',
            loginPassword: '',
            isSectorAdmin: false,
          },
    );
  };
  const saveEmployee = () => {
    if (!form.firstName || !form.lastName || !form.email || !form.position || !form.loginPassword) return;
    if (
      data.employees.some(
        (e) =>
          e.id !== (modal !== 'new' && modal ? modal.id : '') &&
          e.email.toLowerCase() === form.email.trim().toLowerCase(),
      )
    )
      return;
    mutate(
      (d) => {
        if (modal !== 'new' && modal) {
          const target = d.employees.find((employee) => employee.id === modal.id);
          if (target)
            Object.assign(target, {
              ...form,
              email: form.email.trim().toLowerCase(),
              isSectorAdmin: companyAdmin && form.isSectorAdmin,
            });
        } else {
          d.employees.push({
            id: uid('emp'),
            ...form,
            email: form.email.trim().toLowerCase(),
            subDepartment: '',
            status: 'ACTIF',
            isSectorAdmin: companyAdmin && form.isSectorAdmin,
          });
        }
      },
      modal !== 'new' && modal
        ? 'Compte employé modifié.'
        : companyAdmin && form.isSectorAdmin
          ? 'Administrateur de secteur créé avec ses identifiants.'
          : 'Compte employé créé avec ses identifiants.',
    );
    setModal(null);
    resetForm();
  };
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.05)] p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-[hsl(var(--primary)/.12)] p-3 text-[hsl(var(--primary))]">
            <KeyRound size={18} />
          </span>
          <div>
            <h2 className="font-bold">
              {companyAdmin ? 'Administration des secteurs' : `Administration du secteur ${sectorAdminDepartment}`}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              {companyAdmin
                ? 'Créez un administrateur pour chaque secteur. Il pourra ensuite gérer les employés de son secteur.'
                : 'Vous pouvez gérer les employés de votre secteur. Leur rôle définit les modules et actions accessibles après connexion.'}
            </p>
          </div>
        </div>
      </section>
      <section className="card-surface overflow-hidden rounded-2xl">
        <div className="border-b p-5">
          <Toolbar search={search} setSearch={setSearch}>
            <ActionButton primary testId="button-add-employee" onClick={() => openEmployee()}>
              <UserPlus size={15} />
              {companyAdmin ? 'Créer un compte' : 'Créer un employé'}
            </ActionButton>
          </Toolbar>
        </div>
        <DataTable
          headers={['Employé', 'Poste', 'Département', 'Rôle autorisé', 'Accès de connexion', 'Statut', '']}
          rows={list.map((e) => [
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--accent)/.28)] text-[10px] font-black">
                {e.firstName[0]}
                {e.lastName[0]}
              </span>
              <span>
                <strong className="block">
                  {e.firstName} {e.lastName}
                </strong>
                <small className="text-xs text-[hsl(var(--muted-foreground))]">{e.email}</small>
              </span>
            </div>,
            e.position,
            `${e.department}${e.subDepartment ? ` · ${e.subDepartment}` : ''}`,
            <div>
              <strong>{e.role}</strong>
              {e.isSectorAdmin && (
                <span className="ml-2 rounded-full bg-[hsl(var(--accent)/.28)] px-2 py-1 text-[9px] font-bold">
                  Admin secteur
                </span>
              )}
            </div>,
            <div className="text-xs">
              <span className="block font-semibold">Email + mot de passe</span>
              <small className="text-[hsl(var(--muted-foreground))]">{e.loginPassword ? 'Mot de passe configuré' : 'Non configuré'}</small>
            </div>,
            <StatusBadge status={e.status} />,
            <div className="flex gap-1">
              <button
                data-testid={`button-edit-employee-${e.id}`}
                title="Modifier"
                onClick={() => openEmployee(e)}
                className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]"
              >
                <Settings size={15} />
              </button>
              <button
                data-testid={`button-remove-employee-${e.id}`}
                title="Supprimer"
                onClick={() =>
                  void confirm({
                    title: 'Supprimer ce compte employé ?',
                    description: `Le compte de ${e.firstName} ${e.lastName} sera supprimé.`,
                    confirmLabel: 'Supprimer',
                    tone: 'danger',
                  }).then((ok) => {
                    if (ok)
                      mutate((d) => {
                        d.employees = d.employees.filter((x) => x.id !== e.id);
                      }, 'Compte employé supprimé.');
                  })
                }
                className="rounded-lg p-2 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"
              >
                <Trash2 size={15} />
              </button>
            </div>,
          ])}
        />
      </section>
      {modal && (
        <Modal
          title={
            modal === 'new'
              ? companyAdmin
                ? 'Créer un compte de secteur'
                : 'Créer un compte employé'
              : 'Modifier le compte employé'
          }
          onClose={() => {
            setModal(null);
            resetForm();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Prénom"
              value={form.firstName}
              onChange={(v) => setForm({ ...form, firstName: v })}
              testId="input-employee-firstname"
            />
            <Field
              label="Nom"
              value={form.lastName}
              onChange={(v) => setForm({ ...form, lastName: v })}
              testId="input-employee-lastname"
            />
            <Field
              label="Email de connexion"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              type="email"
              testId="input-employee-email"
            />
            <Field
              label="Téléphone"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              testId="input-employee-phone"
            />
            <Field
              label="Poste"
              value={form.position}
              onChange={(v) => setForm({ ...form, position: v })}
              testId="input-employee-position"
            />
            <Field
              label="Mot de passe initial"
              value={form.loginPassword}
              onChange={(v) => setForm({ ...form, loginPassword: v })}
              type="text"
              testId="input-employee-password"
            />
          </div>
          <label className="mt-4 block text-sm font-semibold">
            Département
            <select
              disabled={!companyAdmin}
              data-testid="select-employee-department"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="mt-2 w-full rounded-lg border bg-transparent px-3 py-3 text-sm disabled:opacity-60"
            >
              <option>Commerce</option>
              <option>Finance</option>
              <option>Opérations</option>
              <option>RH</option>
              <option>Direction</option>
            </select>
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Rôle et poste autorisé
            <select
              data-testid="select-employee-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="mt-2 w-full rounded-lg border bg-transparent px-3 py-3 text-sm"
            >
              {data.roles.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          {companyAdmin && (
            <label className="mt-4 flex items-start gap-3 rounded-lg border border-[hsl(var(--border))] p-3 text-sm">
              <input
                data-testid="checkbox-sector-admin"
                type="checkbox"
                checked={form.isSectorAdmin}
                onChange={(e) => setForm({ ...form, isSectorAdmin: e.target.checked })}
                className="mt-1"
              />
              <span>
                <strong className="block">Administrateur de secteur</strong>
                <small className="font-normal text-[hsl(var(--muted-foreground))]">
                  Autoriser ce compte à gérer les employés de son département.
                </small>
              </span>
            </label>
          )}
          <p className="mt-4 rounded-lg bg-[hsl(var(--muted))] p-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
            L’employé se connectera avec cet email et ce mot de passe. Son rôle détermine les modules visibles et les
            actions autorisées.
          </p>
          <div className="mt-6 flex justify-end">
            <ActionButton primary testId="button-save-employee" onClick={saveEmployee}>
              {modal === 'new' ? 'Créer le compte' : 'Enregistrer les modifications'}
            </ActionButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
function CompanyRolesPage({
  data,
  mutate,
}: {
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
}) {
  const { alert, confirm } = useAppDialog();
  const [modal, setModal] = useState<Role | 'new' | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const open = (role?: Role) => {
    setModal(role ?? 'new');
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
  };
  const save = () => {
    if (!name.trim()) return;
    const permissions: Role['modulePermissions'] = { finance: ['voir'] };
    mutate(
      (d) => {
        if (modal !== 'new' && modal) {
          const target = d.roles.find((role) => role.id === modal.id);
          if (target) {
            target.name = name.trim();
            target.description = description.trim() || 'Rôle personnalisé entreprise.';
          }
        } else
          d.roles.push({
            id: uid('role'),
            name: name.trim(),
            description: description.trim() || 'Rôle personnalisé entreprise.',
            modulePermissions: permissions,
          });
      },
      modal !== 'new' && modal ? 'Rôle modifié.' : 'Rôle créé.',
    );
    setModal(null);
    setName('');
    setDescription('');
  };
  const remove = async (role: Role) => {
    if (data.employees.some((employee) => employee.roleId === role.id || employee.role === role.name)) {
      await alert({
        title: 'Suppression impossible',
        description: 'Ce rôle est utilisé par un ou plusieurs employés. Réaffectez-les avant de le supprimer.',
        confirmLabel: 'Compris',
        tone: 'danger',
      });
      return;
    }
    if (
      !(await confirm({
        title: 'Supprimer ce rôle ?',
        description: `Le rôle « ${role.name} » sera supprimé.`,
        confirmLabel: 'Supprimer',
        tone: 'danger',
      }))
    )
      return;
    mutate((d) => {
      d.roles = d.roles.filter((item) => item.id !== role.id);
    }, 'Rôle supprimé.');
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ActionButton primary testId="button-add-company-role" onClick={() => open()}>
          Ajouter un rôle
        </ActionButton>
      </div>
      <div className="mobile-stat-grid grid gap-4 md:grid-cols-3">
        {data.roles.map((r) => (
          <section data-testid={`card-company-role-${r.id}`} key={r.id} className="card-surface rounded-2xl p-5">
            <div className="flex items-start justify-between">
              <span className="rounded-xl bg-[hsl(var(--primary)/.1)] p-3 text-[hsl(var(--primary))]">
                <ShieldCheck size={18} />
              </span>
              <div className="flex flex-wrap gap-1">
                <button
                  data-testid={`button-edit-company-role-${r.id}`}
                  aria-label={`Modifier le rôle ${r.name}`}
                  title="Modifier"
                  onClick={() => open(r)}
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold hover:bg-[hsl(var(--muted))]"
                >
                  <Settings size={13} />
                  <span>Modifier</span>
                </button>
                <button
                  data-testid={`button-delete-company-role-${r.id}`}
                  aria-label={`Supprimer le rôle ${r.name}`}
                  title="Supprimer"
                  onClick={() => remove(r)}
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"
                >
                  <Trash2 size={13} />
                  <span>Supprimer</span>
                </button>
              </div>
            </div>
            <h2 className="mt-5 font-bold">{r.name}</h2>
            <p className="mt-1 text-sm leading-5 text-[hsl(var(--muted-foreground))]">{r.description}</p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {Object.keys(r.modulePermissions).map((m) => (
                <span key={m} className="rounded-full bg-[hsl(var(--muted))] px-2 py-1 text-[10px] font-bold">
                  {modules.find((x) => x.id === m)?.name}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
      {modal && (
        <Modal title={modal === 'new' ? 'Nouveau rôle' : 'Modifier le rôle'} onClose={() => setModal(null)}>
          <Field label="Nom du rôle" value={name} onChange={setName} testId="input-role-name" />
          <Field label="Description" value={description} onChange={setDescription} testId="input-role-description" />
          <div className="mt-6 flex justify-end">
            <ActionButton primary testId="button-save-role" onClick={save}>
              {modal === 'new' ? 'Créer le rôle' : 'Enregistrer les modifications'}
            </ActionButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
function StocksPage({ data, mutate }: { data: StoreData; mutate: (fn: (d: StoreData) => void, msg?: string) => void }) {
  const { alert, confirm } = useAppDialog();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<StoreData['products'][number] | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', sku: '', category: 'Divers', stock: 0, threshold: 0, price: 0 });
  const products = data.products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()));
  const open = (product?: StoreData['products'][number]) => {
    setModal(product ?? 'new');
    setForm(
      product
        ? {
            name: product.name,
            sku: product.sku,
            category: product.category,
            stock: product.stock,
            threshold: product.threshold,
            price: product.price,
          }
        : { name: '', sku: '', category: 'Divers', stock: 0, threshold: 0, price: 0 },
    );
  };
  const save = () => {
    if (!form.name.trim() || !form.sku.trim()) return;
    if (
      data.products.some(
        (product) =>
          product.id !== (modal !== 'new' && modal ? modal.id : '') &&
          product.sku.toLowerCase() === form.sku.trim().toLowerCase(),
      )
    ) {
      void alert({
        title: 'Référence déjà utilisée',
        description: 'Cette référence existe déjà dans le catalogue.',
        confirmLabel: 'Compris',
      });
      return;
    }
    mutate(
      (d) => {
        if (modal !== 'new' && modal) {
          const target = d.products.find((product) => product.id === modal.id);
          if (target) Object.assign(target, { ...form, name: form.name.trim(), sku: form.sku.trim() });
        } else d.products.push({ id: uid('p'), ...form, name: form.name.trim(), sku: form.sku.trim() });
      },
      modal !== 'new' && modal ? 'Produit modifié.' : 'Produit ajouté au catalogue.',
    );
    setModal(null);
  };
  const remove = async (product: StoreData['products'][number]) => {
    if (data.sales.some((sale) => sale.items.some((item) => item.productId === product.id))) {
      await alert({
        title: 'Suppression impossible',
        description: 'Ce produit est référencé par une vente et ne peut pas être supprimé.',
        confirmLabel: 'Compris',
        tone: 'danger',
      });
      return;
    }
    if (
      !(await confirm({
        title: 'Supprimer ce produit ?',
        description: `Le produit « ${product.name} » sera supprimé du catalogue.`,
        confirmLabel: 'Supprimer',
        tone: 'danger',
      }))
    )
      return;
    mutate((d) => {
      d.products = d.products.filter((item) => item.id !== product.id);
    }, 'Produit supprimé.');
  };
  return (
    <div className="space-y-5">
      <div className="mobile-stat-grid grid gap-4 md:grid-cols-3">
        <Metric
          label="Références actives"
          value={String(data.products.length)}
          detail="dans le catalogue entreprise"
          icon={Package}
          accent
        />
        <Metric
          label="Unités en stock"
          value={String(data.products.reduce((a, p) => a + p.stock, 0))}
          detail="toutes localisations"
          icon={Boxes}
        />
        <Metric
          label="Alertes de seuil"
          value={String(data.products.filter((p) => p.stock <= p.threshold).length)}
          detail="à réapprovisionner"
          icon={Bell}
          warning
        />
      </div>
      <section className="card-surface overflow-hidden rounded-2xl">
        <div className="border-b p-5">
          <Toolbar search={search} setSearch={setSearch}>
            <ActionButton primary testId="button-add-product" onClick={() => open()}>
              Ajouter un produit
            </ActionButton>
          </Toolbar>
        </div>
        <DataTable
          headers={['Produit', 'SKU', 'Catégorie', 'Stock actuel', 'Seuil', 'Prix unitaire', 'État', 'Actions']}
          rows={products.map((p) => [
            <strong>{p.name}</strong>,
            <span className="mono text-xs">{p.sku}</span>,
            p.category,
            <span className={p.stock <= p.threshold ? 'font-bold text-[hsl(var(--destructive))]' : 'font-bold'}>
              {p.stock}
            </span>,
            p.threshold,
            money(p.price),
            p.stock <= p.threshold ? <StatusBadge status="SUSPENDU" /> : <StatusBadge status="ACTIF" />,
            <div className="flex flex-wrap gap-1">
              <button
                aria-label={`Modifier ${p.name}`}
                title="Modifier"
                onClick={() => open(p)}
                className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold hover:bg-[hsl(var(--muted))]"
              >
                <Settings size={13} />
                <span>Modifier</span>
              </button>
              <button
                aria-label={`Supprimer ${p.name}`}
                title="Supprimer"
                onClick={() => remove(p)}
                className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"
              >
                <Trash2 size={13} />
                <span>Supprimer</span>
              </button>
            </div>,
          ])}
        />
      </section>
      {modal && (
        <Modal title={modal === 'new' ? 'Nouveau produit' : 'Modifier le produit'} onClose={() => setModal(null)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nom"
              value={form.name}
              onChange={(value) => setForm({ ...form, name: value })}
              testId="input-product-name"
            />
            <Field
              label="SKU"
              value={form.sku}
              onChange={(value) => setForm({ ...form, sku: value })}
              testId="input-product-sku"
            />
            <Field
              label="Catégorie"
              value={form.category}
              onChange={(value) => setForm({ ...form, category: value })}
              testId="input-product-category"
            />
            <Field
              label="Stock actuel"
              type="number"
              value={String(form.stock)}
              onChange={(value) => setForm({ ...form, stock: Number(value) })}
              testId="input-product-stock"
            />
            <Field
              label="Seuil"
              type="number"
              value={String(form.threshold)}
              onChange={(value) => setForm({ ...form, threshold: Number(value) })}
              testId="input-product-threshold"
            />
            <Field
              label="Prix unitaire"
              type="number"
              value={String(form.price)}
              onChange={(value) => setForm({ ...form, price: Number(value) })}
              testId="input-product-price"
            />
          </div>
          <div className="mt-6 flex justify-end">
            <ActionButton primary testId="button-save-product" onClick={save}>
              {modal === 'new' ? 'Créer le produit' : 'Enregistrer les modifications'}
            </ActionButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
function FinancePage({
  data,
  companyId,
}: {
  data: StoreData;
  companyId?: string;
  mutate?: (fn: (d: StoreData) => void, msg?: string) => void;
}) {
  const accountingEntries = companyId
    ? data.accountingEntries.filter((entry) => entry.companyId === companyId)
    : data.accountingEntries;
  return (
    <div className="space-y-5">
      <div className="mobile-stat-grid grid gap-4 md:grid-cols-2">
        <Metric
          label="Écritures comptables"
           value={String(accountingEntries.length)}
          detail="Journaux enregistrés"
          icon={FileText}
          accent
        />
        <Metric
          label="Débit total"
           value={shortMoney(accountingEntries.reduce((sum, entry) => sum + entry.debit, 0))}
          suffix=" FCFA"
          detail="Écritures comptables"
          icon={TrendingUp}
        />
        <Metric label="Crédit total" value={shortMoney(accountingEntries.reduce((sum, entry) => sum + entry.credit, 0))} suffix=" FCFA" detail="Écritures comptables" icon={CircleDollarSign} />
      </div>
      <section className="card-surface overflow-hidden rounded-2xl">
        <div className="border-b p-5">
          <h2 className="font-bold">Journal comptable</h2>
        </div>
        <DataTable
          headers={['Référence', 'Journal', 'Libellé', 'Débit', 'Crédit', 'Date', 'Statut']}
           rows={accountingEntries.map((entry) => [
            <strong key={entry.id}>{entry.reference}</strong>,
            entry.journal,
            entry.label,
            money(entry.debit),
            money(entry.credit),
            entry.date,
            <StatusBadge key={`${entry.id}-status`} status={entry.status} />,
          ])}
        />
      </section>
    </div>
  );
}
function CommercePage({
  data,
  mutate,
}: {
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
}) {
  const { confirm } = useAppDialog();
  const [modal, setModal] = useState<Sale | 'new' | null>(null);
  const [client, setClient] = useState('');
  const [amount, setAmount] = useState('');
  const open = (sale?: Sale) => {
    setModal(sale ?? 'new');
    setClient(sale?.client ?? '');
    setAmount(sale ? String(sale.amount) : '');
  };
  const validateSale = (sale: Sale) =>
    mutate((d) => {
      const s = d.sales.find((x) => x.id === sale.id);
      if (!s || s.status === 'VALIDÉ') return;
      s.status = 'VALIDÉ';
      s.items.forEach((item) => {
        const p = d.products.find((x) => x.id === item.productId);
        if (p) {
          p.stock -= item.quantity;
          d.movements.unshift({
            id: uid('m'),
            product: p.name,
            quantity: item.quantity,
            type: 'SORTIE',
            date: 'À l’instant',
            user: 'Aminata Diop',
            location: 'Boutique Dakar',
          });
        }
      });
      d.activities.unshift({
        id: uid('a'),
        user: 'Aminata Diop',
        action: 'a validé une vente',
        module: 'Commerce',
        object: sale.reference,
        date: 'À l’instant',
        status: 'VALIDÉ',
      });
    }, 'Vente validée et stock mis à jour.');
  const save = () => {
    if (!client.trim() || !amount || Number(amount) < 0) return;
    mutate(
      (d) => {
        if (modal !== 'new' && modal) {
          const target = d.sales.find((sale) => sale.id === modal.id);
          if (target) {
            target.client = client.trim();
            target.amount = Number(amount);
          }
        } else
          d.sales.unshift({
            id: uid('sale'),
            reference: `VTE-${Date.now().toString().slice(-6)}`,
            client: client.trim(),
            amount: Number(amount),
            status: 'BROUILLON',
            date: 'À l’instant',
            items: [],
          });
      },
      modal !== 'new' && modal ? 'Vente modifiée.' : 'Vente enregistrée en brouillon.',
    );
    setModal(null);
  };
  const remove = async (sale: Sale) => {
    if (
      !(await confirm({
        title: 'Supprimer ce brouillon ?',
        description: `Le brouillon ${sale.reference} sera supprimé.`,
        confirmLabel: 'Supprimer',
        tone: 'danger',
      }))
    )
      return;
    mutate((d) => {
      d.sales = d.sales.filter((item) => item.id !== sale.id);
    }, 'Vente supprimée.');
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          label="Chiffre d’affaires"
          value={shortMoney(data.sales.filter((s) => s.status === 'VALIDÉ').reduce((a, s) => a + s.amount, 0))}
          suffix=" FCFA"
          detail="ventes validées ce mois"
          icon={ShoppingCart}
          accent
        />
        <Metric
          label="Ventes du mois"
          value={String(data.sales.length)}
          detail="+8,4% vs. mois dernier"
          icon={TrendingUp}
        />
        <Metric
          label="Panier moyen"
          value={shortMoney(data.sales.length ? data.sales.reduce((a, s) => a + s.amount, 0) / data.sales.length : 0)}
          suffix=" FCFA"
          detail="sur les ventes enregistrées"
          icon={Store}
        />
      </div>
      <section className="card-surface overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="font-bold">Ventes</h2>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              Valider une vente met à jour le stock automatiquement.
            </p>
          </div>
          <ActionButton primary testId="button-add-sale" onClick={() => open()}>
            Nouvelle vente
          </ActionButton>
        </div>
        <DataTable
          headers={['Référence', 'Client', 'Montant', 'Date', 'Statut', 'Actions']}
          rows={data.sales.map((s) => [
            <strong>{s.reference}</strong>,
            s.client,
            money(s.amount),
            s.date,
            <StatusBadge status={s.status} />,
            s.status === 'BROUILLON' ? (
              <div className="flex flex-wrap gap-1">
                <button
                  data-testid={`button-edit-sale-${s.id}`}
                  aria-label={`Modifier la vente ${s.reference}`}
                  title="Modifier"
                  onClick={() => open(s)}
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold hover:bg-[hsl(var(--muted))]"
                >
                  <Settings size={13} />
                  <span>Modifier</span>
                </button>
                <button
                  data-testid={`button-delete-sale-${s.id}`}
                  aria-label={`Supprimer la vente ${s.reference}`}
                  title="Supprimer"
                  onClick={() => remove(s)}
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"
                >
                  <Trash2 size={13} />
                  <span>Supprimer</span>
                </button>
                <button
                  data-testid={`button-validate-sale-${s.id}`}
                  onClick={() => validateSale(s)}
                  className="rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-[10px] font-bold text-[hsl(var(--primary-foreground))]"
                >
                  Valider
                </button>
              </div>
            ) : (
              <Check size={16} className="text-[hsl(var(--primary))]" />
            ),
          ])}
        />
      </section>
      {modal && (
        <Modal title={modal === 'new' ? 'Nouvelle vente' : 'Modifier la vente'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <Field
              label="Client"
              value={client}
              onChange={setClient}
              placeholder="Nom du client"
              testId="input-sale-client"
            />
            <Field
              label="Montant (FCFA)"
              value={amount}
              onChange={setAmount}
              type="number"
              testId="input-sale-amount"
            />
          </div>
          <div className="mt-6 flex justify-end">
            <ActionButton primary testId="button-save-sale" onClick={save}>
              {modal === 'new' ? 'Enregistrer le brouillon' : 'Enregistrer les modifications'}
            </ActionButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
function RHPage({ data, companyId }: { data: StoreData; companyId: string }) {
  const units = data.orgNodes.filter((node) => node.companyId === companyId);
  const employees = data.employees.filter((employee) => employee.companyId === companyId);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
      <section className="card-surface rounded-2xl p-6">
        <h2 className="font-bold">Vue équipe</h2>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Répartition selon les unités réellement créées par l’entreprise.
        </p>
        <div className="mt-8 space-y-5">
          {units.map((unit) => {
            const count = employees.filter((employee) => employee.sectorId === unit.id).length;
            const width = employees.length ? Math.max((count / employees.length) * 100, count ? 8 : 0) : 0;
            return (
              <div key={unit.id}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-bold">{unit.name}</span>
                  <span className="mono text-xs text-[hsl(var(--muted-foreground))]">
                    {count} personne{count > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[hsl(var(--muted))]">
                  <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
          {units.length === 0 && (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
              Aucune unité n’a encore été créée par l’entreprise.
            </p>
          )}
        </div>
      </section>
      <section className="card-surface rounded-2xl p-6">
        <Users size={19} className="text-[hsl(var(--primary))]" />
        <h2 className="mt-5 font-bold">Effectif total</h2>
        <p className="mt-1 text-4xl font-bold">{employees.length}</p>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">collaborateurs enregistrés dans l’entreprise</p>
        <div className="mt-6 border-t pt-5 text-xs leading-6 text-[hsl(var(--muted-foreground))]">
          {employees.filter((employee) => employee.sectorId).length} employé(s) affecté(s) à une unité créée par
          l’entreprise.
        </div>
      </section>
    </div>
  );
}
function PresencesPage({ data, companyId, visibleFeatureIds, preview = false }: { data: StoreData; companyId: string; visibleFeatureIds?: string[]; preview?: boolean }) {
  const employees = data.employees.filter((employee) => employee.companyId === companyId);
  return (
    <PresenceModulePage
      companyId={companyId}
      employees={employees}
      nodes={data.orgNodes.filter((node) => node.companyId === companyId)}
      currentEmployee={null}
      canView
      canCreate={!preview}
      canEdit={!preview}
      canCorrect={!preview}
      canValidate={!preview}
      canManage={!preview}
      canGenerateQr={false}
      canExport
      canDelete={!preview}
      visibleFeatureIds={visibleFeatureIds}
      preview={preview}
    />
  );
}
function ReportsPage({ data }: { data: StoreData }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ReportCard
        title="Synthèse hebdomadaire"
        text="Ventes, encaissements, stocks et équipe sur les 7 derniers jours."
        date="Semaine du 12 au 18 juin"
      />
      <ReportCard
        title="État des stocks"
        text={`${data.products.filter((p) => p.stock <= p.threshold).length} références demandent votre attention.`}
        date="Actualisé aujourd’hui"
      />
      <ReportCard
        title="Performance commerciale"
        text="Une lecture des ventes validées et du panier moyen."
        date="Mois de juin 2024"
      />
      <ReportCard
        title="Rapport d’activité"
        text="L’historique des actions importantes de l’espace entreprise."
        date="Dernières 30 jours"
      />
    </div>
  );
}
function ReportCard({ title, text, date }: { title: string; text: string; date: string }) {
  return (
    <section data-testid={`card-report-${title}`} className="card-surface rounded-2xl p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]">
        <FileBarChart size={19} />
      </span>
      <h2 className="mt-5 font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{text}</p>
      <div className="mt-5 flex items-center justify-between border-t pt-4">
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{date}</span>
        <button
          data-testid={`button-open-report-${title}`}
          onClick={() => window.print()}
          className="text-xs font-bold text-[hsl(var(--primary))]"
        >
          Consulter <ChevronRight className="inline" size={14} />
        </button>
      </div>
    </section>
  );
}
function Modal({
  title,
  onClose,
  children,
  className = '',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--foreground)/.35)] backdrop-blur-sm">
      <div className={`modal-panel card-surface w-full max-w-4xl rounded-2xl p-6 fade-up ${className}`}>
        <div className="modal-header mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            data-testid="button-close-modal"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
function EmptyState({ title, text, action }: { title: string; text: string; action: () => void }) {
  return (
    <div className="card-surface flex flex-col items-center justify-center rounded-2xl px-6 py-20 text-center">
      <span className="rounded-2xl bg-[hsl(var(--muted))] p-4 text-[hsl(var(--muted-foreground))]">
        <FolderKanban size={24} />
      </span>
      <h2 className="mt-5 text-lg font-bold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">{text}</p>
      <button
        data-testid="button-empty-action"
        onClick={action}
        className="mt-6 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]"
      >
        Revenir au cockpit
      </button>
    </div>
  );
}

function InteractiveModulesPage({
  data,
  mutate,
  notify,
}: {
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
  notify: (message: string) => void;
}) {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const readSelectedModule = (value: string) => {
    const requested = new URLSearchParams(value).get('module');
    return requested && modules.some((module) => module.id === requested) ? (requested as ModuleId) : null;
  };
  const [selectedId, setSelectedId] = useState<ModuleId | null>(() => readSelectedModule(search));
  const pendingSelection = useRef<ModuleId | null | undefined>(undefined);
  const [editingModule, setEditingModule] = useState<(typeof modules)[number] | null>(null);
  const [deletingModule, setDeletingModule] = useState<(typeof modules)[number] | null>(null);
  const [moduleForm, setModuleForm] = useState({ name: '', description: '', features: '' });
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [packForm, setPackForm] = useState<ModulePackDraft>(() => emptyModulePackDraft());
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [testPack, setTestPack] = useState<ModuleFeaturePack | null>(null);
  const [testModule, setTestModule] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Toutes');
  const [statusFilter, setStatusFilter] = useState<'TOUTES' | 'ACTIFS' | 'INACTIFS'>('TOUTES');
  const catalog = getCatalogSnapshot(data);
  const moduleDefinitions = getConfiguredModules(catalog);
  useEffect(() => {
    const requested = readSelectedModule(search);
    if (pendingSelection.current !== undefined) {
      if (requested !== pendingSelection.current) return;
      pendingSelection.current = undefined;
    }
    setSelectedId(requested);
  }, [search]);
  const selectModule = (moduleId: ModuleId | null, replace = false) => {
    const url = new URL(window.location.href);
    if (moduleId) {
      url.searchParams.set('module', moduleId);
    } else {
      url.searchParams.delete('module');
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const historyState = {
      ...(window.history.state ?? {}),
      maximus: true,
      maximusIndex:
        typeof window.history.state?.maximusIndex === 'number'
          ? window.history.state.maximusIndex + (replace ? 0 : 1)
          : replace
            ? 0
            : 1,
    };
    pendingSelection.current = moduleId;
    setSelectedId(moduleId);
    setLocation(nextUrl, { replace, state: historyState });
  };
  const statusOf = (moduleId: ModuleId): ModuleAvailability =>
    catalog.removedModules.includes(moduleId)
      ? 'INACTIF'
      : (catalog.moduleStatuses[moduleId] ?? modules.find((module) => module.id === moduleId)?.status ?? 'INACTIF');
  const selected = selectedId ? (moduleDefinitions.find((module) => module.id === selectedId) ?? null) : null;
  const categories = ['Toutes', 'Commerce', 'Finance', 'Ressources humaines', 'Opérations'];
  const categoryOf = (moduleId: ModuleId) => {
    if (['commerce', 'ventes', 'achats', 'crm', 'fournisseurs', 'logistique'].includes(moduleId)) return 'Commerce';
    if (['finance', 'comptabilite', 'rapports'].includes(moduleId)) return 'Finance';
    if (['rh', 'presences', 'paie'].includes(moduleId)) return 'Ressources humaines';
    return 'Opérations';
  };
  const visibleModules = moduleDefinitions.filter((module) => {
    const matchesQuery = `${module.name} ${module.description} ${module.features.join(' ')}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    const matchesCategory = category === 'Toutes' || categoryOf(module.id) === category;
    const isActive = statusOf(module.id) !== 'INACTIF';
    const matchesStatus = statusFilter === 'TOUTES' || (statusFilter === 'ACTIFS' ? isActive : !isActive);
    return matchesQuery && matchesCategory && matchesStatus;
  });
  const activeCount = moduleDefinitions.filter((module) => statusOf(module.id) !== 'INACTIF').length;
  const betaCount = moduleDefinitions.filter((module) => statusOf(module.id) === 'BETA').length;

  const openEdit = (module: (typeof modules)[number]) => {
    setEditingModule(module);
    setModuleForm({ name: module.name, description: module.description, features: module.features.join('\n') });
    resetPackForm();
  };

  const saveModule = () => {
    if (!editingModule || !moduleForm.name.trim() || !moduleForm.description.trim()) return;
    const features = moduleForm.features
      .split(/[\n,]/)
      .map((feature) => feature.trim())
      .filter(Boolean);
    if (features.length === 0) return;
    const moduleForPack = { ...editingModule, features };
    const nextPack = packForm.name.trim()
      ? buildModulePack(moduleForPack, packForm, uid(`pack-${editingModule.id}`))
      : null;
    if (packForm.name.trim() && (!packForm.description.trim() || !nextPack)) return;
    mutate(
      (draft) => {
        updateCatalogDraft(draft, (catalogDraft) => {
          const currentOverride = catalogDraft.moduleOverrides[editingModule.id] ?? {};
          const nextOverride = {
            ...currentOverride,
            name: moduleForm.name.trim(),
            description: moduleForm.description.trim(),
            features,
          };
          if (nextPack) {
            const currentPacks =
              currentOverride.featurePacks ??
              modules.find((module) => module.id === editingModule.id)?.featurePacks ??
              [];
            nextOverride.featurePacks = [...currentPacks, nextPack];
          }
          catalogDraft.moduleOverrides = { ...catalogDraft.moduleOverrides, [editingModule.id]: nextOverride };
        });
      },
      packForm.name.trim()
        ? `${moduleForm.name.trim()} et son pack métier ont été enregistrés.`
        : `${moduleForm.name.trim()} a été modifié.`,
    );
    setEditingModule(null);
    resetPackForm();
  };

  const removeModule = (module: (typeof modules)[number]) => {
    mutate((draft) => {
      updateCatalogDraft(draft, (catalogDraft) => {
        catalogDraft.moduleStatuses = { ...catalogDraft.moduleStatuses, [module.id]: 'INACTIF' };
        catalogDraft.removedModules = [...new Set([...catalogDraft.removedModules, module.id])];
        catalogDraft.sectorPresets = catalogDraft.sectorPresets.map((preset) => ({
          ...preset,
          moduleIds: preset.moduleIds.filter((id) => id !== module.id),
          modulePackIds: Object.fromEntries(
            Object.entries(preset.modulePackIds ?? {}).filter(([moduleId]) => moduleId !== module.id),
          ),
          moduleFeatures: Object.fromEntries(
            Object.entries(preset.moduleFeatures ?? {}).filter(([moduleId]) => moduleId !== module.id),
          ),
        }));
      });
    }, `${module.name} sera retiré à la prochaine publication.`);
    if (selectedId === module.id) selectModule(null, true);
    setDeletingModule(null);
  };

  const toggleModule = (moduleId: ModuleId) => {
    const module = moduleDefinitions.find((item) => item.id === moduleId);
    if (!module) return;
    const isActive = statusOf(moduleId) !== 'INACTIF';
    mutate(
      (draft) => {
        updateCatalogDraft(draft, (catalogDraft) => {
          catalogDraft.moduleStatuses = {
            ...catalogDraft.moduleStatuses,
            [moduleId]: isActive ? 'INACTIF' : 'ACTIF',
          };
        });
      },
      isActive ? `${module.name} sera désactivé à la prochaine publication.` : `${module.name} sera activé à la prochaine publication.`,
    );
  };

  const resetPackForm = () => {
    setEditingPackId(null);
    setPackForm(emptyModulePackDraft());
  };

  const openPackEdit = (pack: ModuleFeaturePack) => {
    setEditingPackId(pack.id);
    const featurePermissions = defaultFeaturePermissions(pack.featureIds, pack.featurePermissions);
    setPackForm({
      name: pack.name,
      description: pack.description ?? '',
      featureIds: [...pack.featureIds],
      featurePermissions,
    });
    setPackDialogOpen(true);
  };

  const openPackCreate = () => {
    resetPackForm();
    setPackDialogOpen(true);
  };

  const closePackDialog = () => {
    setPackDialogOpen(false);
    resetPackForm();
  };

  const setPackFeaturePermission = (featureId: string, level: string) => {
    setPackForm((current) => updatePackPermission(current, featureId, level));
  };

  const savePack = () => {
    if (!selected || !packForm.name.trim() || !packForm.description.trim() || packForm.featureIds.length === 0) return;
    const nextPack = buildModulePack(selected, packForm, editingPackId ?? uid(`pack-${selected.id}`));
    if (!nextPack) return;
    mutate(
      (draft) => {
        updateCatalogDraft(draft, (catalogDraft) => {
          const current =
            catalogDraft.moduleOverrides[selected.id]?.featurePacks ??
            modules.find((module) => module.id === selected.id)?.featurePacks ??
            [];
          catalogDraft.moduleOverrides = {
            ...catalogDraft.moduleOverrides,
            [selected.id]: {
              ...(catalogDraft.moduleOverrides[selected.id] ?? {}),
              featurePacks: editingPackId
                ? current.map((pack) => (pack.id === editingPackId ? nextPack : pack))
                : [...current, nextPack],
            },
          };
        });
      },
      editingPackId ? 'Pack métier mis à jour.' : 'Pack métier créé.',
    );
    resetPackForm();
    setPackDialogOpen(false);
  };

  const deletePack = (packId: string) => {
    if (!selected) return;
    const referencedBySector = catalog.sectorPresets.some((preset) =>
      (preset.modulePackIds?.[selected.id] ?? []).includes(packId),
    );
    const referencedByUnit = data.orgNodes.some((node) =>
      (node.modulePackIds?.[selected.id] ?? []).includes(packId),
    );
    if (referencedBySector || referencedByUnit) {
      notify('Ce pack est utilisé par un secteur ou une unité. Modifiez d’abord ces configurations avant de le retirer.');
      return;
    }
    mutate((draft) => {
      updateCatalogDraft(draft, (catalogDraft) => {
        const current =
          catalogDraft.moduleOverrides[selected.id]?.featurePacks ??
          modules.find((module) => module.id === selected.id)?.featurePacks ??
          [];
        catalogDraft.moduleOverrides = {
          ...catalogDraft.moduleOverrides,
          [selected.id]: {
            ...(catalogDraft.moduleOverrides[selected.id] ?? {}),
            featurePacks: current.filter((pack) => pack.id !== packId),
          },
        };
      });
    }, 'Pack métier retiré du brouillon.');
    if (editingPackId === packId) resetPackForm();
  };

  if (selected && (testPack || testModule)) {
    return (
      <ModulePackTestWorkbench
        module={selected}
        pack={testPack ?? undefined}
        data={data}
        mutate={mutate}
        onBack={() => {
          setTestPack(null);
          setTestModule(false);
        }}
      />
    );
  }

  if (selected) {
    const status = statusOf(selected.id);
    const isActive = status !== 'INACTIF';
    return (
      <div className="space-y-5">
        <CatalogWorkflowBar data={data} mutate={mutate} />
        <button
          data-testid="button-back-modules"
          onClick={() => selectModule(null, true)}
          className="text-xs font-bold text-[hsl(var(--primary))]"
        >
          ← Retour au catalogue
        </button>
        <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
          <section className="card-surface rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              {(() => {
                const ModuleIcon = moduleIconById[selected.id] ?? LayoutGrid;
                return (
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]">
                    <ModuleIcon size={21} />
                  </span>
                );
              })()}
              <StatusBadge status={status} />
            </div>
            <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-2xl font-bold">{selected.name}</h2>
              <div className="flex gap-1">
                <button
                  data-testid={`button-edit-module-${selected.id}`}
                  title="Modifier le module"
                  onClick={() => openEdit(selected)}
                  className="rounded-lg border p-2 hover:bg-[hsl(var(--muted))]"
                >
                  <Edit3 size={15} />
                </button>
                <button
                  data-testid={`button-delete-module-${selected.id}`}
                  title="Supprimer le module"
                  onClick={() => setDeletingModule(selected)}
                  className="rounded-lg border p-2 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{selected.description}</p>
            <div className="mt-6 space-y-3 border-t pt-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--muted-foreground))]">Fonctionnalités</span>
                <strong>{selected.features.length}</strong>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-2">
              <button
                data-testid={`button-test-module-${selected.id}`}
                onClick={() => {
                  setTestPack(null);
                  setTestModule(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]"
              >
                Tester le module complet <ChevronRight size={14} />
              </button>
              <button
                data-testid={`button-detail-toggle-module-${selected.id}`}
                onClick={() => toggleModule(selected.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold ${isActive ? 'border border-[hsl(var(--destructive)/.35)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'}`}
              >
                {isActive ? 'Désactiver le module' : 'Activer le module'} <ChevronRight size={14} />
              </button>
            </div>
          </section>
          <section className="card-surface rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">
                  Configuration métier
                </p>
                <h2 className="mt-2 text-xl font-bold">Packs métiers du module</h2>
                <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                  Des packs Employé et Manager sont préconfigurés avec les fonctionnalités utiles de ce module.
                  Vous pouvez aussi créer, modifier ou supprimer vos propres packs selon votre organisation. Les
                  secteurs pourront ensuite les sélectionner.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Package size={19} className="text-[hsl(var(--primary))]" />
                <button
                  type="button"
                  data-testid={`button-add-role-pack-${selected.id}`}
                  onClick={openPackCreate}
                  className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-[10px] font-bold text-[hsl(var(--primary-foreground))] shadow-sm transition hover:opacity-90"
                >
                  <Plus size={14} />
                  Ajouter un pack de rôle
                </button>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {(selected.featurePacks ?? []).map((pack) => (
                <div
                  data-testid={`row-module-pack-${selected.id}-${pack.id}`}
                  key={pack.id}
                  className="rounded-xl border p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <strong className="text-sm">{pack.name}</strong>
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        {pack.description || 'Aucune description.'}
                      </p>
                      <p className="mt-2 text-[10px] font-semibold text-[hsl(var(--primary))]">
                        {pack.featureIds.length} fonctionnalité(s) avec droits configurés
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        data-testid={`button-test-module-pack-${pack.id}`}
                        onClick={() => setTestPack(pack)}
                        className="rounded-lg bg-[hsl(var(--primary))] px-2.5 py-2 text-[10px] font-bold text-[hsl(var(--primary-foreground))]"
                      >
                        Tester le pack
                      </button>
                      <button
                        type="button"
                        data-testid={`button-edit-module-pack-${pack.id}`}
                        onClick={() => openPackEdit(pack)}
                        className="rounded-lg p-2 text-xs font-bold hover:bg-[hsl(var(--muted))]"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        data-testid={`button-delete-module-pack-${pack.id}`}
                        onClick={() => deletePack(pack.id)}
                        className="rounded-lg p-2 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {(selected.featurePacks ?? []).length === 0 && (
                <p className="rounded-xl border border-dashed p-5 text-xs text-[hsl(var(--muted-foreground))]">
                  Aucun pack métier n’est encore configuré pour ce module.
                </p>
              )}
            </div>
          </section>
        </div>
        {packDialogOpen && (
          <Modal
            title={`${editingPackId ? 'Modifier' : 'Ajouter'} un pack de rôle`}
            onClose={closePackDialog}
            className="max-h-[86vh] w-[min(94vw,1120px)] max-w-[1120px] overflow-y-auto sm:p-8"
          >
            <div className="space-y-5">
              <div className="rounded-xl bg-[hsl(var(--muted)/.45)] p-4">
                <p className="text-xs font-bold text-[hsl(var(--primary))]">{selected.name}</p>
                <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                  Définissez un modèle de rôle réutilisable et choisissez les droits accordés à chaque fonctionnalité.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Nom du pack"
                  value={packForm.name}
                  onChange={(value) => setPackForm((current) => ({ ...current, name: value }))}
                  placeholder="Ex. Gestionnaire de stock"
                  testId="input-module-pack-name"
                />
                <Field
                  label="Description"
                  value={packForm.description}
                  onChange={(value) => setPackForm((current) => ({ ...current, description: value }))}
                  placeholder="À quoi sert ce pack ?"
                  testId="input-module-pack-description"
                />
              </div>
              <div className="overflow-hidden rounded-xl border">
                <div className="border-b bg-[hsl(var(--muted)/.45)] px-4 py-3">
                  <p className="text-xs font-bold">Droits par fonctionnalité</p>
                  <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                    Une fonctionnalité non incluse ne sera pas transmise au rôle.
                  </p>
                </div>
                <div className="max-h-[44vh] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-[hsl(var(--card))] text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                      <tr>
                        <th className="px-4 py-3 font-bold">Fonctionnalité</th>
                        <th className="px-4 py-3 text-right font-bold">Niveau d’accès</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {getModuleFeatureOptions(selected).map((feature) => (
                        <tr key={feature.id} className="transition hover:bg-[hsl(var(--muted)/.3)]">
                          <td className="px-4 py-3">
                            <span className="font-semibold">{feature.label}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <select
                              data-testid={`select-pack-permission-${selected.id}-${feature.id}`}
                              value={permissionLevelFor(packForm.featurePermissions[feature.id])}
                              onChange={(event) => setPackFeaturePermission(feature.id, event.target.value)}
                              className="rounded-md border bg-[hsl(var(--card))] px-2 py-2 text-[10px] font-semibold"
                            >
                              <option value="none">Non incluse</option>
                              <option value="view">Voir seulement</option>
                              <option value="create">Voir et créer</option>
                              <option value="edit">Voir, créer et modifier</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={closePackDialog}
                  className="rounded-lg border px-4 py-2.5 text-xs font-bold hover:bg-[hsl(var(--muted))]"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  data-testid="button-save-module-pack"
                   disabled={!packForm.name.trim() || !packForm.description.trim() || packForm.featureIds.length === 0}
                  onClick={savePack}
                  className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {editingPackId ? 'Mettre à jour' : 'Créer le pack'}
                </button>
              </div>
            </div>
          </Modal>
        )}
        {editingModule && (
          <Modal
            title="Modifier le module"
            onClose={() => {
              setEditingModule(null);
              resetPackForm();
            }}
          >
            <div className="space-y-4">
              <Field
                label="Nom du module"
                value={moduleForm.name}
                onChange={(value) => setModuleForm((current) => ({ ...current, name: value }))}
                testId="input-module-name"
              />
              <Field
                label="Description"
                value={moduleForm.description}
                onChange={(value) => setModuleForm((current) => ({ ...current, description: value }))}
                testId="input-module-description"
              />
              <label className="block text-sm font-semibold">
                Fonctionnalités
                <textarea
                  data-testid="input-module-features"
                  value={moduleForm.features}
                  onChange={(event) => setModuleForm((current) => ({ ...current, features: event.target.value }))}
                  placeholder="Une fonctionnalité par ligne"
                  rows={5}
                  className="mt-2 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3.5 py-3 text-sm font-normal focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.14)]"
                />
              </label>
              <p className="rounded-lg bg-[hsl(var(--muted))] p-3 text-xs text-[hsl(var(--muted-foreground))]">
                Les fonctionnalités peuvent être séparées par des lignes ou des virgules.
              </p>
              <ModulePackDraftForm
                module={{
                  ...editingModule,
                  features: moduleForm.features
                    .split(/[\n,]/)
                    .map((feature) => feature.trim())
                    .filter(Boolean),
                }}
                packForm={packForm}
                onChange={setPackForm}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingModule(null);
                    resetPackForm();
                  }}
                  className="rounded-lg border px-4 py-2.5 text-xs font-bold"
                >
                  Annuler
                </button>
                <ActionButton primary testId="button-save-module" onClick={saveModule}>
                  Enregistrer les modifications
                </ActionButton>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <CatalogWorkflowBar data={data} mutate={mutate} />
      <section className="card-surface rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">
              Catalogue des modules
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-.03em]">Vos modules métier</h2>
            <p className="mt-2 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
              Chaque module est une capacité métier partagée. Activez uniquement celles dont vos entreprises ont besoin.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <div className="rounded-xl bg-[hsl(var(--muted)/.65)] px-4 py-3">
              <p className="mono text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Actives</p>
              <p className="mt-1 text-xl font-bold">
                {activeCount}
                <span className="ml-1 text-xs font-normal text-[hsl(var(--muted-foreground))]">/ {modules.length}</span>
              </p>
            </div>
            <div className="rounded-xl bg-[hsl(var(--muted)/.65)] px-4 py-3">
              <p className="mono text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Bêta</p>
              <p className="mt-1 text-xl font-bold">{betaCount}</p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 border-t pt-5 xl:flex-row xl:items-center">
          <label className="relative block flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
              size={16}
            />
            <input
              data-testid="input-search-modules"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une application..."
              className="w-full rounded-xl border bg-transparent py-3 pl-10 pr-3 text-sm outline-none focus:border-[hsl(var(--primary))]"
            />
          </label>
          <div className="flex shrink-0 rounded-xl bg-[hsl(var(--muted)/.65)] p-1">
            {(['TOUTES', 'ACTIFS', 'INACTIFS'] as const).map((filter) => (
              <button
                type="button"
                data-testid={`button-filter-modules-${filter.toLowerCase()}`}
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition ${statusFilter === filter ? 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`}
              >
                {filter === 'TOUTES' ? 'Toutes' : filter === 'ACTIFS' ? 'Actives' : 'Inactives'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              type="button"
              data-testid={`button-category-modules-${item.toLowerCase().replace(/\s+/g, '-')}`}
              key={item}
              onClick={() => setCategory(item)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${category === item ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/.5)]'}`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm font-semibold">
          {visibleModules.length} application{visibleModules.length > 1 ? 's' : ''} affichée
          {visibleModules.length > 1 ? 's' : ''}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Cliquez sur une application pour voir ses détails et la tester.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visibleModules.map((module, index) => {
          const status = statusOf(module.id);
          const isActive = status !== 'INACTIF';
          const ModuleIcon = moduleIconById[module.id] ?? LayoutGrid;
          return (
            <article
              data-testid={`card-module-${module.id}`}
              key={module.id}
              className={`card-surface group relative flex min-h-[180px] flex-col rounded-2xl p-4 text-center transition hover:-translate-y-1 hover:border-[hsl(var(--primary)/.45)] hover:shadow-lg fade-up fade-up-delay-${Math.min(index + 1, 3)} ${isActive ? '' : 'opacity-65'}`}
            >
              <button
                type="button"
                data-testid={`button-open-module-${module.id}`}
                onClick={() => selectModule(module.id)}
                aria-label={`Ouvrir l’application ${module.name}`}
                className="flex flex-1 flex-col items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
              >
                <span
                  className={`absolute right-3 top-3 h-2 w-2 rounded-full ${isActive ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted-foreground)/.45)]'}`}
                  title={isActive ? 'Application active' : 'Application inactive'}
                />
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] transition group-hover:scale-105">
                  <ModuleIcon size={25} />
                </span>
                <span className="mt-4 line-clamp-2 text-sm font-bold leading-5">{module.name}</span>
                <span className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{categoryOf(module.id)}</span>
                <span className="mt-2 line-clamp-3 text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">{module.description}</span>
              </button>
              <div className="mt-3 flex justify-center gap-1 border-t pt-3">
                <button
                  type="button"
                  data-testid={`button-edit-module-${module.id}`}
                  title="Modifier le module"
                  onClick={() => openEdit(module)}
                  className="rounded-lg p-2 text-xs hover:bg-[hsl(var(--muted))]"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  type="button"
                  data-testid={`button-delete-module-${module.id}`}
                  title="Supprimer le module"
                  onClick={() => setDeletingModule(module)}
                  className="rounded-lg p-2 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.08)]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          );
        })}
        {visibleModules.length === 0 && (
          <div className="card-surface col-span-full rounded-2xl p-10 text-center">
            <Package className="mx-auto text-[hsl(var(--muted-foreground))]" size={28} />
            <h2 className="mt-4 font-bold">Aucune application trouvée</h2>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Modifiez votre recherche ou réinitialisez les filtres.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCategory('Toutes');
                setStatusFilter('TOUTES');
              }}
              className="mt-4 text-xs font-bold text-[hsl(var(--primary))]"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>
      {deletingModule && (
        <Modal title="Confirmer la suppression" onClose={() => setDeletingModule(null)}>
          <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            Voulez-vous vraiment supprimer le module{' '}
            <strong className="text-[hsl(var(--foreground))]">{deletingModule.name}</strong> ? Il sera retiré du
            catalogue et désactivé pour tous les espaces.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              data-testid="button-cancel-delete-module"
              onClick={() => setDeletingModule(null)}
              className="rounded-lg border px-4 py-2.5 text-xs font-bold"
            >
              Annuler
            </button>
            <button
              type="button"
              data-testid="button-confirm-delete-module"
              onClick={() => removeModule(deletingModule)}
              className="rounded-lg bg-[hsl(var(--destructive))] px-4 py-2.5 text-xs font-bold text-white"
            >
              Supprimer le module
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ModulePackTestWorkbench({
  module,
  pack,
  data,
  mutate,
  onBack,
}: {
  module: (typeof modules)[number];
  pack?: ModuleFeaturePack;
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
  onBack: () => void;
}) {
  const operationalModules: ModuleId[] = [
    'achats',
    'comptabilite',
    'paie',
    'crm',
    'fournisseurs',
    'logistique',
    'documents',
  ];
  const previewCompany = data.companies[0];
  const previewCompanyId = previewCompany?.id ?? '';
  const featureOptions = getModuleFeatureOptions(module);
  const fullFeatureIds = featureOptions.map((feature) => feature.id);
  const testFeatureIds = pack
    ? fullFeatureIds.filter((featureId) => pack.featureIds.includes(featureId))
    : fullFeatureIds;
  const configuredPermissions = pack
    ? defaultFeaturePermissions(testFeatureIds, pack.featurePermissions)
    : defaultFeaturePermissions(
        fullFeatureIds,
        Object.fromEntries(fullFeatureIds.map((featureId) => [featureId, ['voir', 'créer', 'modifier']])),
      );
  const authorizedFeatures = testFeatureIds.filter((featureId) => configuredPermissions[featureId]?.length);
  const featureLabelById = new Map(featureOptions.map((feature) => [feature.id, feature.label]));
  const canCreate = authorizedFeatures.some((featureId) => configuredPermissions[featureId]?.includes('créer'));
  const canModify = authorizedFeatures.some((featureId) => configuredPermissions[featureId]?.includes('modifier'));
  const stockPermissions = Object.fromEntries(
    authorizedFeatures.map((featureId) => [featureId, configuredPermissions[featureId] ?? ['voir']]),
  );
  const commerceFeatureToTab: Record<string, CommerceTabId> = {
    clients: 'clients',
    sales: 'sales',
    products: 'products',
    suppliers: 'suppliers',
    purchases: 'purchases',
    expenses: 'expenses',
    cash: 'cash',
    credit: 'credit',
    invoices: 'invoices',
    returns: 'returns',
    reports: 'reports',
    activity: 'activity',
    team: 'team',
    settings: 'settings',
    devis: 'sales',
    commandes: 'sales',
    facturation: 'invoices',
  };
  const allowedCommerceTabs = authorizedFeatures
    .map((featureId) => commerceFeatureToTab[featureId])
    .filter((tab): tab is CommerceTabId => Boolean(tab));
  const commerceTabPermissions = allowedCommerceTabs.reduce<Partial<Record<CommerceTabId, string[]>>>((all, tab) => {
    const permissions = authorizedFeatures
      .filter((featureId) => commerceFeatureToTab[featureId] === tab)
      .flatMap((featureId) => configuredPermissions[featureId] ?? []);
    all[tab] = [...new Set(permissions)];
    return all;
  }, {});
  return (
    <div data-testid="module-pack-workbench" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          data-testid="button-back-pack-test"
          onClick={onBack}
          className="text-xs font-bold text-[hsl(var(--primary))]"
        >
          ← Retour au module
        </button>
        <span className="rounded-full bg-[hsl(var(--accent)/.2)] px-3 py-1.5 text-[10px] font-bold">
          {pack ? 'TEST DU PACK MÉTIER' : 'TEST DU MODULE COMPLET'}
        </span>
      </div>
      <section className="card-surface rounded-2xl p-5">
        <div className="border-b pb-4">
          <p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Aperçu fonctionnel</p>
          <h2 className="mt-2 text-xl font-bold">
            {module.name}
            {pack ? ` avec le pack « ${pack.name} »` : ''}
          </h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {pack
              ? 'Les mêmes écrans que ceux utilisés par une entreprise sont ouverts avec le périmètre et les droits de ce pack.'
              : 'Le parcours complet du module est ouvert avec toutes ses fonctionnalités.'}
          </p>
        </div>
        <div className="mt-4 rounded-xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary)/.06)] px-4 py-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
          Aperçu administratif isolé : les données de production ne sont pas sollicitées et les actions d’écriture sont désactivées.
        </div>
        <div className="mt-4 rounded-xl border bg-[hsl(var(--muted)/.18)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold">Périmètre testé</p>
              <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                Seules les fonctionnalités autorisées par ce pack sont affichées ci-dessous.
              </p>
            </div>
            <span className="rounded-full border px-2.5 py-1 text-[10px] font-bold">
              {authorizedFeatures.length} fonctionnalité{authorizedFeatures.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {authorizedFeatures.map((featureId) => (
              <span key={featureId} className="rounded-lg border bg-[hsl(var(--card))] px-2.5 py-1.5 text-[10px] font-semibold">
                {featureLabelById.get(featureId) ?? featureId}
                <span className="ml-1.5 text-[hsl(var(--muted-foreground))]">
                  · {(configuredPermissions[featureId] ?? []).join(' · ')}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="mt-5">
          {module.id === 'stocks' && (
            <StockModulePage
              companyId={previewCompanyId || 'module-preview'}
              stockPermissions={stockPermissions}
              canCreate={false}
              canModify={false}
              preview
            />
          )}
          {(module.id === 'commerce' || module.id === 'ventes') && (
            <CommerceModulePage
              companyId={previewCompanyId}
              data={data}
              mutate={mutate}
              tabPermissions={commerceTabPermissions}
              allowedTabs={allowedCommerceTabs}
              initialTab={allowedCommerceTabs[0] ?? (module.id === 'ventes' ? 'sales' : 'dashboard')}
            />
          )}
           {module.id === 'finance' && <FinancePage data={data} />}
          {module.id === 'rh' && previewCompany && (
            <CompanyOrganizationAdmin company={previewCompany} data={data} mutate={mutate} />
          )}
            {module.id === 'presences' && <PresencesPage data={data} companyId={previewCompanyId} visibleFeatureIds={authorizedFeatures} preview />}
            {module.id === 'paie' && <PayrollModulePage companyId={previewCompanyId || 'module-preview'} employees={[]} canCreate={false} canModify={false} visibleFeatureIds={authorizedFeatures} preview />}
           {module.id === 'ecommerce' && (
             <EcommerceModulePage
               companyId={previewCompanyId || 'module-preview'}
               canCreate={false}
               canModify={false}
                allowedFeatureIds={authorizedFeatures}
               preview
             />
           )}
          {module.id === 'transport' && (
            <TransportModulePage
              companyId={previewCompanyId || 'module-preview'}
              canCreate={false}
              canModify={false}
              preview
            />
          )}
          {module.id === 'immobilier' && (
            <ImmobilierModulePage
              companyId={previewCompanyId || 'module-preview'}
              canCreate={false}
              canModify={false}
              featurePermissions={configuredPermissions}
              preview
            />
          )}
          {module.id === 'amicales' && (
            <AmicaleModulePage
              companyId={previewCompanyId || 'module-preview'}
              canCreate={false}
              canModify={false}
              allowedFeatureIds={authorizedFeatures}
              featurePermissions={configuredPermissions}
              preview
            />
          )}
          {operationalModules.includes(module.id) && module.id !== 'paie' && (
            <OperationalModulePage
              moduleId={module.id}
              data={data}
              mutate={mutate}
              featurePermissions={configuredPermissions}
            />
          )}
          {module.id === 'rapports' && <OperationalReportsPage data={data} />}
          {!['stocks', 'commerce', 'ventes', 'ecommerce', 'transport', 'immobilier', 'amicales', 'finance', 'rh', 'presences', 'paie', 'rapports', ...operationalModules].includes(
            module.id,
          ) && (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              L’aperçu de ce module sera disponible quand son écran métier sera connecté.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function OperationalReportsPage({
  data,
  companyId,
  reportPermissions,
  canExport,
}: {
  data: StoreData;
  companyId?: string;
  reportPermissions?: Partial<Record<'sales' | 'stock' | 'finance' | 'activity', boolean>>;
  canExport?: boolean;
}) {
  type ReportId = 'sales' | 'stock' | 'finance' | 'activity';
  const [report, setReport] = useState<ReportId>('sales');
  const [query, setQuery] = useState('');
  const scoped = <T extends { companyId?: string }>(items: T[]) =>
    companyId ? items.filter((item) => item.companyId === companyId) : items;
  const definitions: Record<ReportId, { label: string; description: string; headers: string[]; rows: string[][] }> = {
    sales: {
      label: 'Ventes',
      description: 'Chiffre d’affaires et commandes clients.',
      headers: ['Référence', 'Client', 'Montant', 'Statut', 'Date'],
       rows: scoped(data.sales).map((item) => [item.reference, item.client, money(item.amount), item.status, item.date]),
    },
    stock: {
      label: 'Gestion de stock',
      description: 'Valorisation et niveaux des produits.',
      headers: ['Produit', 'SKU', 'Catégorie', 'Stock', 'Valeur'],
       rows: scoped(data.products).map((item) => [
        item.name,
        item.sku,
        item.category,
        String(item.stock),
        money(item.stock * item.price),
      ]),
    },
    finance: {
      label: 'Finance',
      description: 'Écritures comptables enregistrées.',
      headers: ['Référence', 'Journal', 'Libellé', 'Débit', 'Crédit', 'Date'],
       rows: scoped(data.accountingEntries).map((item) => [item.reference, item.journal, item.label, money(item.debit), money(item.credit), item.date]),
    },
    activity: {
      label: 'Activité',
      description: 'Traçabilité des actions réalisées.',
      headers: ['Utilisateur', 'Action', 'Module', 'Objet', 'Date'],
       rows: scoped(data.activities).map((item) => [item.user, item.action, item.module, item.object, item.date]),
    },
  };
  const visibleDefinitions = (Object.entries(definitions) as [ReportId, typeof definitions[ReportId]][])
    .filter(([id]) => reportPermissions?.[id] !== false);
  const activeReport = visibleDefinitions.some(([id]) => id === report) ? report : visibleDefinitions[0]?.[0];
  if (!activeReport) {
    return (
      <section className="card-surface rounded-2xl p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Aucun rapport n’est autorisé pour votre rôle.
      </section>
    );
  }
  const active = definitions[activeReport];
  const rows = active.rows.filter((row) => row.join(' ').toLowerCase().includes(query.toLowerCase()));
  const exportCsv = () => {
    if (!canExport) return;
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = [active.headers, ...rows].map((row) => row.map(escape).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
     link.download = `rapport-${activeReport}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {visibleDefinitions.map(([id, item]) => (
          <button
            key={id}
            onClick={() => setReport(id)}
            className={`card-surface rounded-2xl p-5 text-left transition ${report === id ? 'ring-2 ring-[hsl(var(--primary))]' : 'hover:-translate-y-0.5'}`}
          >
            <FileBarChart size={18} className="text-[hsl(var(--primary))]" />
            <p className="mt-4 font-bold">{item.label}</p>
            <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{item.description}</p>
          </button>
        ))}
      </div>
      <section className="card-surface overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold">Rapport {active.label}</h2>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {rows.length} lignes calculées depuis les données de l’entreprise.
            </p>
          </div>
          <div className="flex gap-2">
             {canExport && (
               <>
                 <button onClick={() => window.print()} className="rounded-lg border px-4 py-2.5 text-xs font-bold">
                   Imprimer
                 </button>
                 <button
                   onClick={exportCsv}
                   className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]"
                 >
                   Exporter CSV
                 </button>
               </>
             )}
          </div>
        </div>
        <div className="p-5">
          <label className="relative block max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
              size={15}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrer le rapport..."
              className="w-full rounded-lg border bg-transparent py-2.5 pl-9 pr-3 text-sm"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[hsl(var(--muted)/.55)] text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              <tr>
                {active.headers.map((header) => (
                  <th key={header} className="px-4 py-3">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, index) => (
                <tr key={`${report}-${index}`} className="hover:bg-[hsl(var(--muted)/.35)]">
                  {row.map((cell, cellIndex) => (
                    <td key={`${cellIndex}-${cell}`} className="px-4 py-3">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={active.headers.length}
                    className="px-4 py-12 text-center text-[hsl(var(--muted-foreground))]"
                  >
                    Aucune donnée pour ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function HumanResourcesWorkspace({
  data,
  mutate,
  companyAdmin,
  employee,
  companyId,
}: {
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
  companyAdmin: boolean;
  employee: StoreData['employees'][number] | null;
  companyId: string;
}) {
  const company = data.companies.find((item) => item.id === companyId);
  if (companyAdmin && company) return <CompanyOrganizationAdmin company={company} data={data} mutate={mutate} />;
  return <RHPage data={data} companyId={companyId} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfirmDialogProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AppContent />
          </WouterRouter>
        </TooltipProvider>
      </ConfirmDialogProvider>
    </QueryClientProvider>
  );
}

function AdminCreateCompanyPage({
  data,
  mutate,
  onComplete,
  onCancel,
}: {
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const fallbackPreset: SectorPreset = {
    id: 'default',
    name: 'Distribution',
    moduleIds: ['commerce', 'stocks', 'presences'],
  };
  const catalog = getCatalogSnapshot(data);
  const availableSectorPresets = catalog.sectorPresets.length > 0 ? catalog.sectorPresets : [fallbackPreset];
  const initialPreset = fallbackPreset;
  const [name, setName] = useState('');
  const [manager, setManager] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Sénégal');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [sector, setSector] = useState('');
  const [selectedModules, setSelectedModules] = useState<ModuleId[]>([...initialPreset.moduleIds]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const changeSector = (nextSector: string) => {
    const preset = availableSectorPresets.find((item) => item.name === nextSector);
    setSector(nextSector);
    setSelectedModules(preset ? [...preset.moduleIds] : [...initialPreset.moduleIds]);
    setError('');
  };

  const toggle = (id: ModuleId) => {
    setSelectedModules((previous) =>
      previous.includes(id) ? previous.filter((moduleId) => moduleId !== id) : [...previous, id],
    );
    setError('');
  };
  const save = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (
      !name.trim() ||
      !manager.trim() ||
      !normalizedEmail ||
      !country.trim() ||
      password.length < 8 ||
       password !== passwordConfirm
    ) {
      setError('Complétez les informations de l’entreprise et vérifiez le mot de passe.');
      return;
    }
    if (selectedModules.length === 0) {
      setError('Sélectionnez au moins un module.');
      return;
    }
    if (data.companies.some((company) => company.email.toLowerCase() === normalizedEmail)) {
      setError('Une entreprise utilise déjà cette adresse email.');
      return;
    }
    setSaving(true);
    try {
      const preset = availableSectorPresets.find((item) => item.name === sector);
       await companyRequestApi.createAdministrative({
        name: name.trim(),
        manager: manager.trim(),
        email: normalizedEmail,
        password,
        phone: phone.trim(),
        country: country.trim(),
        sector,
        requestedModules: [...selectedModules],
        requestedModulePackIds: Object.fromEntries(
          Object.entries(preset?.modulePackIds ?? {})
            .filter(([moduleId]) => selectedModules.includes(moduleId as ModuleId))
            .map(([moduleId, packIds]) => [moduleId, [...(packIds ?? [])]]),
        ),
      });
      onComplete();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'La synchronisation des modules a échoué.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <section className="card-surface rounded-2xl p-6 sm:p-8">
        <div className="mb-8">
          <p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">
            Création administrative
          </p>
          <h2 className="mt-3 text-2xl font-bold">Nouvelle entreprise</h2>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
             Cette entreprise sera créée et activée immédiatement par l’administration MAXIMUS.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Nom de l’entreprise"
            value={name}
            onChange={setName}
            placeholder="Ex. votre entreprise"
            testId="input-admin-company-name"
          />
          <Field
            label="Responsable"
            value={manager}
            onChange={setManager}
            placeholder="Prénom Nom"
            testId="input-admin-company-manager"
          />
          <Field
            label="Email administrateur"
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="admin@entreprise.com"
            testId="input-admin-company-email"
          />
          <Field
            label="Téléphone"
            value={phone}
            onChange={setPhone}
            placeholder="+221 77 000 00 00"
            testId="input-admin-company-phone"
          />
          <Field
            label="Pays"
            value={country}
            onChange={setCountry}
            placeholder="Sénégal"
            testId="input-admin-company-country"
          />
           <label className="block text-sm font-semibold">
             Secteur <span className="font-normal text-[hsl(var(--muted-foreground))]">(facultatif)</span>
            <select
              data-testid="select-admin-company-sector"
              value={sector}
              onChange={(event) => changeSector(event.target.value)}
              className="mt-2 w-full rounded-lg border bg-transparent px-3 py-3 text-sm font-normal"
            >
               <option value="">Aucun secteur — configurer manuellement</option>
              {availableSectorPresets.map((preset) => (
                <option key={preset.id} value={preset.name}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Mot de passe administrateur"
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="Au moins 8 caractères"
            testId="input-admin-company-password"
          />
          <Field
            label="Confirmer le mot de passe"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            type="password"
            placeholder="Répétez le mot de passe"
            testId="input-admin-company-password-confirm"
          />
        </div>
        <div className="mt-8 rounded-xl border border-dashed p-4 text-sm text-[hsl(var(--muted-foreground))]">
          L’organisation sera configurée après la création de l’entreprise. MAXIMUS ou l’entreprise pourra créer ses propres types d’unités, puis construire sa hiérarchie depuis la page Organisation.
        </div>
        <div className="mt-8 border-t pt-6">
          <h3 className="font-bold">Modules autorisés</h3>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Ces modules seront accessibles dès la première connexion.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {modules.map((module) => (
              <button
                type="button"
                data-testid={`button-admin-module-${module.id}`}
                key={module.id}
                onClick={() => toggle(module.id)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left ${selectedModules.includes(module.id) ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.06)]' : 'border-[hsl(var(--border))]'}`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border ${selectedModules.includes(module.id) ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))]'}`}
                >
                  {selectedModules.includes(module.id) && <Check size={13} />}
                </span>
                <span>
                  <strong className="block text-sm">{module.name}</strong>
                  <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{module.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p
            data-testid="admin-create-error"
            className="mt-5 rounded-lg bg-[hsl(var(--destructive)/.08)] px-3 py-2 text-xs font-semibold text-[hsl(var(--destructive))]"
          >
            {error}
          </p>
        )}
        <div className="mt-8 flex justify-end gap-3">
          <button
            data-testid="button-cancel-admin-company"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border px-5 py-3 text-sm font-bold"
          >
            Annuler
          </button>
          <button
            data-testid="button-save-admin-company"
            onClick={save}
            disabled={saving}
            className="btn rounded-lg bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]"
          >
            {saving ? 'Synchronisation…' : 'Créer l’entreprise'}
          </button>
        </div>
      </section>
    </div>
  );
}

const permissionActions = [
  { id: 'voir', label: 'Voir' },
  { id: 'créer', label: 'Créer' },
  { id: 'modifier', label: 'Modifier' },
] as const;

function normalizeFeaturePermissionMap(value: unknown): FeaturePermissionMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, permissions]) => Array.isArray(permissions))
      .map(([featureId, permissions]) => [
        featureId,
        [...new Set((permissions as unknown[]).filter((permission): permission is string => typeof permission === 'string'))],
      ]),
  );
}

function selectedFeaturePermissions(
  featureIds: string[],
  preferred: FeaturePermissionMap,
  fallback: FeaturePermissionMap = {},
): FeaturePermissionMap {
  return Object.fromEntries(
    featureIds.map((featureId) => [
      featureId,
      preferred[featureId] !== undefined
        ? [...preferred[featureId]!]
        : fallback[featureId] !== undefined
          ? [...fallback[featureId]!]
          : ['voir'],
    ]),
  );
}

function CompanyModulesDetail({
  company,
  data,
  mutate,
  onModuleAccess,
  onBack,
}: {
  company: Company;
  data: StoreData;
  mutate: (fn: (d: StoreData) => void, msg?: string) => void;
   onModuleAccess: (
     companyId: string,
     moduleId: ModuleId,
     status: ModuleAvailability,
     options?: { featureIds?: string[]; configuration?: Record<string, unknown> },
   ) => Promise<void>;
  onBack: () => void;
}) {
  const { confirm } = useAppDialog();
  const { onSaved: onNavigationSaved } = useContext(NavigationSettingsContext);
  const publicSiteGate = useAuthorizationGate({
    resetKey: company.id,
    confirm,
    onError: (error) => showAppToast(error instanceof Error ? error.message : 'La modification n’a pas pu être enregistrée.', 'error'),
  });
  const loginGate = useAuthorizationGate({
    resetKey: company.id,
    confirm,
    onError: (error) => showAppToast(error instanceof Error ? error.message : 'La modification n’a pas pu être enregistrée.', 'error'),
  });
  const domainGate = useAuthorizationGate({
    resetKey: company.id,
    confirm,
    onError: (error) => showAppToast(error instanceof Error ? error.message : 'La modification n’a pas pu être enregistrée.', 'error'),
  });
  const navigationGate = useAuthorizationGate({
    resetKey: company.id,
    confirm,
    onError: (error) => showAppToast(error instanceof Error ? error.message : 'La modification n’a pas pu être enregistrée.', 'error'),
  });
  const workspaceGate = useAuthorizationGate({
    resetKey: company.id,
    confirm,
    onError: (error) => showAppToast(error instanceof Error ? error.message : 'La modification n’a pas pu être enregistrée.', 'error'),
  });
  const notificationGate = useAuthorizationGate({
    resetKey: company.id,
    confirm,
    onError: (error) => showAppToast(error instanceof Error ? error.message : 'La modification n’a pas pu être enregistrée.', 'error'),
  });
  const paymentGate = useAuthorizationGate({
    resetKey: company.id,
    confirm,
    onError: (error) => showAppToast(error instanceof Error ? error.message : 'La modification n’a pas pu être enregistrée.', 'error'),
  });
  const modulesGate = useAuthorizationGate({
    resetKey: company.id,
    confirm,
    onError: (error) => showAppToast(error instanceof Error ? error.message : 'La modification n’a pas pu être enregistrée.', 'error'),
  });
  const askAuthorizationSave = (
    _gate: ReturnType<typeof useAuthorizationGate>,
    _description: string,
    action: () => Promise<boolean | void> | boolean | void,
  ) => action();
  const configuredModules = getConfiguredModules({
    moduleOverrides: data.moduleOverrides ?? {},
    removedModules: data.removedModules ?? [],
    customModules: data.customModules ?? [],
  });
  const defaultStatuses = () =>
    Object.fromEntries(
      configuredModules.map((module) => [module.id, company.allowedModules.includes(module.id) ? 'ACTIF' : 'INACTIF']),
    ) as Record<ModuleId, ModuleAvailability>;
  const [moduleStatuses, setModuleStatuses] = useState<Record<ModuleId, ModuleAvailability>>(defaultStatuses);
  const [savedStatuses, setSavedStatuses] = useState<Record<ModuleId, ModuleAvailability>>(defaultStatuses);
  const [featureSelections, setFeatureSelections] = useState<Record<ModuleId, string[]>>({});
  const [savedFeatureSelections, setSavedFeatureSelections] = useState<Record<ModuleId, string[]>>({});
  const [featurePermissions, setFeaturePermissions] = useState<Record<ModuleId, FeaturePermissionMap>>({});
  const [savedFeaturePermissions, setSavedFeaturePermissions] = useState<Record<ModuleId, FeaturePermissionMap>>({});
  const [packSelections, setPackSelections] = useState<Record<ModuleId, string[]>>({});
  const [savedPackSelections, setSavedPackSelections] = useState<Record<ModuleId, string[]>>({});
  const [hiddenWorkspaceFeatures, setHiddenWorkspaceFeatures] = useState<CompanyWorkspaceFeatureId[]>(
    () => normalizeCompanyWorkspaceFeatureIds(company.hiddenWorkspaceFeatures),
  );
  const [savedHiddenWorkspaceFeatures, setSavedHiddenWorkspaceFeatures] = useState<CompanyWorkspaceFeatureId[]>(
    () => normalizeCompanyWorkspaceFeatureIds(company.hiddenWorkspaceFeatures),
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [savedPaymentEnabled, setSavedPaymentEnabled] = useState(false);
  const [paymentProviders, setPaymentProviders] = useState<string[]>(['DIAMANOPAY']);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [publicSiteEnabled, setPublicSiteEnabled] = useState(false);
  const [savedPublicSiteEnabled, setSavedPublicSiteEnabled] = useState(false);
  const [publicHomepageEnabled, setPublicHomepageEnabled] = useState(true);
  const [savedPublicHomepageEnabled, setSavedPublicHomepageEnabled] = useState(true);
  const [publicBannerEnabled, setPublicBannerEnabled] = useState(true);
  const [savedPublicBannerEnabled, setSavedPublicBannerEnabled] = useState(true);
  const [publicSiteLoading, setPublicSiteLoading] = useState(true);
  const [publicSiteSaving, setPublicSiteSaving] = useState(false);
  const [publicSiteError, setPublicSiteError] = useState('');
  const publicSiteCompanyIdRef = useRef(company.id);
  publicSiteCompanyIdRef.current = company.id;
  const [loginSettings, setLoginSettings] = useState<{
    customAllowed: boolean;
    mode: 'MAXIMUS' | 'CUSTOM';
    slug: string;
    url: string | null;
  } | null>(null);
  const [loginSaving, setLoginSaving] = useState(false);
  const [customDomains, setCustomDomains] = useState<EcommerceDomain[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [domainLoading, setDomainLoading] = useState(true);
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainOperation, setDomainOperation] = useState<'create' | 'verify' | 'delete' | null>(null);
  const [domainError, setDomainError] = useState('');
  const [installationRefreshKey, setInstallationRefreshKey] = useState(0);
  const [activeCompanySettingsTab, setActiveCompanySettingsTab] = useState('access');
  const companySettingsTabs = [
    { id: 'access', label: 'Accès & permissions', icon: ShieldCheck },
    { id: 'public-site', label: 'Site public', icon: Store },
    { id: 'connection', label: 'Connexion publique', icon: LogIn },
    { id: 'installation', label: 'Installations', icon: KeyRound },
  ];

  useEffect(() => {
    let cancelled = false;
    const fallback = defaultStatuses();
    setModuleStatuses(fallback);
    setSavedStatuses(fallback);
    void loadCompanyModuleAccess(company.id)
      .then((access) => {
        if (cancelled) return;
        const next = {
          ...fallback,
          ...Object.fromEntries(access.filter((item) => item.id in fallback).map((item) => [item.id, item.status])),
        } as Record<ModuleId, ModuleAvailability>;
        setModuleStatuses(next);
        setSavedStatuses(next);
        const nextPacks = Object.fromEntries(
          configuredModules.map((module) => {
            const serverModule = access.find((item) => item.id === module.id);
            const configuredPackIds = Array.isArray(serverModule?.configuration?.packIds)
              ? serverModule.configuration.packIds.filter((packId): packId is string => typeof packId === 'string')
              : null;
            const candidatePackIds = configuredPackIds ?? company.requestedModulePackIds?.[module.id] ?? [];
            return [module.id, [...new Set(candidatePackIds)]];
          }),
        ) as Record<ModuleId, string[]>;
        const nextFeatures = Object.fromEntries(
          configuredModules.map((module) => {
            const serverModule = access.find((item) => item.id === module.id);
            const serverHasExplicitSelection =
              Boolean(serverModule)
              && (Boolean(serverModule?.featureIds?.length) || serverModule?.configuration?.featureScope === 'explicit');
            const configured = serverHasExplicitSelection
              ? serverModule?.featureIds ?? []
              : company.requestedModuleFeatures?.[module.id];
            const candidateFeatureIds = configured === undefined
              ? getModuleFeatureOptions(module).map((feature) => feature.id)
              : configured;
            const featureIds = normalizeFeatureIdsForSelectedPacks(
              module,
              candidateFeatureIds,
              nextPacks[module.id] ?? [],
            );
            return [module.id, [...new Set(featureIds)]];
          }),
        ) as Record<ModuleId, string[]>;
        const nextPermissions = Object.fromEntries(
          configuredModules.map((module) => {
            const serverModule = access.find((item) => item.id === module.id);
            const serverConfiguration = serverModule?.configuration;
            const hasServerPermissions = Boolean(
              serverConfiguration
              && Object.prototype.hasOwnProperty.call(serverConfiguration, 'featurePermissions'),
            );
            const serverPermissions = normalizeFeaturePermissionMap(serverConfiguration?.featurePermissions);
            const companyPermissions = normalizeFeaturePermissionMap(company.requestedModulePermissions?.[module.id]);
            const selectedPackIds = nextPacks[module.id] ?? [];
            const packPermissions = (module.featurePacks ?? [])
              .filter((pack) => selectedPackIds.includes(pack.id))
              .reduce<FeaturePermissionMap>(
                (all, pack) => ({ ...all, ...(pack.featurePermissions ?? {}) }),
                {},
              );
            const preferred = hasServerPermissions
              ? serverPermissions
              : Object.keys(companyPermissions).length > 0
                ? companyPermissions
                : packPermissions;
            return [
              module.id,
              selectedFeaturePermissions(nextFeatures[module.id] ?? [], preferred),
            ];
          }),
        ) as Record<ModuleId, FeaturePermissionMap>;
        setFeatureSelections(nextFeatures);
        setSavedFeatureSelections(nextFeatures);
        setFeaturePermissions(nextPermissions);
        setSavedFeaturePermissions(nextPermissions);
        setPackSelections(nextPacks);
        setSavedPackSelections(nextPacks);
      })
      .catch(() => {
        // The local company model remains a safe fallback while the server is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [
    company.id,
    company.allowedModules.join('|'),
    JSON.stringify(company.requestedModuleFeatures ?? {}),
    JSON.stringify(company.requestedModulePackIds ?? {}),
    JSON.stringify(company.requestedModulePermissions ?? {}),
  ]);

  useEffect(() => {
    const next = normalizeCompanyWorkspaceFeatureIds(company.hiddenWorkspaceFeatures);
    setHiddenWorkspaceFeatures(next);
    setSavedHiddenWorkspaceFeatures(next);
  }, [company.id, JSON.stringify(company.hiddenWorkspaceFeatures ?? [])]);

  useEffect(() => {
    let cancelled = false;
    setPaymentLoading(true);
    void loadCompanyPaymentAccess(company.id)
      .then((access) => {
        if (cancelled) return;
        setPaymentEnabled(access.enabled);
        setSavedPaymentEnabled(access.enabled);
        setPaymentProviders(access.providers.length > 0 ? access.providers : ['DIAMANOPAY']);
      })
      .catch(() => {
        if (!cancelled) {
          setPaymentEnabled(false);
          setSavedPaymentEnabled(false);
        }
      })
      .finally(() => {
        if (!cancelled) setPaymentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  useEffect(() => {
    let cancelled = false;
    setPublicSiteLoading(true);
    setPublicSiteError('');
    setPublicSiteEnabled(false);
    setSavedPublicSiteEnabled(false);
    setPublicHomepageEnabled(true);
    setSavedPublicHomepageEnabled(true);
    setPublicBannerEnabled(true);
    setSavedPublicBannerEnabled(true);
    setPublicSiteSaving(false);
    void companyRequestApi.publicSiteAccess(company.id)
      .then((settings) => {
        if (cancelled) return;
        setPublicSiteEnabled(settings.enabled);
        setSavedPublicSiteEnabled(settings.enabled);
        setPublicHomepageEnabled(settings.homepageEnabled);
        setSavedPublicHomepageEnabled(settings.homepageEnabled);
        setPublicBannerEnabled(settings.bannerEnabled);
        setSavedPublicBannerEnabled(settings.bannerEnabled);
      })
      .catch((error) => {
        if (!cancelled) {
          setPublicSiteEnabled(false);
          setSavedPublicSiteEnabled(false);
          setPublicHomepageEnabled(true);
          setSavedPublicHomepageEnabled(true);
          setPublicBannerEnabled(true);
          setSavedPublicBannerEnabled(true);
          setPublicSiteError(error instanceof Error ? error.message : 'Le contrôle du site public est indisponible.');
        }
      })
      .finally(() => {
        if (!cancelled) setPublicSiteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  useEffect(() => {
    let cancelled = false;
    void companyRequestApi.loginSettings(company.id)
      .then(({ settings }) => {
        if (!cancelled) setLoginSettings(settings);
      })
      .catch(() => {
        if (!cancelled) setLoginSettings(null);
      });
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  useEffect(() => {
    let cancelled = false;
    setDomainLoading(true);
    setDomainError('');
    void createEcommerceApi(company.id).bootstrap()
      .then(({ domains }) => {
        if (!cancelled) setCustomDomains(Array.isArray(domains) ? domains : []);
      })
      .catch((error) => {
        if (!cancelled) {
          setCustomDomains([]);
          setDomainError(error instanceof Error ? error.message : 'Les domaines personnalisés sont indisponibles.');
        }
      })
      .finally(() => {
        if (!cancelled) setDomainLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  const setModuleStatus = (id: ModuleId, status: ModuleAvailability) => {
    setModuleStatuses((previous) => ({ ...previous, [id]: status }));
  };

  const saveLoginSettings = async (input: { customAllowed?: boolean; mode?: 'MAXIMUS' | 'CUSTOM' }): Promise<boolean> => {
    setLoginSaving(true);
    try {
      const result = await companyRequestApi.updateLoginSettings(company.id, input);
      setLoginSettings(result.settings);
      mutate((draft) => {
        const target = draft.companies.find((item) => item.id === company.id);
        if (target) Object.assign(target, result.company);
      }, input.customAllowed === false ? 'La connexion personnalisée a été désactivée.' : 'Paramètres de connexion enregistrés.');
      return true;
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : 'Les paramètres de connexion n’ont pas pu être enregistrés.', 'error');
      return false;
    } finally {
      setLoginSaving(false);
    }
  };

  const refreshCustomDomains = async () => {
    const { domains } = await createEcommerceApi(company.id).bootstrap();
    setCustomDomains(Array.isArray(domains) ? domains : []);
  };

  const createCustomDomain = async () => {
    const domain = domainInput.trim();
    if (!domain) return;
    setDomainSaving(true);
    setDomainOperation('create');
    setDomainError('');
    try {
      const created = await createEcommerceApi(company.id).createDomain(domain);
      setCustomDomains((current) => [...current.filter((item) => item.id !== created.id), created]);
      setDomainInput('');
      showAppToast('Domaine ajouté.', 'success');
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Le domaine n’a pas pu être créé.');
    } finally {
      setDomainSaving(false);
      setDomainOperation(null);
    }
  };

  const verifyCustomDomain = async (domain: EcommerceDomain) => {
    setDomainSaving(true);
    setDomainOperation('verify');
    setDomainError('');
    try {
      const verified = await createEcommerceApi(company.id).verifyDomain(domain.id);
      setCustomDomains((current) => current.map((item) => item.id === verified.id ? verified : item));
      showAppToast('Vérification DNS actualisée.', 'success');
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'La vérification DNS a échoué.');
      void refreshCustomDomains().catch(() => undefined);
    } finally {
      setDomainSaving(false);
      setDomainOperation(null);
    }
  };

  const deleteCustomDomain = async (domain: EcommerceDomain) => {
    setDomainSaving(true);
    setDomainOperation('delete');
    setDomainError('');
    try {
      await createEcommerceApi(company.id).deleteDomain(domain.id);
      setCustomDomains((current) => current.filter((item) => item.id !== domain.id));
      showAppToast('Domaine retiré.', 'success');
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : 'Le domaine n’a pas pu être retiré.');
    } finally {
      setDomainSaving(false);
      setDomainOperation(null);
    }
  };

  const downloadInstallationManifest = async () => {
    try {
      const manifest = await companyRequestApi.installationManifest(company.id);
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `maximus-installation-${company.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Le manifeste d’installation n’a pas pu être exporté.');
    }
  };

  const prepareInstallation = async (mode: 'dedicated' | 'on_premise') => {
    const confirmed = await confirm({
      title: 'Créer une nouvelle installation ?',
      description: `Voulez-vous générer un bootstrap pour une NOUVELLE installation ${mode === 'dedicated' ? 'dédiée' : 'sur site'} ? Les installations existantes continueront de fonctionner.`,
      confirmLabel: 'Créer l’installation',
      tone: 'default',
    });
    if (!confirmed) return;
    try {
      const result = await companyRequestApi.issueInstallation(company.id, { mode, createNew: true });
      const blob = new Blob([JSON.stringify(result.bootstrap, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `maximus-bootstrap-${company.id}-${mode}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setInstallationRefreshKey(k => k + 1);
      showAppToast('Le fichier bootstrap a été téléchargé. Transférez-le au serveur de cette nouvelle installation.', 'success');
    } catch (error) {
      showAppToast(error instanceof Error ? error.message : 'L’installation n’a pas pu être préparée.', 'error');
    }
  };

  const toggleFeature = (moduleId: ModuleId, featureId: string) => {
    setFeatureSelections((previous) => {
      const selected = new Set(previous[moduleId] ?? []);
      if (selected.has(featureId)) selected.delete(featureId);
      else selected.add(featureId);
      setFeaturePermissions((permissions) => ({
        ...permissions,
        [moduleId]: selectedFeaturePermissions(
          [...selected],
          permissions[moduleId] ?? {},
        ),
      }));
      return { ...previous, [moduleId]: [...selected] };
    });
  };

  const setModulePacks = (moduleId: ModuleId, packIds: string[]) => {
    const module = configuredModules.find((item) => item.id === moduleId);
    const error = module ? getModulePackError(module, packIds) : null;
    if (error) {
      showAppToast(error, 'error');
      return;
    }
    const featureIds = module
      ? [...getEffectiveModuleFeatureIds(module,
          (module.featurePacks ?? [])
            .filter((pack) => packIds.includes(pack.id))
            .flatMap((pack) => pack.featureIds),
        )]
      : [];
    const selectedPacks = (module?.featurePacks ?? []).filter((pack) => packIds.includes(pack.id));
    const packPermissions = selectedPacks.reduce<FeaturePermissionMap>(
      (all, pack) => ({ ...all, ...(pack.featurePermissions ?? {}) }),
      {},
    );
    setPackSelections((previous) => ({ ...previous, [moduleId]: packIds }));
    setFeatureSelections((previous) => ({ ...previous, [moduleId]: featureIds }));
    setFeaturePermissions((previous) => ({
      ...previous,
      [moduleId]: selectedFeaturePermissions(
        featureIds,
        packPermissions,
        previous[moduleId] ?? {},
      ),
    }));
  };

  const setFeaturePermission = (
    moduleId: ModuleId,
    featureId: string,
    permission: (typeof permissionActions)[number]['id'],
    enabled: boolean,
  ) => {
    setFeaturePermissions((previous) => {
      const nextPermissions = { ...(previous[moduleId] ?? {}) };
      const current = new Set(nextPermissions[featureId] ?? []);
      if (permission === 'voir') {
        if (enabled) current.add('voir');
        else current.clear();
      } else if (permission === 'créer') {
        if (enabled) {
          current.add('voir');
          current.add('créer');
        } else {
          current.delete('créer');
          current.delete('modifier');
        }
      } else if (enabled) {
        current.add('voir');
        current.add('créer');
        current.add('modifier');
      } else {
        current.delete('modifier');
      }
      if (current.size > 0) nextPermissions[featureId] = [...current];
      else delete nextPermissions[featureId];
      return { ...previous, [moduleId]: nextPermissions };
    });
    setFeatureSelections((previous) => {
      const selected = new Set(previous[moduleId] ?? []);
      if (permission === 'voir' && enabled) selected.add(featureId);
      if (permission === 'voir' && !enabled) selected.delete(featureId);
      return { ...previous, [moduleId]: [...selected] };
    });
  };

  const toggleWorkspaceFeature = (featureId: CompanyWorkspaceFeatureId) => {
    setHiddenWorkspaceFeatures((previous) =>
      previous.includes(featureId)
        ? previous.filter((item) => item !== featureId)
        : [...previous, featureId],
    );
  };

  const saveWorkspaceFeatures = () => {
    mutate((draft) => {
      const target = draft.companies.find((item) => item.id === company.id);
      if (target) target.hiddenWorkspaceFeatures = [...hiddenWorkspaceFeatures];
    }, 'Visibilité de l’espace entreprise enregistrée.');
    setSavedHiddenWorkspaceFeatures(hiddenWorkspaceFeatures);
    return true;
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const module of configuredModules) {
        const error = getModulePackError(module, packSelections[module.id] ?? []);
        if (error) throw new Error(error);
      }
      const normalizedFeatureSelections = Object.fromEntries(
        configuredModules.map((module) => [
          module.id,
          normalizeFeatureIdsForSelectedPacks(
            module,
            featureSelections[module.id] ?? [],
            packSelections[module.id] ?? [],
          ),
        ]),
      ) as Record<ModuleId, string[]>;
      const normalizedFeaturePermissions = Object.fromEntries(
        configuredModules.map((module) => [
          module.id,
          selectedFeaturePermissions(
            normalizedFeatureSelections[module.id] ?? [],
            featurePermissions[module.id] ?? {},
          ),
        ]),
      ) as Record<ModuleId, FeaturePermissionMap>;
      const changes = configuredModules
        .filter((module) =>
          moduleStatuses[module.id] !== savedStatuses[module.id]
          || JSON.stringify(featureSelections[module.id] ?? []) !== JSON.stringify(savedFeatureSelections[module.id] ?? [])
          || JSON.stringify(packSelections[module.id] ?? []) !== JSON.stringify(savedPackSelections[module.id] ?? [])
          || JSON.stringify(featurePermissions[module.id] ?? {}) !== JSON.stringify(savedFeaturePermissions[module.id] ?? {}),
        )
        .map((module) => {
          const featureIds = normalizedFeatureSelections[module.id] ?? [];
          const configuredPermissions = normalizedFeaturePermissions[module.id] ?? {};
          return onModuleAccess(company.id, module.id, moduleStatuses[module.id], {
            featureIds,
            configuration: {
              featureScope: 'explicit',
              packIds: packSelections[module.id] ?? [],
              featurePermissions: configuredPermissions,
            },
          });
        });
      const paymentChanged = paymentEnabled !== savedPaymentEnabled;
      await Promise.all([
        ...changes,
        ...(paymentChanged
          ? [setCompanyPaymentAccess(company.id, paymentEnabled, paymentProviders)]
          : []),
      ]);
      setFeatureSelections(normalizedFeatureSelections);
      setFeaturePermissions(normalizedFeaturePermissions);
      setSavedStatuses(moduleStatuses);
      setSavedFeatureSelections(normalizedFeatureSelections);
      setSavedFeaturePermissions(normalizedFeaturePermissions);
      setSavedPackSelections(packSelections);
      setSavedPaymentEnabled(paymentEnabled);
      return true;
    } catch (error) {
       setModuleStatuses(savedStatuses);
       setFeatureSelections(savedFeatureSelections);
        setFeaturePermissions(savedFeaturePermissions);
       setPackSelections(savedPackSelections);
       setPaymentEnabled(savedPaymentEnabled);
      showAppToast(error instanceof Error ? error.message : 'La configuration n’a pas pu être enregistrée.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <button
        data-testid="button-back-companies"
        onClick={onBack}
        className="text-xs font-bold text-[hsl(var(--primary))]"
      >
        ← Retour aux entreprises
      </button>
      <div className="card-surface rounded-2xl p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row">
          <div className="flex gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] text-lg font-black text-[hsl(var(--primary-foreground))]">
              {company.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h2 className="text-2xl font-bold">{company.name}</h2>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {company.sector} · {company.country}
              </p>
              <div className="mt-3">
                <StatusBadge status={company.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton testId="button-edit-company-detail" icon={Edit3} onClick={() => setEditing(true)}>
              Modifier
            </ActionButton>
            <ActionButton
              testId="button-suspend-company"
              icon={company.status === 'SUSPENDU' ? RefreshCw : ShieldCheck}
              onClick={() =>
                mutate(
                  (draft) => {
                    const target = draft.companies.find((item) => item.id === company.id);
                    if (target) target.status = target.status === 'SUSPENDU' ? 'ACTIF' : 'SUSPENDU';
                  },
                  company.status === 'SUSPENDU' ? 'Entreprise réactivée.' : 'Entreprise suspendue.',
                )
              }
            >
              {company.status === 'SUSPENDU' ? 'Réactiver' : 'Suspendre'}
            </ActionButton>
          </div>
        </div>
        <div className="mt-8 grid gap-4 border-t pt-5 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Responsable</p>
            <p className="mt-1 font-bold">{company.manager}</p>
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Email</p>
            <p className="mt-1 font-bold">{company.email}</p>
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Modules accessibles</p>
            <p className="mt-1 font-bold">
              {configuredModules.filter((module) => moduleStatuses[module.id] !== 'INACTIF').length} / {configuredModules.length}
            </p>
          </div>
        </div>
      </div>
      <WorkspaceTabs
        items={companySettingsTabs}
        activeId={activeCompanySettingsTab}
        onChange={setActiveCompanySettingsTab}
        ariaLabel={`Réglages de ${company.name}`}
        testIdPrefix="company-settings-tab"
      />
      <div className={activeCompanySettingsTab === 'public-site' ? 'space-y-5' : 'hidden'}>
        <Card className="p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-bold">Réglages du site public</h2>
              <p className="mt-1 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
                Ces réglages sont administrés par MAXIMUS et restent indépendants de la publication et des images de la boutique.
              </p>
            </div>
            <Badge variant={publicSiteEnabled ? 'default' : 'secondary'} className="shrink-0">
              {publicSiteLoading ? 'Chargement…' : publicSiteEnabled ? 'Site autorisé' : 'Site bloqué'}
            </Badge>
          </div>
          <div className="mt-5">
          <AuthorizationGate gate={publicSiteGate} testId="public-site-authorization-gate">
          <div className="grid gap-3">
            <label className={`flex items-start gap-3 rounded-xl border p-4 transition ${publicSiteEnabled ? 'border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.05)]' : 'bg-[hsl(var(--muted)/.4)]'}`}>
              <Checkbox
                data-testid="checkbox-company-public-site-access"
                aria-label="Autoriser le site public de cette entreprise"
                checked={publicSiteEnabled}
                disabled={publicSiteLoading || publicSiteSaving}
                onCheckedChange={(checked) => {
                  setPublicSiteEnabled(checked === true);
                  setPublicSiteError('');
                }}
                className="mt-0.5"
              />
              <span>
                <strong className="block text-sm">Autoriser le site public</strong>
                <span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                  Autorisation générale. L’entreprise doit aussi publier son site dans Organisation et accès → Site public.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border p-4">
              <Checkbox
                data-testid="checkbox-company-public-homepage-enabled"
                aria-label="Autoriser la page d’accueil publique"
                checked={publicHomepageEnabled}
                disabled={publicSiteLoading || publicSiteSaving}
                onCheckedChange={(checked) => {
                  setPublicHomepageEnabled(checked === true);
                  setPublicSiteError('');
                }}
                className="mt-0.5"
              />
              <span>
                <strong className="block text-sm">Autoriser l’accueil entier</strong>
                <span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                  Cette autorisation contrôle toute la page d’accueil. Les autres rubriques publiques restent accessibles.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border p-4">
              <Checkbox
                data-testid="checkbox-company-public-banner-enabled"
                aria-label="Autoriser la bannière de l’accueil"
                checked={publicBannerEnabled}
                disabled={publicSiteLoading || publicSiteSaving}
                onCheckedChange={(checked) => {
                  setPublicBannerEnabled(checked === true);
                  setPublicSiteError('');
                }}
                className="mt-0.5"
              />
              <span>
                <strong className="block text-sm">Autoriser la bannière</strong>
                <span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                  Si elle est désactivée, rien de la bannière n’est affiché. Ses images restent enregistrées.
                </span>
              </span>
            </label>
          </div>
          {publicSiteError && <p role="alert" className="mt-3 text-sm text-[hsl(var(--destructive))]">{publicSiteError}</p>}
          <div className="mt-5 flex justify-end">
            <DesignSystemActionButton
              primary
              testId="button-save-company-public-site-settings"
              disabled={
                publicSiteLoading
                || publicSiteSaving
                || (
                  publicSiteEnabled === savedPublicSiteEnabled
                  && publicHomepageEnabled === savedPublicHomepageEnabled
                  && publicBannerEnabled === savedPublicBannerEnabled
                )
              }
              onClick={() => void askAuthorizationSave(publicSiteGate, 'Enregistrer les autorisations du site public de cette entreprise.', async () => {
                const targetCompanyId = company.id;
                setPublicSiteSaving(true);
                setPublicSiteError('');
                try {
                  const settings = await companyRequestApi.updatePublicSiteAccess(targetCompanyId, {
                    enabled: publicSiteEnabled,
                    homepageEnabled: publicHomepageEnabled,
                    bannerEnabled: publicBannerEnabled,
                  });
                  if (publicSiteCompanyIdRef.current !== targetCompanyId) return false;
                  setPublicSiteEnabled(settings.enabled);
                  setSavedPublicSiteEnabled(settings.enabled);
                  setPublicHomepageEnabled(settings.homepageEnabled);
                  setSavedPublicHomepageEnabled(settings.homepageEnabled);
                  setPublicBannerEnabled(settings.bannerEnabled);
                  setSavedPublicBannerEnabled(settings.bannerEnabled);
                  return true;
                } catch (error) {
                  if (publicSiteCompanyIdRef.current !== targetCompanyId) return false;
                  setPublicSiteEnabled(savedPublicSiteEnabled);
                  setPublicHomepageEnabled(savedPublicHomepageEnabled);
                  setPublicBannerEnabled(savedPublicBannerEnabled);
                  setPublicSiteError(error instanceof Error ? error.message : 'Les réglages du site public n’ont pas pu être enregistrés.');
                  return false;
                } finally {
                  if (publicSiteCompanyIdRef.current === targetCompanyId) setPublicSiteSaving(false);
                }
              })}
            >
              {publicSiteSaving ? 'Enregistrement…' : 'Enregistrer les réglages'}
            </DesignSystemActionButton>
          </div>
          </AuthorizationGate>
          </div>
        </Card>
      </div>
      <div className={activeCompanySettingsTab === 'installation' ? 'space-y-5' : 'hidden'}>
      <section className="card-surface rounded-2xl border border-[hsl(var(--primary)/.25)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <KeyRound size={18} className="text-[hsl(var(--primary))]" />
              <p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">
                Réservé à l’administration MAXIMUS
              </p>
            </div>
            <h2 className="mt-2 text-xl font-bold">Installation dédiée ou locale</h2>
            <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              MAXIMUS crée ici le fichier bootstrap JSON secret. Vous le téléchargez, puis vous le transférez
              au serveur de l’entreprise par SSH/SCP avant de lancer le script d’installation.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[hsl(var(--primary)/.1)] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]">
            {company.status === 'ACTIF' ? 'Entreprise active' : 'Entreprise à activer'}
          </span>
        </div>
        <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="font-bold">1. Préparer</p>
            <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Générez le bootstrap depuis MAXIMUS principal.</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-bold">2. Transférer</p>
            <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Envoyez le JSON au VPS avec SSH/SCP.</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-bold">3. Installer</p>
            <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Le VPS récupère les modules et permissions publiés.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <ActionButton
            primary
            testId="button-prepare-dedicated-installation"
            onClick={() => void prepareInstallation('dedicated')}
          >
            Créer une installation dédiée
          </ActionButton>
          <ActionButton
            testId="button-prepare-on-premise-installation"
            onClick={() => void prepareInstallation('on_premise')}
          >
            Créer une installation locale
          </ActionButton>
          <ActionButton
            testId="button-download-installation-manifest"
            onClick={() => void downloadInstallationManifest()}
          >
            Télécharger le manifeste
          </ActionButton>
        </div>
        <p className="mt-4 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
          L’entreprise doit être <strong>ACTIF</strong> avant la préparation.
        </p>
      </section>

      <CompanyInstallationAccess
        companyId={company.id}
        companyName={company.name}
        refreshKey={installationRefreshKey}
        loginUrl={loginSettings?.url}
      />
      </div>

      <div className={activeCompanySettingsTab === 'access' ? 'space-y-5' : 'hidden'}>
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]">
            <ShieldCheck size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-bold">Accès et autorisations</h2>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Les modules, les droits de leurs fonctionnalités et les accès transverses sont regroupés ici.
            </p>
          </div>
        </div>
      </Card>
      </div>
      <div className={activeCompanySettingsTab === 'connection' ? 'space-y-5' : 'hidden'}>
      <section className="card-surface rounded-2xl p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Connexion et domaine</p>
            <h2 className="mt-2 font-bold">Accès de connexion de l’entreprise</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              Cette configuration est administrée uniquement par MAXIMUS. Activez ou désactivez la page personnalisée, choisissez le mode utilisé et partagez le lien généré depuis cette section.
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${loginSettings?.customAllowed ? 'bg-emerald-100 text-emerald-700' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>
            {loginSettings?.customAllowed ? 'Autorisé' : 'Non autorisé'}
          </span>
        </div>
        <AuthorizationGate gate={loginGate} testId="login-authorization-gate">
        <div className="mt-5">
        <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${loginSettings?.customAllowed ? 'border-emerald-300 bg-emerald-50/60' : 'bg-[hsl(var(--muted)/.4)]'}`}>
          <input
            type="checkbox"
            data-testid="checkbox-company-custom-login"
            checked={Boolean(loginSettings?.customAllowed)}
            disabled={!loginSettings || loginSaving || loginGate.locked}
            onChange={(event) => {
              if (loginGate.locked) return;
              const customAllowed = event.target.checked;
              void askAuthorizationSave(
                loginGate,
                customAllowed ? 'Autoriser la page de connexion personnalisée pour cette entreprise.' : 'Retirer la page de connexion personnalisée de cette entreprise.',
                () => saveLoginSettings({ customAllowed }),
              );
            }}
            className="mt-1"
          />
          <span>
            <strong className="block text-sm">Autoriser la page de connexion personnalisée</strong>
            <span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              Le lien est généré à partir du nom de l’entreprise et reste stable même si son nom est modifié plus tard.
            </span>
          </span>
        </label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block text-sm font-semibold">
            Mode actuellement utilisé
            <select
              data-testid="select-company-login-mode"
              value={loginSettings?.mode ?? 'MAXIMUS'}
              disabled={!loginSettings?.customAllowed || loginSaving || loginGate.locked}
              onChange={(event) => {
                if (loginGate.locked) return;
                const mode = event.target.value as 'MAXIMUS' | 'CUSTOM';
                void askAuthorizationSave(
                  loginGate,
                  'Modifier le mode de connexion personnalisé de cette entreprise.',
                  () => saveLoginSettings({ mode }),
                );
              }}
              className="mt-2 w-full rounded-lg border bg-[hsl(var(--card))] px-3 py-3 text-sm"
            >
              <option value="MAXIMUS">Connexion MAXIMUS actuelle</option>
              <option value="CUSTOM">Page personnalisée</option>
            </select>
          </label>
          <div className="rounded-xl bg-[hsl(var(--muted)/.55)] p-4">
            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Lien généré</p>
            {loginSettings?.url ? (
              <>
                <p className="mt-2 break-all font-mono text-xs">{window.location.origin}{loginSettings.url}</p>
                <button type="button" onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}${loginSettings.url}`)} className="mt-3 rounded-lg border px-3 py-2 text-xs font-bold">Copier le lien</button>
              </>
            ) : <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Le lien reste masqué tant que la page personnalisée n’est pas activée.</p>}
          </div>
        </div>
        </AuthorizationGate>
      </section>
      {loginSettings?.customAllowed && (
        <AuthorizationGate gate={domainGate} testId="custom-domain-authorization-gate" title="Domaine public verrouillé">
        <section className="card-surface rounded-2xl p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Domaine de la boutique publique</p>
              <h2 className="mt-2 font-bold">Connecter le domaine public</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                Ajoutez le domaine utilisé pour la boutique publique de l'entreprise. L'accès ERP des employés se gère via les installations ci-dessus.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs font-bold">
              {domainLoading ? 'Chargement…' : `${customDomains.length} domaine${customDomains.length > 1 ? 's' : ''}`}
            </span>
          </div>
          <form onSubmit={(event) => {
            event.preventDefault();
            void askAuthorizationSave(domainGate, `Ajouter le domaine ${domainInput.trim()} à cette entreprise.`, createCustomDomain);
          }} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 text-sm font-semibold">
              Nom de domaine
              <input
                data-testid="input-company-custom-domain"
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                placeholder="boutique.exemple.sn"
                disabled={domainSaving}
                className="mt-2 w-full rounded-lg border bg-[hsl(var(--card))] px-3 py-3 text-sm font-normal"
              />
            </label>
            <button
              type="submit"
              data-testid="button-create-company-custom-domain"
              disabled={domainSaving || !domainInput.trim()}
              className="rounded-lg bg-[hsl(var(--primary))] px-4 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {domainSaving && domainOperation === 'create' ? 'Enregistrement…' : 'Connecter le domaine'}
            </button>
          </form>
          {domainError && (
            <p data-testid="company-custom-domain-error" className="mt-3 rounded-lg bg-[hsl(var(--destructive)/.08)] px-3 py-2 text-xs font-semibold text-[hsl(var(--destructive))]">
              {domainError}
            </p>
          )}
          <div className="mt-4 space-y-3">
            {customDomains.length === 0 && !domainLoading ? (
              <p className="rounded-xl border border-dashed p-4 text-sm text-[hsl(var(--muted-foreground))]">
                Aucun domaine personnalisé n’est encore configuré pour cette entreprise.
              </p>
            ) : customDomains.map((domain) => (
              <article key={domain.id} data-testid={`card-company-custom-domain-${domain.id}`} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="break-all">{domain.domain}</strong>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${domain.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {domain.status === 'ACTIVE' ? 'ACTIF' : 'EN ATTENTE DNS'}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[hsl(var(--muted-foreground))] sm:grid-cols-2">
                      <p><span className="font-bold">TXT :</span> {domain.verificationName} → <code className="break-all">{domain.verificationValue}</code></p>
                      <p><span className="font-bold">CNAME :</span> {domain.domain} → <code className="break-all">{domain.targetHost}</code></p>
                    </div>
                    {domain.lastError && <p className="mt-2 text-xs font-semibold text-[hsl(var(--destructive))]">{domain.lastError}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      data-testid={`button-verify-company-custom-domain-${domain.id}`}
                      disabled={domainSaving}
                      onClick={() => void askAuthorizationSave(domainGate, `Vérifier la configuration DNS de ${domain.domain}.`, () => verifyCustomDomain(domain))}
                      className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50"
                    >
                      {domainSaving && domainOperation === 'verify' ? 'Vérification…' : 'Vérifier'}
                    </button>
                    <button
                      type="button"
                      data-testid={`button-delete-company-custom-domain-${domain.id}`}
                      disabled={domainSaving}
                      onClick={() => void domainGate.confirmAndRun({
                        title: 'Retirer ce domaine personnalisé ?',
                        description: `Le domaine ${domain.domain} ne sera plus relié à cette entreprise.`,
                        confirmLabel: 'Retirer le domaine',
                        tone: 'danger',
                      }, () => deleteCustomDomain(domain))}
                      className="rounded-lg border border-[hsl(var(--destructive)/.35)] px-3 py-2 text-xs font-bold text-[hsl(var(--destructive))] disabled:opacity-50"
                    >
                      {domainSaving && domainOperation === 'delete' ? 'Retrait…' : 'Retirer'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        </AuthorizationGate>
      )}
      </div>
      <div className={activeCompanySettingsTab === 'access' ? 'space-y-5' : 'hidden'}>
      <MaximusNavigationSettings company={company} onSaved={onNavigationSaved} />
      <div className="space-y-5">
      <AuthorizationGate gate={notificationGate} testId="notification-access-authorization-gate" title="Autorisation des notifications verrouillée">
      <CompanyPushNotificationAccess
        companyId={company.id}
        companyName={company.name}
        dedicatedInstallation={Boolean(company.primaryInstallationId)}
      />
      </AuthorizationGate>
      <AuthorizationGate gate={workspaceGate} testId="workspace-features-authorization-gate" title="Visibilité de l’espace verrouillée">
      <section className="card-surface rounded-2xl p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-bold">Fonctionnalités de l’espace entreprise</h2>
            <p className="mt-1 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
              Choisissez les fonctionnalités et rubriques visibles dans l’espace de cette entreprise.
              Le réglage est enregistré pour tous ses utilisateurs et bloque aussi l’accès direct.
            </p>
          </div>
          <span className="mono shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
            {companyWorkspaceFeatureDefinitions.length - hiddenWorkspaceFeatures.length} / {companyWorkspaceFeatureDefinitions.length} visibles
          </span>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {companyWorkspaceFeatureDefinitions.map((feature) => {
            const visible = !hiddenWorkspaceFeatures.includes(feature.id);
            return (
              <label
                key={feature.id}
                data-testid={`card-company-workspace-feature-${feature.id}`}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  visible
                    ? 'border-[hsl(var(--primary)/.35)] bg-[hsl(var(--primary)/.05)]'
                    : 'bg-[hsl(var(--muted)/.4)] opacity-70'
                }`}
              >
                <input
                  type="checkbox"
                  data-testid={`checkbox-company-workspace-feature-${feature.id}`}
                  checked={visible}
                  onChange={() => toggleWorkspaceFeature(feature.id)}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <strong className="block text-sm">{feature.label}</strong>
                  <span className="mt-1 block text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
                    {feature.description}
                  </span>
                  <span className="mt-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--primary))]">
                    {visible ? 'Visible' : 'Masquée'}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end">
          <ActionButton
            primary
            testId="button-save-company-workspace-features"
            disabled={JSON.stringify(hiddenWorkspaceFeatures) === JSON.stringify(savedHiddenWorkspaceFeatures)}
            onClick={() => void askAuthorizationSave(workspaceGate, 'Enregistrer la visibilité des fonctionnalités de l’espace entreprise.', saveWorkspaceFeatures)}
          >
            Enregistrer la visibilité
          </ActionButton>
        </div>
      </section>
      </AuthorizationGate>
      <AuthorizationGate gate={paymentGate} testId="payment-access-authorization-gate" title="Accès aux paiements verrouillé">
      <section className="card-surface rounded-2xl p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-bold">Systèmes de paiement</h2>
            <p className="mt-1 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
              Ce contrôle indépendant autorise ou bloque les encaissements DiamanoPay et les retraits de cette entreprise.
              Les commandes déjà payées restent consultables.
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${paymentEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>
            {paymentLoading ? 'Chargement…' : paymentEnabled ? 'Activés' : 'Désactivés'}
          </span>
        </div>
        <label className={`mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${paymentEnabled ? 'border-emerald-300 bg-emerald-50/60' : 'bg-[hsl(var(--muted)/.4)]'}`}>
          <input
            type="checkbox"
            data-testid="checkbox-company-payment-systems"
            checked={paymentEnabled}
            disabled={paymentLoading || saving}
            onChange={(event) => setPaymentEnabled(event.target.checked)}
            className="mt-1"
          />
          <span>
            <strong className="block text-sm">Autoriser les systèmes de paiement</strong>
            <span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              Fournisseur configuré : {paymentProviders.join(', ') || 'Aucun'}.
              La décision est vérifiée côté serveur pour chaque opération sensible.
            </span>
          </span>
        </label>
        <div className="mt-5 flex justify-end">
          <ActionButton
            primary
            testId="button-save-company-payment-systems"
            disabled={paymentLoading || paymentEnabled === savedPaymentEnabled}
            onClick={() => void askAuthorizationSave(paymentGate, 'Enregistrer l’autorisation des systèmes de paiement.', async () => {
              setSaving(true);
              try {
                const access = await setCompanyPaymentAccess(company.id, paymentEnabled, paymentProviders);
                setPaymentEnabled(access.enabled);
                setSavedPaymentEnabled(access.enabled);
                return true;
              } catch (error) {
                setPaymentEnabled(savedPaymentEnabled);
                showAppToast(error instanceof Error ? error.message : 'La configuration des paiements n’a pas pu être enregistrée.', 'error');
                return false;
              } finally {
                setSaving(false);
              }
            })}
          >
            Enregistrer le paiement
          </ActionButton>
        </div>
      </section>
      </AuthorizationGate>
      <AuthorizationGate gate={modulesGate} testId="module-access-authorization-gate" title="Modules et fonctionnalités verrouillés">
      <section className="card-surface rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold">Modules autorisés</h2>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Ajustez le périmètre de l’espace.</p>
          </div>
          <span className="mono text-xs text-[hsl(var(--muted-foreground))]">
            {configuredModules.filter((module) => moduleStatuses[module.id] !== 'INACTIF').length} / {configuredModules.length}
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {configuredModules.map((module) => {
            const status = moduleStatuses[module.id] ?? 'INACTIF';
            return (
              <div
                data-testid={`card-company-module-${module.id}`}
                key={module.id}
                 className={`rounded-xl border p-4 ${status === 'INACTIF' ? 'bg-[hsl(var(--muted)/.4)] opacity-65' : 'border-[hsl(var(--primary)/.4)] bg-[hsl(var(--primary)/.05)]'}`}
              >
                 <div className="flex items-start justify-between gap-4">
                   <div className="flex min-w-0 items-center gap-3">
                     <span className="rounded-lg bg-[hsl(var(--muted))] p-2">
                       <LayoutGrid size={16} />
                     </span>
                     <div className="min-w-0">
                       <strong className="block text-sm">{module.name}</strong>
                       <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{module.description}</p>
                     </div>
                  </div>
                   <select
                     data-testid={`select-company-module-status-${module.id}`}
                     value={status}
                     onChange={(event) => setModuleStatus(module.id, event.target.value as ModuleAvailability)}
                     className="shrink-0 rounded-lg border bg-[hsl(var(--card))] px-2 py-2 text-xs font-bold"
                   >
                     <option value="ACTIF">Actif</option>
                     <option value="BETA">Bêta</option>
                     <option value="MAINTENANCE">Maintenance</option>
                     <option value="INACTIF">Désactivé</option>
                   </select>
                 </div>
                 {getModulePackError(module, packSelections[module.id] ?? []) && (
                   <p role="alert" className="mt-3 text-xs text-[hsl(var(--destructive))]">
                     {getModulePackError(module, packSelections[module.id] ?? [])}
                     <button type="button" className="ml-2 underline" data-testid={`button-company-clear-stale-packs-${module.id}`} onClick={() => setModulePacks(module.id, [])}>Retirer les packs</button>
                   </p>
                 )}
                 {status !== 'INACTIF' && (module.featurePacks?.length || getModuleFeatureOptions(module).length) ? (
                   <div className="mt-4 space-y-3 border-t border-[hsl(var(--border)/.7)] pt-3">
                     {(module.featurePacks ?? []).length > 0 && (
                       <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Packs autorisés — facultatifs</p>
                        {getModulePackError(module, packSelections[module.id] ?? []) && <p role="alert" className="mb-2 text-xs text-[hsl(var(--destructive))]">{getModulePackError(module, packSelections[module.id] ?? [])}</p>}
                        <button type="button" data-testid={`button-company-no-pack-${module.id}`} className="mb-2 text-xs underline" onClick={() => setModulePacks(module.id, [])}>Choisir sans pack</button>
                         <div className="grid gap-2 sm:grid-cols-2">
                           {(module.featurePacks ?? []).map((pack) => (
                             <label key={pack.id} className="flex items-start gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card)/.65)] p-2 text-xs">
                               <input
                                 type="checkbox"
                                 checked={(packSelections[module.id] ?? []).includes(pack.id)}
                                 onChange={(event) => setModulePacks(
                                   module.id,
                                   event.target.checked
                                     ? [...new Set([...(packSelections[module.id] ?? []), pack.id])]
                                     : (packSelections[module.id] ?? []).filter((id) => id !== pack.id),
                                 )}
                                 className="mt-0.5"
                               />
                               <span><strong className="block">{pack.name}</strong><span className="text-[10px] text-[hsl(var(--muted-foreground))]">{pack.description}</span></span>
                             </label>
                           ))}
                         </div>
                       </div>
                     )}
                     <div>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Fonctionnalités et droits</p>
                          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Voir · Créer · Modifier</span>
                        </div>
                        {module.id === 'ecommerce' && <p className="mb-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Pour autoriser les produits, cochez <strong>Vente de produits physiques</strong>, <strong>Vente de produits numériques</strong>, ou les deux.</p>}
                        <div className="space-y-2">
                          {getModuleFeatureOptions(module).filter(feature => normalizeFeatureIdsForSelectedPacks(module, [feature.id], packSelections[module.id] ?? []).length > 0).map((feature) => {
                            const selected = (featureSelections[module.id] ?? []).includes(feature.id);
                            const permissions = featurePermissions[module.id]?.[feature.id] ?? [];
                            return (
                              <div key={feature.id} className={`rounded-lg border p-3 ${selected ? 'border-[hsl(var(--primary)/.35)] bg-[hsl(var(--card)/.65)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/.25)] opacity-75'}`}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <label className="flex min-w-0 items-center gap-2 text-xs font-semibold">
                                    <input
                                      type="checkbox"
                                      data-testid={`checkbox-company-feature-${module.id}-${feature.id}`}
                                      checked={selected}
                                      onChange={() => toggleFeature(module.id, feature.id)}
                                      className="rounded"
                                    />
                                    <span>{feature.label}</span>
                                  </label>
                                  <div className="flex flex-wrap gap-3">
                                    {permissionActions.map((action) => (
                                      <label key={action.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
                                        <input
                                          type="checkbox"
                                          data-testid={`checkbox-company-permission-${module.id}-${feature.id}-${action.id}`}
                                          checked={permissions.includes(action.id)}
                                          disabled={action.id !== 'voir' && !permissions.includes('voir')}
                                          onChange={(event) => setFeaturePermission(module.id, feature.id, action.id, event.target.checked)}
                                          className="rounded"
                                        />
                                        {action.label}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                {!selected && <p className="mt-1 pl-6 text-[10px] text-[hsl(var(--muted-foreground))]">Fonctionnalité non visible dans l’espace entreprise.</p>}
                                {module.id === 'immobilier' && feature.id === 'annonces' && <p className="mt-1 pl-6 text-[10px] text-[hsl(var(--muted-foreground))]">Ces droits contrôlent la création et la modification des fiches Bien dans l’espace Annonces, y compris leur statut Brouillon ou Publié.</p>}
                                </div>
                            );
                          })}
                       </div>
                     </div>
                   </div>
                 ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex justify-end">
          <ActionButton
            primary
            testId="button-save-company-modules"
            onClick={() => {
              if (!saving) void askAuthorizationSave(modulesGate, 'Enregistrer les modules, packs et droits des fonctionnalités de cette entreprise.', save);
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer la configuration'}
          </ActionButton>
        </div>
      </section>
      </AuthorizationGate>
      </div>
      </div>
      {editing && <CompanyEditModal company={company} data={data} mutate={mutate} onClose={() => setEditing(false)} />}
    </div>
  );
}
export default App;
