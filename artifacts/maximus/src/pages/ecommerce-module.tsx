import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  ArrowUpRight,
  ArrowDownToLine,
  Banknote,
  BarChart3,
  Clock3,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Copy,
  House,
  ImagePlus,
  LayoutDashboard,
  Megaphone,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  Store,
  Tags,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@workspace/maximus-design-system/components/ui/button';
import {
  createEcommerceApi,
  type EcommercePosSale,
  type EcommercePosSalesBootstrap,
  type EcommerceExpensesBootstrap,
  type EcommerceBootstrap,
  type EcommerceCategory,
  type EcommerceDeliveryRequest,
  type EcommerceDeliveryRequestStatus,
  type EcommerceDeliveryZone,
  type EcommerceOrder,
  type EcommerceOrderStatus,
  type EcommerceProduct,
  type EcommerceProductFulfillmentType,
  type EcommerceProductType,
  type EcommerceRental,
  type EcommerceRentalPeriod,
  type EcommerceRentalStatus,
  type EcommerceRentalTransmission,
  type EcommerceRentalFuel,
  type EcommerceLocationSettings,
  type EcommerceCarReservation,
  type EcommerceCarReservationStatus,
  type EcommerceCarTripType,
  type EcommerceStore,
  type EcommerceSalesReportSource,
  type SellerWalletBootstrap,
} from '@/lib/ecommerce-api';
import EcommercePosPanel from '@/pages/ecommerce-pos-panel';
import EcommerceExpensesPanel from '@/pages/ecommerce-expenses-panel';
import { EcommerceExpenseCategoriesPanel } from '@/pages/ecommerce-expense-categories-panel';
import EcommerceSalesReportPanel from '@/pages/ecommerce-sales-report-panel';
import { EcommerceExpenseReportPanel } from '@/pages/ecommerce-expense-report-panel';
import { useQueryTab } from '@/lib/query-tab';
import { isEcommerceTabVisible } from '@/lib/ecommerce-navigation';
import { useAppDialog } from '@/components/confirm-dialog';
import { WorkspaceTabs } from '@/components/workspace-tabs';
import { ResponsiveFilterGroup } from '@/components/responsive-filter-group';
import { countActiveFilters } from '@/lib/filter-group';
import { buildPublicProductUrl } from '@/lib/ecommerce-product-link';
import { showAppToast } from '@workspace/maximus-design-system/hooks/use-toast';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';

type EcommerceTab = 'dashboard' | 'accueil' | 'catalogue' | 'vente-comptoir' | 'depenses' | 'investissements' | 'rapport-ventes' | 'categories' | 'commandes' | 'clients' | 'promotions' | 'location' | 'livraisons' | 'finances' | 'parametres';

const tabs: { id: EcommerceTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'accueil', label: 'Accueil', icon: House },
  { id: 'catalogue', label: 'Catalogue', icon: Package },
  { id: 'vente-comptoir', label: 'Vente comptoir', icon: ShoppingBag },
  { id: 'depenses', label: 'Dépenses', icon: Banknote },
  { id: 'investissements', label: 'Investissements', icon: CircleDollarSign },
  { id: 'rapport-ventes', label: 'Rapport', icon: BarChart3 },
  { id: 'categories', label: 'Catégories', icon: Tags },
  { id: 'commandes', label: 'Commandes', icon: ClipboardList },
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'promotions', label: 'Promotions', icon: Megaphone },
  { id: 'location', label: 'Location', icon: House },
  { id: 'livraisons', label: 'Livraisons', icon: Truck },
  { id: 'finances', label: 'Finances & retraits', icon: Wallet },
  { id: 'parametres', label: 'Paramètres', icon: Settings },
];

const orderStatuses: EcommerceOrderStatus[] = ['NOUVELLE', 'CONFIRMÉE', 'EN PRÉPARATION', 'EXPÉDIÉE', 'LIVRÉE', 'ANNULÉE'];
const allowedNextStatuses = (status: EcommerceOrderStatus): EcommerceOrderStatus[] => ({
  'NOUVELLE': ['NOUVELLE', 'CONFIRMÉE', 'ANNULÉE'],
  'CONFIRMÉE': ['CONFIRMÉE', 'EN PRÉPARATION', 'ANNULÉE'],
  'EN PRÉPARATION': ['EN PRÉPARATION', 'EXPÉDIÉE', 'ANNULÉE'],
  'EXPÉDIÉE': ['EXPÉDIÉE', 'LIVRÉE'],
  'LIVRÉE': ['LIVRÉE'],
  'ANNULÉE': ['ANNULÉE'],
}[status] as EcommerceOrderStatus[]);
const money = (value: number, currency: EcommerceStore['currency'] = 'XOF') =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: currency === 'XOF' ? 0 : 2 }).format(value) + ` ${currency}`;
const revenueAmount = (value: number, currency: string) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: currency === 'XOF' ? 0 : 2 }).format(value)} ${currency}`;
const revenueBreakdown = (rows: EcommerceBootstrap['revenueSummary'], field: 'total' | 'online' | 'counter' | 'todayTotal' | 'todayOnline' | 'todayCounter' = 'total') =>
  rows.length
    ? rows.map(row => revenueAmount(row[field], row.currency)).join(' · ')
    : '0 XOF';
const dateLabel = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(parsed);
};
const slugify = (value: string) =>
  value.trim().toLocaleLowerCase('fr-FR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const maximusShopColors = {
  primaryColor: '#D69E2E',
  accentColor: '#172033',
} as const;

function normalizeEcommerceBootstrap(value: EcommerceBootstrap, companyId: string): EcommerceBootstrap {
  const payload = value && typeof value === 'object' ? value : {} as EcommerceBootstrap;
  const orders = Array.isArray(payload.orders)
    ? payload.orders
        .filter(order => Boolean(order && typeof order === 'object'))
        .map(order => ({ ...order, items: Array.isArray(order.items) ? order.items : [] }))
    : [];

  return {
    ...payload,
    store: payload.store ?? {
      id: `store-${companyId || 'unknown'}`,
      companyId,
      slug: '',
      name: 'Votre boutique',
      description: '',
      status: 'DRAFT',
      currency: 'XOF',
      ...maximusShopColors,
      logoUrl: '',
      allowOrderAttachments: false,
      heroImages: [],
    },
    domains: Array.isArray(payload.domains) ? payload.domains : [],
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    products: Array.isArray(payload.products) ? payload.products : [],
    rentals: Array.isArray(payload.rentals) ? payload.rentals : [],
    orders,
    deliveryZones: Array.isArray(payload.deliveryZones) ? payload.deliveryZones : [],
    deliveryRequests: Array.isArray(payload.deliveryRequests) ? payload.deliveryRequests : [],
  };
}

type ProductForm = {
  name: string;
  slug: string;
  sku: string;
  description: string;
  category: string;
  categoryId: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  productType: EcommerceProductType;
  fulfillmentType: EcommerceProductFulfillmentType;
  rentalPeriod: EcommerceRentalPeriod;
  imageUrl: string;
  imageFile: File | null;
  galleryUrls: string[];
  galleryFiles: File[];
  digitalFile: File | null;
  digitalFileName: string;
  featured: boolean;
  status: EcommerceProduct['status'];
};

type RentalForm = {
  name: string;
  description: string;
  category: string;
  categoryId: string;
  imageFile: File | null;
  price: string;
  billingUnit: EcommerceRentalPeriod;
  availability: string;
  brand: string;
  model: string;
  year: string;
  seats: string;
  transmission: EcommerceRentalTransmission | '';
  fuel: EcommerceRentalFuel | '';
  equipment: string;
  galleryUrls: string[];
  galleryFiles: File[];
  dailyRate: string;
  kmRate: string;
  deposit: string;
  fees: string;
  conditions: string;
  instructions: string;
  unavailablePeriods: string;
  status: EcommerceRentalStatus;
};

const blankRental: RentalForm = {
  name: '',
  description: '',
  category: 'Général',
  categoryId: '',
  imageFile: null,
  galleryUrls: [],
  price: '',
  billingUnit: 'JOUR',
  availability: '1',
  brand: '',
  model: '',
  year: '',
  seats: '',
  transmission: '',
  fuel: '',
  equipment: '',
  galleryFiles: [],
  dailyRate: '',
  kmRate: '',
  deposit: '',
  fees: '',
  conditions: '',
  instructions: '',
  unavailablePeriods: '[]',
  status: 'PUBLISHED',
};

const blankProduct: ProductForm = {
  name: '',
  slug: '',
  sku: '',
  description: '',
  category: 'Divers',
  categoryId: '',
  price: '',
  compareAtPrice: '',
  stock: '0',
  productType: 'SALE',
  fulfillmentType: 'PHYSICAL',
  rentalPeriod: 'JOUR',
  imageUrl: '',
  imageFile: null,
  galleryUrls: [],
  galleryFiles: [],
  digitalFile: null,
  digitalFileName: '',
  featured: false,
  status: 'PUBLISHED',
};

const digitalFileAccept = [
  'video/*',
  'audio/*',
  'application/pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
].join(',');

export default function EcommerceModulePage({
  companyId,
  canCreate = true,
  canModify = true,
  allowedFeatureIds,
  featurePermissions,
  singleModuleNavigation = false,
  preview = false,
}: {
  companyId: string;
  canCreate?: boolean;
  canModify?: boolean;
  allowedFeatureIds?: string[];
  featurePermissions?: Partial<Record<string, string[]>>;
  singleModuleNavigation?: boolean;
  preview?: boolean;
}) {
  const [data, setData] = useState<EcommerceBootstrap | null>(null);
  const [walletData, setWalletData] = useState<SellerWalletBootstrap | null>(null);
  const [posData, setPosData] = useState<EcommercePosSalesBootstrap | null>(null);
  const [expensesData, setExpensesData] = useState<EcommerceExpensesBootstrap | null>(null);
  const [investmentsData, setInvestmentsData] = useState<EcommerceExpensesBootstrap | null>(null);
  const reportSources = useMemo<EcommerceSalesReportSource[]>(
    () => preview ? ['ONLINE', 'COUNTER'] : [],
    [preview],
  );
  const visibleTabs = tabs.filter(item => isEcommerceTabVisible(item.id, allowedFeatureIds, featurePermissions));
  const visibleTabIds = visibleTabs.map(item => item.id);
  const [tab, setTab] = useQueryTab({ tabs: visibleTabIds, defaultTab: visibleTabIds[0] ?? 'dashboard' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const api = createEcommerceApi(companyId);

  const load = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    if (preview) {
      setData({
        store: {
          id: `preview-store-${companyId || 'module'}`,
          companyId: companyId || 'module-preview',
          slug: 'aperçu-boutique',
          name: 'Aperçu boutique',
          description: 'Aperçu administratif sans données de production.',
          status: 'DRAFT',
          homepageEnabled: true,
          bannerEnabled: true,
          currency: 'XOF',
          ...maximusShopColors,
          logoUrl: '',
          allowOrderAttachments: false,
          heroImages: [],
        },
        domains: [],
        categories: [],
        products: [],
        rentals: [],
        orders: [],
        revenueSummary: [],
        deliveryZones: [],
        deliveryRequests: [],
      });
      setWalletData(null);
      setPosData({
        sales: [],
        summary: {
          currency: 'XOF',
          todaySalesCount: 0,
          todayRevenue: 0,
          todayCashReceived: 0,
          todayMobileMoneyReceived: 0,
          todayChangeGiven: 0,
        },
      });
      setExpensesData({
        currency: 'XOF',
        type: 'PERSONAL',
        categories: [],
        expenses: [],
        expenseSummary: { total: 0, todayTotal: 0, investmentTotal: 0, personalTotal: 0, netToday: 0, netTotal: 0 },
      });
      setInvestmentsData({
        currency: 'XOF',
        type: 'INVESTMENT',
        categories: [],
        expenses: [],
        expenseSummary: { total: 0, todayTotal: 0, investmentTotal: 0, personalTotal: 0, netToday: 0, netTotal: 0 },
      });
      setError('');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [bootstrap, nextWalletData, nextPosData, nextExpensesData, nextInvestmentsData] = await Promise.all([
        api.bootstrap(),
        visibleTabIds.includes('finances') ? api.wallet() : Promise.resolve(null),
        visibleTabIds.includes('vente-comptoir') ? api.posSales() : Promise.resolve(null),
        visibleTabIds.includes('depenses') ? api.posExpenses('PERSONAL') : Promise.resolve(null),
        visibleTabIds.includes('investissements') ? api.posExpenses('INVESTMENT') : Promise.resolve(null),
      ]);
      const nextData = normalizeEcommerceBootstrap(bootstrap, companyId);
      setData(nextData);
      setWalletData(nextWalletData);
      setPosData(nextPosData);
      setExpensesData(nextExpensesData);
      setInvestmentsData(nextInvestmentsData);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger l’espace e-commerce.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [companyId, preview]);
  useAutoRefresh(() => load(true), { enabled: !preview && Boolean(data) });

  const run = async <T,>(action: () => Promise<T>, success: string, actionKey = 'action'): Promise<T | undefined> => {
    if (pendingAction) return undefined;
    setPendingAction(actionKey);
    showAppToast('Action en cours…', 'info');
    try {
      const result = await action();
      showAppToast(success, 'success');
      setError('');
      // Refresh in the background. The mutation response already confirms
      // the action, so a second bootstrap request must not block the UI.
      void load(true);
      return result;
    } catch (cause) {
      showAppToast(cause instanceof Error ? cause.message : 'Opération impossible.', 'error');
      return undefined;
    } finally {
      setPendingAction('');
    }
  };

  if (loading) return <LoadingState />;
  if (!data) return <ErrorState message={error} onRetry={() => void load()} />;

  const store = data.store;
  const publicShopUrl = `/shop/${encodeURIComponent(store.slug || slugify(store.name) || 'boutique')}`;
  const navigate = (next: EcommerceTab) => setTab(next);
  const permissionFeatureId = tab === 'accueil' ? 'parametres' : tab;
  const currentFeaturePermissions = featurePermissions?.[permissionFeatureId];
  const currentCanCreate = Boolean(canCreate && (!featurePermissions || currentFeaturePermissions?.includes('créer')));
  const currentCanModify = Boolean(canModify && currentCanCreate && (!featurePermissions || currentFeaturePermissions?.includes('modifier')));
  const hasFeatureAccess = (featureId: string, action: string) =>
    (!allowedFeatureIds || allowedFeatureIds.includes(featureId))
    && (!featurePermissions || Boolean(featurePermissions[featureId]?.includes(action)));

  return (
    <div className="space-y-5" data-testid="ecommerce-module" aria-busy={Boolean(pendingAction)}>
      {pendingAction && (
        <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--primary)/.24)] bg-[hsl(var(--primary)/.07)] px-4 py-3 text-sm font-semibold text-[hsl(var(--primary))]" role="status">
          <RefreshCw size={15} className="animate-spin" aria-hidden="true" />
          Enregistrement en cours…
        </div>
      )}
      {error && <div className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--destructive)/.28)] bg-[hsl(var(--destructive)/.07)] px-4 py-3 text-sm text-[hsl(var(--destructive))]"><span>{error}</span><button type="button" aria-label="Fermer le message" onClick={() => setError('')}><X size={16} /></button></div>}
      <section className="rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))]">
        <div className="ecommerce-identity grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:col-start-1">
            <a
              href={publicShopUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="button-open-public-shop"
              title="Ouvrir la boutique publique"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[hsl(var(--sidebar-border))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--sidebar-foreground)/.9)] hover:bg-[hsl(var(--sidebar-accent))]"
            >
              <ArrowUpRight size={14} />Ouvrir
            </a>
          </div>
          <div className="flex min-w-0 justify-center px-1 sm:col-start-2 sm:px-2">
            <span className="truncate text-center text-lg font-black tracking-[-.04em] text-white drop-shadow-sm sm:text-2xl lg:text-3xl">
              {store.name || 'Votre boutique'}
            </span>
          </div>
          <button type="button" onClick={() => void load(true)} aria-label="Actualiser" className="inline-flex shrink-0 items-center justify-center gap-2 justify-self-end rounded-lg border border-[hsl(var(--sidebar-border))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--sidebar-foreground)/.8)] hover:bg-[hsl(var(--sidebar-accent))] sm:col-start-3" title="Actualiser">
            <RefreshCw size={14} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} /><span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </section>

      {!singleModuleNavigation && (
        <section className="sticky top-0 z-20 rounded-2xl border bg-[hsl(var(--card))] p-2 shadow-sm">
          <WorkspaceTabs
            sidebarNavigation={singleModuleNavigation}
            items={visibleTabs}
            activeId={tab}
            onChange={id => navigate(id as EcommerceTab)}
            ariaLabel="Fonctionnalités e-commerce"
            testIdPrefix="ecommerce-tab"
            className="flex-wrap"
          />
        </section>
      )}

      {visibleTabs.length === 0 ? <Empty icon={ShoppingBag} title="Aucune fonctionnalité disponible" text="Votre rôle n’a pas encore reçu de fonctionnalité e-commerce." /> : <>
      {tab === 'dashboard' && <Dashboard data={data} posData={posData ?? undefined} expensesData={expensesData ?? undefined} onTab={navigate} />}
      {tab === 'accueil' && <HomePanel store={store} canModify={currentCanModify} run={run} />}
      {tab === 'catalogue' && <Catalogue data={data} allowedFeatureIds={allowedFeatureIds} canCreate={currentCanCreate} canModify={currentCanModify} run={run} />}
      {tab === 'vente-comptoir' && posData && (
        <EcommercePosPanel
          idempotencyScope={companyId}
          products={data.products}
          sales={posData.sales}
          summary={posData.summary}
          revenueSummary={data.revenueSummary}
          currency={store.currency}
          canCreate={currentCanCreate}
          loading={!posData}
          onCreateSale={async input => {
            const result = await api.createPosSale(input);
            void load(true);
            return result.sale;
          }}
        />
      )}
      {tab === 'depenses' && expensesData && (
        <EcommerceExpensesPanel
          data={expensesData}
          mode="PERSONAL"
          canCreate={currentCanCreate}
          onCreateExpense={async input => {
            await api.createPosExpense(input);
            await load(true);
          }}
        />
      )}
      {tab === 'investissements' && investmentsData && (
        <EcommerceExpensesPanel
          data={investmentsData}
          mode="INVESTMENT"
          canCreate={currentCanCreate}
          onCreateExpense={async input => {
            await api.createPosExpense(input);
            await load(true);
          }}
        />
      )}
      {tab === 'rapport-ventes' && (
        <EcommerceSalesReportPanel
          companyId={companyId}
          availableSources={reportSources}
          canViewSalesReport={hasFeatureAccess('rapport-ventes', 'voir')}
          availableExpenseReports={[
            ...(hasFeatureAccess('depenses', 'voir') ? ['PERSONAL' as const] : []),
            ...(hasFeatureAccess('investissements', 'voir') ? ['INVESTMENT' as const] : []),
          ]}
          storeName={store.name}
          preview={preview}
        />
      )}
      {tab === 'categories' && <CategoryManager
        data={data}
        canCreate={currentCanCreate}
        canModify={currentCanModify}
        showProductCategories={!allowedFeatureIds || allowedFeatureIds.includes('catalogue')}
        canViewExpenses={hasFeatureAccess('depenses', 'voir')}
        canCreateExpenses={Boolean(canCreate && hasFeatureAccess('depenses', 'créer'))}
        canModifyExpenses={Boolean(canModify && hasFeatureAccess('depenses', 'modifier'))}
        canViewInvestments={hasFeatureAccess('investissements', 'voir')}
        canCreateInvestments={Boolean(canCreate && hasFeatureAccess('investissements', 'créer'))}
        canModifyInvestments={Boolean(canModify && hasFeatureAccess('investissements', 'modifier'))}
        run={run}
      />}
      {tab === 'commandes' && <><Orders data={data} canCreate={currentCanCreate && hasFeatureAccess('commandes', 'créer')} canModify={currentCanModify} run={run} onCreate={async input => { await api.createCompanyOrder(input); await load(true); }} /><OrderAttachments data={data} /></>}
      {tab === 'clients' && <Clients data={data} />}
      {tab === 'promotions' && <Promotions />}
       {tab === 'location' && <RentalPanel data={data} canCreate={currentCanCreate} canModify={currentCanModify} run={run} />}
      {tab === 'livraisons' && <Deliveries data={data} canCreate={currentCanCreate} canModify={currentCanModify} run={run} />}
      {tab === 'finances' && walletData && <WalletPanel data={walletData} currency={store.currency} canModify={currentCanModify} run={run} pendingAction={pendingAction} />}
      {tab === 'parametres' && <SettingsPanel store={store} canModify={currentCanModify} run={run} />}
      </>}
    </div>
  );
}

function LoadingState() {
  return <div className="card-surface min-h-80 rounded-2xl p-5 sm:p-7" aria-label="Chargement de la boutique"><div className="h-3 w-36 animate-pulse rounded bg-[hsl(var(--muted))]" /><div className="mt-4 h-8 w-72 animate-pulse rounded bg-[hsl(var(--muted))]" /><div className="mt-3 h-4 max-w-xl animate-pulse rounded bg-[hsl(var(--muted)/.72)]" /><div className="mt-8 grid gap-3 sm:grid-cols-3"><div className="h-28 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /><div className="h-28 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /><div className="h-28 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /></div><div className="mt-5 h-52 animate-pulse rounded-xl bg-[hsl(var(--muted)/.7)]" /></div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="card-surface rounded-2xl p-8"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]"><Store size={20} /></div><h2 className="mt-4 text-lg font-bold">La boutique n’est pas disponible</h2><p className="mt-2 max-w-lg text-sm leading-6 text-[hsl(var(--muted-foreground))]">{message || 'Une erreur inattendue empêche le chargement de cet espace.'}</p><button type="button" onClick={onRetry} className="btn mt-5 inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]"><RefreshCw size={14} />Réessayer</button></div>;
}

function Dashboard({ data, posData, expensesData, onTab }: { data: EcommerceBootstrap; posData?: EcommercePosSalesBootstrap; expensesData?: EcommerceExpensesBootstrap; onTab: (tab: EcommerceTab) => void }) {
  const activeProducts = data.products.filter(product => product.status !== 'ARCHIVED');
  const published = activeProducts.filter(product => product.status === 'PUBLISHED').length;
  const pending = data.orders.filter(order => !['LIVRÉE', 'ANNULÉE'].includes(order.status)).length;
  const lowStock = activeProducts.filter(product => product.stock <= 5);
  return <div className="space-y-5 fade-up">
    <div className="mobile-kpi-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="CA cumulé" value={revenueBreakdown(data.revenueSummary)} detail="En ligne + comptoir · cumulé depuis le début" icon={CircleDollarSign} accent />
      <Metric label="CA total aujourd’hui" value={revenueBreakdown(data.revenueSummary, 'todayTotal')} detail="Ventes payées en ligne + comptoir" icon={Banknote} />
      {expensesData && <Metric label="Dépenses cumulées" value={money(expensesData.expenseSummary.total, expensesData.currency)} detail="Investissements + dépenses personnelles" icon={Banknote} />}
      {expensesData && <Metric label="Solde net cumulé" value={money(expensesData.expenseSummary.netTotal, expensesData.currency)} detail="CA brut de la devise boutique − dépenses" icon={CircleDollarSign} />}
      <Metric label="Commandes à traiter" value={String(pending)} detail="Dans le flux opérationnel" icon={ClipboardList} />
      <Metric label="Catalogue publié" value={`${published}/${activeProducts.length}`} detail="Références visibles en ligne" icon={ShoppingBag} />
      <Metric label="Stock à surveiller" value={String(lowStock.length)} detail="5 unités ou moins" icon={Package} warning={lowStock.length > 0} />
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <Panel title="Commandes récentes" description="Le dernier mouvement de votre boutique, au même endroit." action={<button type="button" onClick={() => onTab('commandes')} className="text-xs font-bold text-[hsl(var(--primary))]">Voir toutes les commandes <ChevronRight className="inline" size={14} /></button>}>
        {data.orders.length === 0 ? <Empty icon={ClipboardList} title="Pas encore de commande" text="Les commandes de votre boutique apparaîtront ici dès la première vente." action={<button type="button" onClick={() => onTab('catalogue')} className="text-xs font-bold text-[hsl(var(--primary))]">Vérifier le catalogue</button>} /> : <div className="divide-y">{data.orders.slice(0, 5).map(order => <OrderRow key={order.id} order={order} currency={data.store.currency} />)}</div>}
      </Panel>
      <Panel title="À surveiller" description="Les signaux qui méritent votre attention." action={<button type="button" onClick={() => onTab('catalogue')} className="text-xs font-bold text-[hsl(var(--primary))]">Catalogue <ChevronRight className="inline" size={14} /></button>}>
        <div className="space-y-3">
          {lowStock.length === 0 && <Empty icon={Check} title="Tout est sous contrôle" text="Aucune référence ne se trouve sous le seuil de surveillance." />}
          {lowStock.slice(0, 5).map(product => <div key={product.id} className="flex items-center gap-3 rounded-xl border border-[hsl(var(--accent)/.3)] bg-[hsl(var(--accent)/.08)] p-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--accent)/.2)] text-[hsl(var(--foreground))]"><Package size={16} /></span><div className="min-w-0"><p className="truncate text-sm font-bold">{product.name}</p><p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{product.stock} unité{product.stock > 1 ? 's' : ''} restante{product.stock > 1 ? 's' : ''}</p></div><span className="mono ml-auto text-xs font-bold">{product.sku}</span></div>)}
        </div>
         <div className="mt-5 rounded-xl border border-dashed p-4"><p className="mono text-[9px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Vitrine</p><p className="mt-2 text-sm font-bold">Votre boutique est {data.store.status === 'PUBLISHED' ? 'ouverte au public' : 'en préparation'}.</p><button type="button" onClick={() => onTab('accueil')} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--primary))]">Gérer l’accueil <ArrowUpRight size={13} /></button></div>
      </Panel>
    </div>
    {posData && <Panel title="Ventes comptoir récentes" description="Les encaissements en magasin sont suivis séparément des commandes en ligne." action={<button type="button" onClick={() => onTab('vente-comptoir')} className="text-xs font-bold text-[hsl(var(--primary))]">Ouvrir la caisse <ChevronRight className="inline" size={14} /></button>}>
      {posData.sales.length === 0
        ? <Empty icon={ShoppingBag} title="Pas encore de vente comptoir" text="Les ventes encaissées en magasin apparaîtront ici." />
        : <div className="divide-y">{posData.sales.slice(0, 5).map(sale => <CounterSaleRow key={sale.id} sale={sale} />)}</div>}
    </Panel>}
    <Panel title="Performance du catalogue" description="Une lecture rapide de la couverture de votre assortiment.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Insight label="Références actives" value={activeProducts.length} detail="Non archivées" />
        <Insight label="Produits vedettes" value={activeProducts.filter(product => product.featured).length} detail="Mis en avant" />
        <Insight label="Catégories" value={new Set(activeProducts.map(product => product.category)).size} detail="Dans le catalogue" />
      </div>
    </Panel>
  </div>;
}

function RentalPanel({ data, canCreate, canModify, run }: { data: EcommerceBootstrap; canCreate: boolean; canModify: boolean; run: (action: () => Promise<unknown>, success: string) => Promise<unknown | undefined> }) {
  const [subTab, setSubTab] = useState<'vehicules' | 'reservations' | 'parametres'>('vehicules');
  
  return <div className="space-y-5 fade-up">
    <section className="overflow-hidden rounded-2xl border border-[hsl(var(--primary)/.22)] bg-[linear-gradient(135deg,hsl(var(--primary)/.14),hsl(var(--card))_55%)] p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><span className="mono text-[10px] font-bold uppercase tracking-[.2em] text-[hsl(var(--primary))]">Location & réservation</span><h2 className="mt-2 text-2xl font-bold tracking-[-.04em]">Espace de gestion automobile</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Gérez votre flotte, suivez vos réservations et configurez vos paramètres de location.</p></div>
      </div>
    </section>
    
    <div className="flex gap-2 border-b">
      <button type="button" onClick={() => setSubTab('vehicules')} className={`px-4 py-2 text-sm font-bold border-b-2 ${subTab === 'vehicules' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>Véhicules</button>
      <button type="button" onClick={() => setSubTab('reservations')} className={`px-4 py-2 text-sm font-bold border-b-2 ${subTab === 'reservations' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>Réservations</button>
      <button type="button" onClick={() => setSubTab('parametres')} className={`px-4 py-2 text-sm font-bold border-b-2 ${subTab === 'parametres' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>Paramètres</button>
    </div>

    {subTab === 'vehicules' && <RentalVehiclesTab data={data} canCreate={canCreate} canModify={canModify} run={run} />}
    {subTab === 'reservations' && <RentalReservationsTab data={data} canModify={canModify} run={run} />}
    {subTab === 'parametres' && <RentalSettingsTab data={data} canModify={canModify} run={run} />}
  </div>;
}

function RentalVehiclesTab({ data, canCreate, canModify, run }: { data: EcommerceBootstrap; canCreate: boolean; canModify: boolean; run: (action: () => Promise<unknown>, success: string) => Promise<unknown | undefined> }) {
  const { confirm, alert } = useAppDialog();
  const [editing, setEditing] = useState<EcommerceRental | 'new' | null>(null);
  const [form, setForm] = useState<RentalForm>(blankRental);
  const rentals = data.rentals;
  const activeRentals = rentals.filter(rental => rental.status !== 'ARCHIVED');
  const open = (rental?: EcommerceRental) => {
    setEditing(rental ?? 'new');
    setForm(rental ? {
      name: rental.name, description: rental.description, category: rental.category, categoryId: rental.categoryId ?? '',
      imageFile: null, galleryUrls: Array.isArray(rental.gallery) ? rental.gallery : [], price: String(rental.price), billingUnit: rental.billingUnit, availability: String(rental.availability),
      brand: rental.brand ?? '', model: rental.model ?? '', year: rental.year ? String(rental.year) : '', seats: rental.seats ? String(rental.seats) : '',
      transmission: rental.transmission ?? '', fuel: rental.fuel ?? '', equipment: Array.isArray(rental.equipment) ? rental.equipment.join(', ') : '',
       galleryFiles: [], dailyRate: rental.dailyRate ? String(rental.dailyRate) : String(rental.price), kmRate: rental.kmRate ? String(rental.kmRate) : '',
      deposit: rental.deposit ? String(rental.deposit) : '', fees: rental.fees ? String(rental.fees) : '', conditions: rental.conditions ?? '',
      instructions: rental.instructions ?? '', unavailablePeriods: typeof rental.unavailablePeriods === 'string' ? rental.unavailablePeriods : JSON.stringify(rental.unavailablePeriods ?? []), status: rental.status
    } : blankRental);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!canModify && (form.imageFile || form.galleryFiles.length > 0)) {
      await alert({ title: 'Droit Modifier requis', description: 'L’ajout de médias à une fiche existante nécessite le droit Modifier.', confirmLabel: 'Compris' });
      return;
    }
    const price = Number(form.price);
    const availability = Number(form.availability);
    if (!form.name.trim() || (!form.categoryId && !form.category.trim()) || !Number.isInteger(price) || price < 0 || !Number.isInteger(availability) || availability < 0) {
      await alert({ title: 'Informations incomplètes', description: 'Renseignez un nom, un tarif et une disponibilité valides.', confirmLabel: 'Compris' });
      return;
    }
    const category = data.categories.find(item => item.id === form.categoryId);
    const body = {
      name: form.name.trim(), description: form.description.trim(), category: category?.name ?? form.category.trim(), categoryId: form.categoryId || null,
      price, billingUnit: form.billingUnit, availability,
      brand: form.brand.trim() || null, model: form.model.trim() || null, year: form.year ? Number(form.year) : null, seats: form.seats ? Number(form.seats) : null,
      transmission: form.transmission || null, fuel: form.fuel || null, equipment: form.equipment ? form.equipment.split(',').map(s => s.trim()).filter(Boolean) : null,
      dailyRate: form.dailyRate ? Number(form.dailyRate) : price, kmRate: form.kmRate ? Number(form.kmRate) : 0, deposit: form.deposit ? Number(form.deposit) : 0, fees: form.fees ? Number(form.fees) : 0,
      conditions: form.conditions.trim() || null, instructions: form.instructions.trim() || null, unavailablePeriods: (() => { try { return JSON.parse(form.unavailablePeriods); } catch { return []; } })(),
      status: form.status
    };
    const result = editing === 'new'
      ? await run(() => createEcommerceApi(data.store.companyId).createRental(body), 'Location ajoutée.')
      : editing ? await run(() => createEcommerceApi(data.store.companyId).updateRental(editing.id, body), 'Location mise à jour.') : undefined;
    if (result) setEditing(null);
    if (result && canModify && form.imageFile) {
      await run(() => createEcommerceApi(data.store.companyId).uploadRentalImage((result as EcommerceRental).id, form.imageFile as File), 'Location et photo enregistrées.');
    }
    if (result && canModify && form.galleryFiles.length > 0) {
      await run(() => createEcommerceApi(data.store.companyId).uploadRentalGallery((result as EcommerceRental).id, form.galleryFiles), 'Galerie de la location enregistrée.');
    }
  };
  const archive = async (rental: EcommerceRental) => {
    if (!await confirm({ title: 'Archiver cette location ?', description: `« ${rental.name} » ne sera plus affichée dans la vitrine.`, confirmLabel: 'Archiver', tone: 'danger' })) return;
    await run(() => createEcommerceApi(data.store.companyId).archiveRental(rental.id), 'Location archivée.');
  };
  const setAvailability = async (rental: EcommerceRental, value: string) => {
    const availability = Number(value);
    if (Number.isInteger(availability) && availability >= 0) await run(() => createEcommerceApi(data.store.companyId).updateRentalAvailability(rental.id, availability), 'Disponibilité mise à jour.');
  };

  return <div className="space-y-5 fade-up">
    <div className="grid gap-4 sm:grid-cols-3"><Metric label="Véhicules" value={String(activeRentals.length)} detail="Dans la flotte" icon={House} accent /><Metric label="Disponibles" value={String(activeRentals.filter(rental => rental.isAvailable).length)} detail="Avec une capacité positive" icon={CheckCircle2} /><Metric label="En ligne" value={String(activeRentals.filter(rental => rental.status === 'PUBLISHED').length)} detail="Statut publié" icon={Megaphone} /></div>
    <Panel title="Flotte de véhicules" description="Gérez votre catalogue de voitures de location." action={canCreate ? <button type="button" onClick={() => open()} className="text-xs font-bold text-[hsl(var(--primary))]"><Plus className="inline mr-1" size={14}/>Ajouter un véhicule</button> : undefined}>
        {activeRentals.length === 0 ? <Empty icon={House} title="Aucun véhicule" text="Créez votre première offre autonome pour l’afficher dans la rubrique Location." action={canCreate ? <button type="button" onClick={() => open()} className="text-xs font-bold text-[hsl(var(--primary))]">Ajouter un véhicule</button> : undefined} /> : <div className="table-scroll"><table className="w-full text-left text-sm"><thead><tr><th className="px-4">Véhicule</th><th className="px-4">Tarif jour</th><th className="px-4">Disponibilité</th><th className="px-4">Statut</th><th className="px-4">Actions</th></tr></thead><tbody className="divide-y">{activeRentals.map(rental => <tr key={rental.id}><td className="px-4 py-3"><div className="flex items-center gap-3">{rental.imageUrl ? <img src={rental.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><House size={17} /></span>}<span className="min-w-0"><strong className="block truncate">{rental.name}</strong><small className="text-xs text-[hsl(var(--muted-foreground))]">{rental.category}</small></span></div></td><td className="px-4 py-3 font-bold">{money(rental.dailyRate ?? rental.price, data.store.currency)}</td><td className="px-4 py-3"><input aria-label={`Disponibilité de ${rental.name}`} type="number" min="0" value={rental.availability} disabled={!canModify} onChange={event => void setAvailability(rental, event.target.value)} className="w-24 rounded-lg border bg-transparent px-2.5 py-2 text-sm font-bold disabled:opacity-50" /></td><td className="px-4 py-3"><StatusPill value={rental.status === 'PUBLISHED' && rental.isAvailable ? 'Disponible' : rental.status} /></td><td className="px-4 py-3"><div className="flex flex-wrap justify-end gap-1.5">{canModify && <button type="button" onClick={() => open(rental)} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10px] font-bold"><Pencil size={13} />Modifier</button>}{canModify && <button type="button" onClick={() => void archive(rental)} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10px] font-bold text-[hsl(var(--destructive))]"><Archive size={13} />Archiver</button>}</div></td></tr>)}</tbody></table></div>}
    </Panel>
      {editing && <RentalModal editing={editing} form={form} categories={data.categories} setForm={setForm} onClose={() => setEditing(null)} onSave={save} onRemoveGallery={async url => {
        const imageId = url.split('/').pop();
        if (!imageId || !url.includes('/api/gallery-images/')) return;
        const result = await run(() => createEcommerceApi(data.store.companyId).deleteRentalGalleryImage(editing === 'new' ? '' : editing.id, imageId), 'Image supprimée de la galerie.');
        if (result) setForm(current => ({ ...current, galleryUrls: current.galleryUrls.filter(item => item !== url) }));
      }} />}
  </div>;
}

function RentalReservationsTab({ data, canModify, run }: { data: EcommerceBootstrap; canModify: boolean; run: (action: () => Promise<unknown>, success: string) => Promise<unknown | undefined> }) {
  const [reservations, setReservations] = useState<EcommerceCarReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const api = createEcommerceApi(data.store.companyId);
  const { alert } = useAppDialog();

  useEffect(() => {
    api.getLocationReservations().then(res => {
      setReservations(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const updateStatus = async (id: string, status: EcommerceCarReservationStatus) => {
    if (!canModify) return;
    const res = await run(() => api.updateLocationReservationStatus(id, status), 'Statut mis à jour.');
    if (res) {
      setReservations(reservations.map(r => r.id === id ? res as EcommerceCarReservation : r));
    }
  };

  const activeReservations = reservations.filter(r => !['COMPLETED', 'CANCELLED', 'PAYMENT_FAILED'].includes(r.status));
  const pendingCount = reservations.filter(r => r.status === 'PENDING_PAYMENT').length;
  const confirmedCount = reservations.filter(r => r.status === 'CONFIRMED').length;
  const inProgressCount = reservations.filter(r => r.status === 'IN_PROGRESS').length;

  if (loading) return <div className="p-8 text-center"><RefreshCw className="animate-spin mx-auto text-[hsl(var(--muted-foreground))]" size={24} /></div>;

  return <div className="space-y-5 fade-up">
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric label="En attente paiement" value={String(pendingCount)} detail="Réservations bloquées" icon={Clock3} />
      <Metric label="Confirmées" value={String(confirmedCount)} detail="A venir" icon={CheckCircle2} accent />
      <Metric label="En cours" value={String(inProgressCount)} detail="Véhicules sur la route" icon={Truck} />
    </div>
    <Panel title="Toutes les réservations" description="Suivez et gérez l'état de vos locations de véhicules.">
      {reservations.length === 0 ? <Empty icon={ClipboardList} title="Aucune réservation" text="Vos réservations de véhicules apparaîtront ici." /> : <div className="table-scroll"><table className="w-full text-left text-sm"><thead><tr><th className="px-4">Dates</th><th className="px-4">Véhicule</th><th className="px-4">Trajet</th><th className="px-4">Total</th><th className="px-4">Statut</th><th className="px-4">Actions</th></tr></thead><tbody className="divide-y">{reservations.map(r => {
        const car = data.rentals.find(c => c.id === r.rentalId);
        return <tr key={r.id}>
          <td className="px-4 py-3"><div className="font-bold text-xs">{dateLabel(r.startsAt)}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">au {dateLabel(r.endsAt)}</div></td>
          <td className="px-4 py-3"><div className="font-bold">{car?.name ?? 'Véhicule inconnu'}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">{r.tripType === 'BUSINESS' ? 'Affaires' : 'Famille'}</div></td>
          <td className="px-4 py-3"><div className="text-xs max-w-[12rem] truncate" title={r.departure}>{r.departure}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">vers {r.destination}</div></td>
          <td className="px-4 py-3 font-bold">{money(r.totalDetail.total, data.store.currency)}</td>
          <td className="px-4 py-3">
            <select disabled={!canModify || ['COMPLETED', 'CANCELLED'].includes(r.status)} value={r.status} onChange={e => void updateStatus(r.id, e.target.value as EcommerceCarReservationStatus)} className="rounded-lg border bg-transparent px-2 py-1.5 text-xs font-bold disabled:opacity-50">
              <option value={r.status}>{
                r.status === 'PENDING_PAYMENT' ? 'En attente paiement' :
                r.status === 'CONFIRMED' ? 'Confirmée' :
                r.status === 'IN_PROGRESS' ? 'En cours' :
                r.status === 'COMPLETED' ? 'Terminée' :
                r.status === 'CANCELLED' ? 'Annulée' :
                r.status === 'PAYMENT_FAILED' ? 'Paiement échoué' :
                r.status === 'UNAVAILABLE' ? 'Indisponible' : r.status
              }</option>
              {r.status === 'CONFIRMED' && <option value="IN_PROGRESS">En cours</option>}
              {r.status === 'IN_PROGRESS' && <option value="COMPLETED">Terminée</option>}
              {!['COMPLETED', 'CANCELLED'].includes(r.status) && <option value="CANCELLED">Annuler la réservation</option>}
            </select>
          </td>
          <td className="px-4 py-3 text-right">
            {r.invoiceAvailable && <a href={`/api/ecommerce/location/reservations/${r.id}/invoice?companyId=${data.store.companyId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-bold text-[hsl(var(--primary))]"><ArrowDownToLine size={13} />Facture</a>}
          </td>
        </tr>;
      })}</tbody></table></div>}
    </Panel>
  </div>;
}

function RentalSettingsTab({ data, canModify, run }: { data: EcommerceBootstrap; canModify: boolean; run: (action: () => Promise<unknown>, success: string) => Promise<unknown | undefined> }) {
  const [settings, setSettings] = useState<EcommerceLocationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const api = createEcommerceApi(data.store.companyId);

  useEffect(() => {
    api.getLocationSettings().then(res => {
      setSettings(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings || !canModify) return;
    await run(() => api.updateLocationSettings(settings), 'Paramètres enregistrés.');
  };

  if (loading) return <div className="p-8 text-center"><RefreshCw className="animate-spin mx-auto text-[hsl(var(--muted-foreground))]" size={24} /></div>;

  return <form onSubmit={save} className="space-y-5 fade-up">
    <Panel title="Configuration générale" description="Paramètres par défaut appliqués aux nouvelles offres de location.">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Tarif journalier par défaut" type="number" value={String(settings?.defaultDailyRate ?? 0)} onChange={v => setSettings(s => s ? { ...s, defaultDailyRate: Number(v) } : null)} />
        <Field label="Tarif au km par défaut" type="number" value={String(settings?.defaultKmRate ?? 0)} onChange={v => setSettings(s => s ? { ...s, defaultKmRate: Number(v) } : null)} />
        <Field label="Caution par défaut" type="number" value={String(settings?.defaultDeposit ?? 0)} onChange={v => setSettings(s => s ? { ...s, defaultDeposit: Number(v) } : null)} />
      </div>
      <div className="mt-4">
        <label className="block text-xs font-bold mb-1.5">Politique de location</label>
        <textarea rows={4} value={settings?.policy ?? ''} onChange={e => setSettings(s => s ? { ...s, policy: e.target.value } : null)} className="w-full rounded-lg border px-3 py-2.5 text-sm" placeholder="Conditions générales, âge minimum, etc." />
      </div>
    </Panel>
    <Panel title="Service client WhatsApp" description="Permet aux clients de vous contacter directement après une réservation confirmée.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Numéro WhatsApp" placeholder="Ex: +221770000000" value={settings?.whatsapp ?? ''} onChange={v => setSettings(s => s ? { ...s, whatsapp: v } : null)} />
        <Field label="Message par défaut" placeholder="Laisser vide pour utiliser le message automatique" value={settings?.message ?? ''} onChange={v => setSettings(s => s ? { ...s, message: v } : null)} />
      </div>
    </Panel>
    {canModify && <div className="flex justify-end"><button type="submit" className="rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))]">Enregistrer les paramètres</button></div>}
  </form>;
}

function RentalModal({ editing, form, categories, setForm, onClose, onSave, onRemoveGallery }: { editing: EcommerceRental | 'new'; form: RentalForm; categories: EcommerceCategory[]; setForm: (value: RentalForm) => void; onClose: () => void; onSave: (event: FormEvent) => void; onRemoveGallery: (url: string) => void }) {
  const patch = (updates: Partial<RentalForm>) => setForm({ ...form, ...updates });
  const [tab, setTab] = useState<'general' | 'specs' | 'pricing' | 'conditions'>('general');

  return <Modal large title={editing === 'new' ? 'Ajouter un véhicule' : `Modifier ${editing.name}`} onClose={onClose}>
    <div className="flex gap-2 border-b mb-4 px-4 pt-2 overflow-x-auto">
      <button type="button" onClick={() => setTab('general')} className={`px-3 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${tab === 'general' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>Général</button>
      <button type="button" onClick={() => setTab('specs')} className={`px-3 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${tab === 'specs' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>Spécifications</button>
      <button type="button" onClick={() => setTab('pricing')} className={`px-3 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${tab === 'pricing' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>Tarification</button>
      <button type="button" onClick={() => setTab('conditions')} className={`px-3 py-2 text-xs font-bold border-b-2 whitespace-nowrap ${tab === 'conditions' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))]'}`}>Conditions</button>
    </div>

    <form onSubmit={onSave} className="space-y-4 px-4 pb-4">
      {tab === 'general' && <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom du véhicule" required value={form.name} onChange={value => patch({ name: value })} placeholder="Ex. Toyota Corolla" />
          <label className="block text-xs font-bold">Catégorie
            <select value={form.categoryId} onChange={event => patch({ categoryId: event.target.value, category: event.target.options[event.target.selectedIndex]?.text ?? form.category })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm">
              <option value="">Sans catégorie</option>
              {categories.filter(category => category.isActive).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <Field label="Catégorie libre" value={form.categoryId ? categories.find(category => category.id === form.categoryId)?.name ?? form.category : form.category} onChange={value => patch({ category: value, categoryId: '' })} placeholder="Ex. Citadine" />
          <label className="block text-xs font-bold sm:col-span-2">Images du véhicule
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => { const files = Array.from(event.target.files ?? []); patch({ imageFile: files[0] ?? null, galleryFiles: files.slice(1) }); }} className="mt-1.5 block w-full rounded-lg border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[hsl(var(--muted))] file:px-2.5 file:py-1.5 file:text-xs file:font-bold" />
            <span className="mt-1 block text-[11px] font-normal text-[hsl(var(--muted-foreground))]">Le premier fichier devient l’image principale ; les suivants sont ajoutés à la galerie. Les images déjà enregistrées sont conservées.</span>
            {form.imageFile && <span className="mt-1 block truncate text-[11px] font-semibold text-[hsl(var(--primary))]">Image principale : {form.imageFile.name}{form.galleryFiles.length > 0 ? ` · ${form.galleryFiles.length} autre(s) ajoutée(s)` : ''}</span>}
            {editing !== 'new' && editing.imageUrl && !form.imageFile && <img src={editing.imageUrl} alt="" className="mt-2 h-16 w-16 rounded-lg object-cover" />}
            {form.galleryUrls.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{form.galleryUrls.map(url => <span key={url} className="relative"><img src={url} alt="" className="h-16 w-16 rounded-lg object-cover" /><button type="button" onClick={() => onRemoveGallery(url)} className="absolute -right-1 -top-1 rounded-full bg-[hsl(var(--destructive))] px-1.5 py-0.5 text-[10px] font-bold text-white" aria-label="Supprimer cette image">×</button></span>)}</div>}
          </label>
        <div className="flex items-center gap-3 mt-4 mb-2">
          <input id="car-availability" type="checkbox" checked={Number(form.availability) > 0} onChange={event => patch({ availability: event.target.checked ? '1' : '0' })} className="h-4 w-4 rounded border-gray-300 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]" />
          <label htmlFor="car-availability" className="text-xs font-bold">Véhicule disponible à la location</label>
        </div>
          <label className="block text-xs font-bold">Statut
            <select value={form.status} onChange={event => patch({ status: event.target.value as EcommerceRentalStatus })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm">
              <option value="DRAFT">Brouillon</option>
              <option value="PUBLISHED">Publié</option>
              <option value="ARCHIVED">Archivé</option>
            </select>
          </label>
        </div>
        <label className="block text-xs font-bold">Description
          <textarea value={form.description} onChange={event => patch({ description: event.target.value })} rows={4} placeholder="Décrivez le véhicule et ses points forts." className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm" />
        </label>
      </div>}

      {tab === 'specs' && <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marque" required={editing === 'new'} value={form.brand} onChange={value => patch({ brand: value })} placeholder="Ex. Toyota" />
        <Field label="Modèle" required={editing === 'new'} value={form.model} onChange={value => patch({ model: value })} placeholder="Ex. Corolla" />
        <Field label="Année" required={editing === 'new'} type="number" value={form.year} onChange={value => patch({ year: value })} placeholder="2023" />
        <Field label="Places" required={editing === 'new'} type="number" value={form.seats} onChange={value => patch({ seats: value })} placeholder="5" />
        <label className="block text-xs font-bold">Transmission{editing === 'new' && <span className="ml-1 text-red-500">*</span>}
          <select required={editing === 'new'} value={form.transmission} onChange={event => patch({ transmission: event.target.value as EcommerceRentalTransmission | '' })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm">
            <option value="">Sélectionner</option>
            <option value="MANUAL">Manuelle</option>
            <option value="AUTOMATIC">Automatique</option>
          </select>
        </label>
        <label className="block text-xs font-bold">Carburant{editing === 'new' && <span className="ml-1 text-red-500">*</span>}
          <select required={editing === 'new'} value={form.fuel} onChange={event => patch({ fuel: event.target.value as EcommerceRentalFuel | '' })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm">
            <option value="">Sélectionner</option>
            <option value="GASOLINE">Essence</option>
            <option value="DIESEL">Diesel</option>
            <option value="HYBRID">Hybride</option>
            <option value="ELECTRIC">Électrique</option>
          </select>
        </label>
        <div className="col-span-2">
          <Field label="Équipements (séparés par des virgules)" value={form.equipment} onChange={value => patch({ equipment: value })} placeholder="Climatisation, Bluetooth, GPS..." />
        </div>
      </div>}

      {tab === 'pricing' && <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tarif de base (fallback)" required type="number" value={form.price} onChange={value => patch({ price: value })} placeholder="0" />
        <label className="block text-xs font-bold">Unité de facturation
          <select value={form.billingUnit} onChange={event => patch({ billingUnit: event.target.value as EcommerceRentalPeriod })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm">
            <option value="JOUR">Par jour</option>
            <option value="SEMAINE">Par semaine</option>
            <option value="MOIS">Par mois</option>
          </select>
        </label>
        <Field label="Tarif journalier" required={editing === 'new'} type="number" value={form.dailyRate} onChange={value => patch({ dailyRate: value })} placeholder="0" />
        <Field label="Tarif au kilomètre" type="number" value={form.kmRate} onChange={value => patch({ kmRate: value })} placeholder="0" />
        <Field label="Frais fixes" type="number" value={form.fees} onChange={value => patch({ fees: value })} placeholder="0" />
        <Field label="Caution" type="number" value={form.deposit} onChange={value => patch({ deposit: value })} placeholder="0" />
      </div>}

      {tab === 'conditions' && <div className="space-y-4">
        <label className="block text-xs font-bold">Conditions spécifiques
          <textarea value={form.conditions} onChange={event => patch({ conditions: event.target.value })} rows={3} placeholder="Âge minimum, permis requis..." className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm" />
        </label>
        <label className="block text-xs font-bold">Instructions de retrait
          <textarea value={form.instructions} onChange={event => patch({ instructions: event.target.value })} rows={3} placeholder="Lieu de rendez-vous, contact sur place..." className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm" />
        </label>
        <label className="block text-xs font-bold">Périodes d'indisponibilité (JSON optionnel)
          <textarea value={form.unavailablePeriods} onChange={event => patch({ unavailablePeriods: event.target.value })} rows={2} placeholder='[{"startsAt": "2024-01-01", "endsAt": "2024-01-10"}]' className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm font-mono text-xs" />
        </label>
      </div>}

      <div className="modal-footer flex justify-end gap-2 pt-4 border-t">
        <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2.5 text-xs font-bold">Annuler</button>
        <button type="submit" className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]"><Check className="mr-1 inline" size={14} />Enregistrer</button>
      </div>
    </form>
  </Modal>;
}
function WalletPanel({ data, currency, canModify, run, pendingAction }: { data: SellerWalletBootstrap; currency: EcommerceStore['currency']; canModify: boolean; run: (action: () => Promise<unknown>, success: string, actionKey?: string) => Promise<unknown | undefined>; pendingAction: string }) {
  const [account, setAccount] = useState({ mobile: data.wallet.payoutMobile, beneficiaryName: data.wallet.payoutName });
  const [amount, setAmount] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const api = createEcommerceApi(data.wallet.companyId);
  const available = data.wallet.availableBalance;
  const fee = data.withdrawalFee.amount;
  const maximumAmount = Math.max(0, available - fee);
  const requestedAmount = Number(amount);
  const amountExceedsBalance = Number.isInteger(requestedAmount) && requestedAmount + fee > available;
  const canRequestWithdrawal = Number.isInteger(requestedAmount)
    && requestedAmount >= 1000
    && !amountExceedsBalance
    && account.mobile.trim() !== ''
    && account.beneficiaryName.trim() !== '';

  const saveAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!account.mobile.trim() || !account.beneficiaryName.trim()) return;
    setSavingAccount(true);
    await run(() => api.updatePayoutAccount({ provider: 'WAVE', mobile: account.mobile.trim(), beneficiaryName: account.beneficiaryName.trim() }), 'Compte de retrait enregistré.');
    setSavingAccount(false);
  };

  const withdraw = async (event: FormEvent) => {
    event.preventDefault();
    if (!canRequestWithdrawal) return;
    const result = await run(() => api.requestWithdrawal({ amount: requestedAmount, provider: 'WAVE', mobile: account.mobile.trim(), beneficiaryName: account.beneficiaryName.trim() }), 'Demande de retrait envoyée.');
    if (result) setAmount('');
  };

  return <div className="space-y-5 fade-up">
    <section className="flex flex-col gap-4 rounded-2xl border border-[hsl(var(--primary)/.22)] bg-[hsl(var(--primary)/.06)] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="mono text-[10px] font-bold uppercase tracking-[.2em] text-[hsl(var(--primary))]">Contrôle des paiements</p>
        <h2 className="mt-1 text-lg font-bold">Ne comptabiliser que l’argent confirmé</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">Le solde est crédité uniquement après confirmation DiamanoPay. Cette vérification récupère aussi les paiements confirmés dont le webhook n’est pas arrivé.</p>
      </div>
      <button type="button" disabled={!canModify || Boolean(pendingAction)} onClick={() => void run(async () => {
        const result = await api.reconcilePayments();
        return result;
      }, 'Paiements vérifiés auprès de DiamanoPay.', 'reconcile')} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border bg-[hsl(var(--background))] px-4 py-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={15} className={pendingAction === 'reconcile' ? 'animate-spin' : ''} />{pendingAction === 'reconcile' ? 'Vérification…' : 'Vérifier les paiements'}</button>
    </section>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <WalletMetric label="Solde disponible" value={money(data.wallet.availableBalance, currency)} detail="Retirable maintenant" icon={Wallet} accent />
       <WalletMetric label="Solde en attente" value={money(data.wallet.pendingBalance, currency)} detail={data.maturityPolicy.label} icon={Clock3} />
      <WalletMetric label="Retraits réservés" value={money(data.wallet.reservedBalance, currency)} detail="En cours de traitement" icon={ArrowDownToLine} />
      <WalletMetric label="Total crédité" value={money(data.wallet.totalCredited, currency)} detail="Ventes confirmées" icon={CircleDollarSign} />
    </div>
     <div className="rounded-xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.06)] px-4 py-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
       Règle de maturation active : <strong className="text-[hsl(var(--foreground))]">{data.maturityPolicy.label}</strong>
     </div>
     <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.28)] px-4 py-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
        La répartition des ventes est gérée automatiquement. Le module E-commerce, y compris Vente comptoir, relève de l’abonnement de l’entreprise.
     </div>
    <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
       <Panel title="Demander un retrait" description="Les retraits sont envoyés vers un compte Wave vérifié. Les frais sont ajoutés au montant débité. Minimum : 1 000 XOF.">
        <form onSubmit={withdraw} className="space-y-4">
          <Field label="Montant à retirer" type="number" value={amount} onChange={setAmount} placeholder="Ex. 25000" />
          <div className="rounded-xl border border-[hsl(var(--primary)/.2)] bg-[hsl(var(--primary)/.06)] p-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
             Disponible : <strong className="text-[hsl(var(--foreground))]">{money(available, currency)}</strong>. Frais : <strong className="text-[hsl(var(--foreground))]">{money(fee, currency)}</strong>. Le montant demandé et les frais doivent être couverts par le solde disponible. Retrait maximal actuel : <strong className="text-[hsl(var(--foreground))]">{money(maximumAmount, currency)}</strong>.
          </div>
            {amountExceedsBalance && requestedAmount >= 1000 && <p role="alert" className="rounded-lg bg-[hsl(var(--destructive)/.1)] p-3 text-xs font-semibold text-[hsl(var(--destructive))]">Ce retrait est impossible : le solde ne couvre pas le montant demandé et les frais.</p>}
            <button type="submit" disabled={!canModify || !canRequestWithdrawal} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-3 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50"><ArrowDownToLine size={15} />Demander le retrait</button>
        </form>
      </Panel>
      <Panel title="Compte de retrait" description="Ces coordonnées sont utilisées uniquement pour les payouts de cette entreprise.">
        <form onSubmit={saveAccount} className="space-y-4">
          <div className="rounded-xl border bg-[hsl(var(--muted)/.35)] p-3 text-xs font-semibold"><span className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600" />Fournisseur : Wave</span></div>
          <Field label="Nom du bénéficiaire" value={account.beneficiaryName} onChange={value => setAccount(current => ({ ...current, beneficiaryName: value }))} placeholder="Nom affiché sur le compte mobile" />
          <Field label="Numéro mobile Wave" value={account.mobile} onChange={value => setAccount(current => ({ ...current, mobile: value }))} placeholder="+221 77 000 00 00" />
          <button type="submit" disabled={!canModify || savingAccount || !account.mobile.trim() || !account.beneficiaryName.trim()} className="rounded-lg border px-4 py-3 text-xs font-bold disabled:opacity-50">{savingAccount ? 'Enregistrement…' : 'Enregistrer le compte'}</button>
        </form>
      </Panel>
    </div>
    <Panel title="Historique des retraits" description="Les dernières demandes de retrait de cette entreprise.">
       {data.withdrawals.length === 0 ? <Empty icon={ArrowDownToLine} title="Aucun retrait" text="Les demandes de retrait apparaîtront ici." /> : <div className="table-scroll"><table className="w-full text-left text-sm"><thead><tr><th className="px-4">Date</th><th className="px-4">Reçu</th><th className="px-4">Frais</th><th className="px-4">Débité</th><th className="px-4">Compte</th><th className="px-4">Statut</th></tr></thead><tbody className="divide-y">{data.withdrawals.map(withdrawal => <tr key={withdrawal.id}><td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">{dateLabel(withdrawal.requestedAt)}</td><td className="px-4 py-3 font-bold">{money(withdrawal.netAmount, currency)}</td><td className="px-4 py-3">{money(withdrawal.fee, currency)}</td><td className="px-4 py-3 font-bold">{money(withdrawal.totalDebit, currency)}</td><td className="px-4 py-3 text-xs">{withdrawal.mobile}</td><td className="px-4 py-3"><StatusPill value={withdrawal.status} /></td></tr>)}</tbody></table></div>}
    </Panel>
  </div>;
}

function WalletMetric({ label, value, detail, icon: Icon, accent = false }: { label: string; value: string; detail: string; icon: typeof Wallet; accent?: boolean }) {
  return <div className={`card-surface rounded-2xl border p-4 ${accent ? 'border-[hsl(var(--primary)/.3)]' : ''}`}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'}`}><Icon size={17} /></span><p className="mt-4 text-xs font-bold text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-1 text-xl font-bold tracking-tight">{value}</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{detail}</p></div>;
}

function Catalogue({ data, allowedFeatureIds, canCreate, canModify, run }: { data: EcommerceBootstrap; allowedFeatureIds?: string[]; canCreate: boolean; canModify: boolean; run: (action: () => Promise<unknown>, success: string) => Promise<unknown | undefined> }) {
  const { confirm, alert } = useAppDialog();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | EcommerceProduct['status']>('ALL');
  const [modal, setModal] = useState<EcommerceProduct | 'new' | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(blankProduct);
  const filtered = data.products.filter(product => status === 'ALL' || product.status === status).filter(product => `${product.name} ${product.sku} ${product.category}`.toLocaleLowerCase('fr-FR').includes(query.toLocaleLowerCase('fr-FR')));
  const canSellPhysical = !allowedFeatureIds || allowedFeatureIds.includes('vente-physique');
  const canSellDigital = !allowedFeatureIds || allowedFeatureIds.includes('vente-numerique');
  const canCreateProduct = canCreate && (canSellPhysical || canSellDigital);
  const storeSlug = data.store.slug || slugify(data.store.name) || 'boutique';
  const copyProductLink = async (product: EcommerceProduct) => {
    if (data.store.status !== 'PUBLISHED' || product.status !== 'PUBLISHED') {
      showAppToast('Publiez la boutique et le produit pour rendre son lien accessible.', 'info');
      return;
    }

    if (!navigator.clipboard?.writeText) {
      showAppToast('La copie du lien n’est pas disponible dans ce navigateur.', 'error');
      return;
    }

    const url = buildPublicProductUrl(window.location.origin, storeSlug, product.slug);
    try {
      await navigator.clipboard.writeText(url);
      showAppToast('Lien du produit copié.', 'success');
    } catch {
      showAppToast('Impossible de copier le lien. Vérifiez les autorisations du navigateur.', 'error');
    }
  };
  const open = (product?: EcommerceProduct, fulfillmentType: EcommerceProductFulfillmentType = 'PHYSICAL') => {
    setChooserOpen(false);
    setModal(product ?? 'new');
    setForm(product ? { name: product.name, slug: product.slug, sku: product.sku, description: product.description, category: product.category, categoryId: product.categoryId ?? '', price: String(product.price), compareAtPrice: product.compareAtPrice === null ? '' : String(product.compareAtPrice), stock: String(product.stock), productType: product.productType, fulfillmentType: product.fulfillmentType ?? 'PHYSICAL', rentalPeriod: product.rentalPeriod ?? 'JOUR', imageUrl: product.imageUrl, imageFile: null, galleryUrls: Array.isArray(product.gallery) ? product.gallery : [], galleryFiles: [], digitalFile: null, digitalFileName: product.digitalFile?.name ?? '', featured: product.featured, status: product.status } : { ...blankProduct, fulfillmentType, stock: fulfillmentType === 'DIGITAL' ? '1' : '0' });
  };
  const openNewProduct = () => {
    if (!canCreateProduct) return;
    if (canSellPhysical !== canSellDigital) {
      open(undefined, canSellPhysical ? 'PHYSICAL' : 'DIGITAL');
      return;
    }
    setChooserOpen(true);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!canModify && (form.imageFile || form.galleryFiles.length > 0 || form.digitalFile)) {
      await alert({ title: 'Droit Modifier requis', description: 'L’ajout de médias à une fiche existante nécessite le droit Modifier.', confirmLabel: 'Compris' });
      return;
    }
    const price = Number(form.price);
    const stock = form.fulfillmentType === 'DIGITAL' ? 1 : Number(form.stock);
    const compareAtPrice = form.compareAtPrice.trim() ? Number(form.compareAtPrice) : null;
    const missingFields: string[] = [];
    if (!form.name.trim()) missingFields.push('le nom');
    if (!form.sku.trim()) missingFields.push('la référence');
    if (!form.price.trim() || !Number.isFinite(price) || price < 0) missingFields.push('un prix valide');
    if (form.fulfillmentType === 'PHYSICAL' && (!form.stock.trim() || !Number.isFinite(stock) || stock < 0)) {
      missingFields.push('un stock valide');
    }
    if (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0)) {
      missingFields.push('un prix barré valide');
    }
    if (missingFields.length > 0) {
      await alert({ title: 'Informations incomplètes', description: `Complétez ${missingFields.join(', ')}.`, confirmLabel: 'Compris' });
      return;
    }
    const productType = form.fulfillmentType === 'DIGITAL' ? 'SALE' : (modal !== 'new' && modal ? modal.productType : 'SALE');
    const rentalPeriod = form.fulfillmentType === 'DIGITAL' ? null : (modal !== 'new' && modal ? modal.rentalPeriod : null);
    const requestedStatus = form.status;
    const existingDigitalFile = modal !== null && modal !== 'new' && form.fulfillmentType === 'DIGITAL' && Boolean(modal.digitalFile?.name);
    const mustUploadBeforePublishing = form.fulfillmentType === 'DIGITAL' && requestedStatus === 'PUBLISHED' && !existingDigitalFile;
    const savingDigitalDraft = form.fulfillmentType === 'DIGITAL' && requestedStatus === 'PUBLISHED' && !form.digitalFile && !existingDigitalFile;
    const bodyStatus = mustUploadBeforePublishing ? 'DRAFT' : requestedStatus;
    const body = { name: form.name.trim(), ...(form.slug.trim() ? { slug: slugify(form.slug) } : {}), sku: form.sku.trim(), description: form.description.trim(), category: form.category.trim() || 'Divers', categoryId: form.categoryId || null, price, compareAtPrice, stock, productType, rentalPeriod, fulfillmentType: form.fulfillmentType, imageUrl: form.imageUrl.trim(), featured: form.featured, status: bodyStatus };
    const api = createEcommerceApi(data.store.companyId);
    const saved = modal === 'new'
      ? await run(() => api.createProduct(body), savingDigitalDraft ? 'Produit numérique enregistré en brouillon. Ajoutez le fichier pour le publier.' : 'Produit ajouté au catalogue.')
      : modal
        ? await run(() => api.updateProduct(modal.id, body), 'Produit mis à jour.')
        : undefined;
    if (!saved) return;
    const savedProduct = saved as EcommerceProduct;
    if (canModify && form.imageFile) {
      await run(() => api.uploadProductImage(savedProduct.id, form.imageFile as File), 'Produit et photo enregistrés.');
    }
    if (canModify && form.galleryFiles.length > 0) {
      await run(() => api.uploadProductGallery(savedProduct.id, form.galleryFiles), 'Galerie du produit enregistrée.');
    }
    if (canModify && form.digitalFile) {
      const uploaded = await run(() => api.uploadDigitalFile(savedProduct.id, form.digitalFile as File), 'Produit numérique et fichier enregistrés.');
      if (!uploaded) return;
      if (requestedStatus === 'PUBLISHED' && bodyStatus !== 'PUBLISHED') {
        const published = await run(() => api.updateProduct(savedProduct.id, { status: 'PUBLISHED' }), 'Produit numérique publié.');
        if (!published) return;
      }
    }
    setModal(null);
  };
  const archive = async (product: EcommerceProduct) => {
    if (!await confirm({ title: 'Archiver ce produit ?', description: `« ${product.name} » ne sera plus proposé dans le catalogue actif.`, confirmLabel: 'Archiver', tone: 'danger' })) return;
    await run(() => createEcommerceApi(data.store.companyId).archiveProduct(product.id), 'Produit archivé.');
  };
  return <div className="space-y-5 fade-up">
    <Panel title="Catalogue en ligne" description="Organisez les références qui alimentent directement votre vitrine." action={canCreateProduct ? <button type="button" onClick={openNewProduct} className="btn inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]"><Plus size={15} />Ajouter un produit</button> : undefined}>
      <ResponsiveFilterGroup testId="ecommerce-catalogue-filters" activeCount={countActiveFilters([[status, 'ALL']])} onClear={() => setStatus('ALL')} search={<label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={15} /><input aria-label="Rechercher un produit" value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher par nom, référence ou catégorie" className="w-full rounded-lg border bg-transparent py-2.5 pl-9 pr-3 text-sm" /></label>}><select aria-label="Filtrer par statut" value={status} onChange={event => setStatus(event.target.value as typeof status)} className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5 text-sm"><option value="ALL">Tous les statuts</option><option value="PUBLISHED">Publié</option><option value="DRAFT">Brouillon</option><option value="ARCHIVED">Archivé</option></select></ResponsiveFilterGroup>
          {filtered.length === 0 ? <Empty icon={Package} title={query || status !== 'ALL' ? 'Aucun produit trouvé' : 'Votre catalogue est vide'} text={query || status !== 'ALL' ? 'Modifiez vos filtres pour retrouver une référence.' : 'Ajoutez votre première référence pour commencer à vendre en ligne.'} action={canCreateProduct && !query ? <button type="button" onClick={openNewProduct} className="text-xs font-bold text-[hsl(var(--primary))]">Ajouter un produit</button> : undefined} /> : <div className="table-scroll"><table className="w-full text-left text-sm"><thead><tr><th className="px-4">Produit</th><th className="px-4">Référence</th><th className="px-4">Prix</th><th className="px-4">Stock</th><th className="px-4">Statut</th><th className="px-4">Actions</th></tr></thead><tbody className="divide-y">{filtered.map(product => {
            const canCopyLink = data.store.status === 'PUBLISHED' && product.status === 'PUBLISHED';
            const unavailableLinkTitle = data.store.status !== 'PUBLISHED'
              ? 'Publiez la boutique pour rendre le lien accessible.'
              : 'Publiez le produit pour rendre le lien accessible.';
            return <tr key={product.id}><td className="px-4 py-3"><div className="flex items-center gap-3">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><Package size={17} /></span>}<span className="min-w-0"><strong className="block truncate">{product.name}</strong><small className="text-xs text-[hsl(var(--muted-foreground))]">{product.category}{product.featured ? ' · Vedette' : ''}</small></span></div></td><td className="mono px-4 py-3 text-xs">{product.sku}</td><td className="px-4 py-3 font-bold">{money(product.price, data.store.currency)}</td><td className={`px-4 py-3 font-bold ${product.stock <= 5 ? 'text-[hsl(var(--destructive))]' : ''}`}>{product.stock}</td><td className="px-4 py-3"><StatusPill value={product.status} /></td><td className="px-4 py-3"><div className="flex flex-wrap justify-end gap-1.5"><Button type="button" variant="outline" size="sm" disabled={!canCopyLink} title={canCopyLink ? `Copier le lien de ${product.name}` : unavailableLinkTitle} aria-label={`Copier le lien de ${product.name}`} data-testid="button-copy-product-link" onClick={() => void copyProductLink(product)} className="h-8 min-h-8 gap-1.5 px-2 text-[10px]"><Copy size={13} aria-hidden="true" /><span>Copier le lien</span></Button>{canModify && product.status !== 'ARCHIVED' && <button type="button" title="Modifier" aria-label={`Modifier ${product.name}`} onClick={() => open(product)} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10px] font-bold hover:bg-[hsl(var(--muted))]"><Pencil size={13} />Modifier</button>}{canModify && product.status !== 'ARCHIVED' && <button type="button" title="Archiver" aria-label={`Archiver ${product.name}`} onClick={() => void archive(product)} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"><Archive size={13} />Archiver</button>}</div></td></tr>;
          })}</tbody></table></div>}
    </Panel>
     {chooserOpen && <Modal title="Choisir le type de produit" onClose={() => setChooserOpen(false)}><div className={`grid gap-3 ${canSellPhysical && canSellDigital ? 'sm:grid-cols-2' : ''}`}>{canSellPhysical && <button type="button" onClick={() => open(undefined, 'PHYSICAL')} className="rounded-2xl border p-5 text-left transition hover:border-[hsl(var(--primary))]"><Package size={25} className="text-[hsl(var(--primary))]" /><strong className="mt-3 block">Produit physique</strong><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Gérez le stock, la livraison et la vente d’un article matériel.</span></button>}{canSellDigital && <button type="button" onClick={() => open(undefined, 'DIGITAL')} className="rounded-2xl border p-5 text-left transition hover:border-[hsl(var(--primary))]"><ArrowDownToLine size={25} className="text-[hsl(var(--primary))]" /><strong className="mt-3 block">Produit numérique</strong><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">Joignez un fichier privé, délivré uniquement après paiement confirmé.</span></button>}</div></Modal>}
      {modal && <ProductModal modal={modal} form={form} categories={data.categories} canModify={canModify} setForm={setForm} onClose={() => setModal(null)} onSave={save} onRemoveGallery={async url => {
        const imageId = url.split('/').pop();
        if (!imageId || !url.includes('/api/gallery-images/') || modal === 'new') return;
        const result = await run(() => createEcommerceApi(data.store.companyId).deleteProductGalleryImage(modal.id, imageId), 'Image supprimée de la galerie.');
        if (result) setForm(current => ({ ...current, galleryUrls: current.galleryUrls.filter(item => item !== url) }));
      }} />}
  </div>;
}

 function ProductModal({ modal, form, categories, canModify, setForm, onClose, onSave, onRemoveGallery }: { modal: EcommerceProduct | 'new'; form: ProductForm; categories: EcommerceCategory[]; canModify: boolean; setForm: (value: ProductForm) => void; onClose: () => void; onSave: (event: FormEvent) => void; onRemoveGallery: (url: string) => void }) {
  const patch = (updates: Partial<ProductForm>) => setForm({ ...form, ...updates });
  const [, setSlugManuallyEdited] = useState(modal !== 'new');
  const changeName = (value: string) => patch({ name: value, ...(modal === 'new' ? { slug: slugify(value) } : {}) });
  return <Modal large title={modal === 'new' ? (form.fulfillmentType === 'DIGITAL' ? 'Nouveau produit numérique' : 'Nouveau produit physique') : `Modifier ${modal.name}`} onClose={onClose}>
    <form onSubmit={onSave} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du produit" required value={form.name} onChange={changeName} placeholder="Ex. Sacoche Atlas" />
        <Field label="Référence SKU" required value={form.sku} onChange={value => patch({ sku: value })} placeholder="ATLAS-001" />
        <label className="block text-xs font-bold">Catégorie
          <select value={form.categoryId} onChange={event => { const categoryId = event.target.value; const category = categories.find(item => item.id === categoryId); patch({ categoryId, category: category?.name ?? form.category }); }} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm"><option value="">Sans catégorie</option>{categories.filter(category => category.isActive).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        </label>
        <Field label="Slug public (optionnel)" value={form.slug} onChange={value => { setSlugManuallyEdited(true); patch({ slug: value }); }} placeholder="généré automatiquement si vide" />
        <Field label="Prix de vente" required type="number" value={form.price} onChange={value => patch({ price: value })} placeholder="0" />
        <Field label="Prix barré" type="number" value={form.compareAtPrice} onChange={value => patch({ compareAtPrice: value })} placeholder="Optionnel" />
         {form.fulfillmentType === 'PHYSICAL' ? <Field label="Stock disponible" required type="number" value={form.stock} onChange={value => patch({ stock: value })} placeholder="0" /> : <div className="rounded-lg border border-[hsl(var(--primary)/.24)] bg-[hsl(var(--primary)/.06)] px-3 py-2.5 text-xs"><strong className="block">Vente numérique</strong><span className="mt-1 block text-[hsl(var(--muted-foreground))]">Le stock physique n’est pas décrémenté. Une unité est réservée par commande.</span></div>}
         {form.fulfillmentType === 'DIGITAL' ? <label className="block text-xs font-bold">Fichier numérique<input type="file" accept={digitalFileAccept} onChange={event => { const file = event.target.files?.[0] ?? null; patch({ digitalFile: file, digitalFileName: file?.name ?? form.digitalFileName }); }} className="mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[hsl(var(--muted))] file:px-2.5 file:py-1.5 file:text-xs file:font-bold" /><span className="mt-1 block text-[11px] font-normal leading-5 text-[hsl(var(--muted-foreground))]">Vidéo, musique, PDF, Word ou PowerPoint · 1 Go maximum · requis pour publier. Un brouillon peut être enregistré avant l’ajout du fichier.</span>{form.digitalFileName && <span className="mt-1 block truncate text-[11px] font-semibold text-[hsl(var(--primary))]">{form.digitalFileName}</span>}</label> : null}
         <label className="block text-xs font-bold sm:col-span-2">Images du produit<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => { const files = Array.from(event.target.files ?? []); patch({ imageFile: files[0] ?? null, galleryFiles: files.slice(1) }); }} className="mt-1.5 block w-full rounded-lg border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[hsl(var(--muted))] file:px-2.5 file:py-1.5 file:text-xs file:font-bold" /><span className="mt-1 block text-[11px] font-normal text-[hsl(var(--muted-foreground))]">Le premier fichier devient l’image principale ; les suivants sont ajoutés à la galerie. Les images déjà enregistrées sont conservées.</span>{form.imageFile && <span className="mt-1 block truncate text-[11px] font-semibold text-[hsl(var(--primary))]">Image principale : {form.imageFile.name}{form.galleryFiles.length > 0 ? ` · ${form.galleryFiles.length} autre(s) ajoutée(s)` : ''}</span>}{form.imageUrl && !form.imageFile && <img src={form.imageUrl} alt="" className="mt-2 h-16 w-16 rounded-lg object-cover" />}</label>
      </div>
        <label className="block text-xs font-bold">Galerie déjà enregistrée
         {form.galleryUrls.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{form.galleryUrls.map(url => <span key={url} className="relative"><img src={url} alt="" className="h-16 w-16 rounded-lg object-cover" /><button type="button" onClick={() => onRemoveGallery(url)} className="absolute -right-1 -top-1 rounded-full bg-[hsl(var(--destructive))] px-1.5 py-0.5 text-[10px] font-bold text-white" aria-label="Supprimer cette image">×</button></span>)}</div>}
       </label>
       <label className="block text-xs font-bold">Description<textarea value={form.description} onChange={event => patch({ description: event.target.value })} rows={3} placeholder="Quelques mots utiles pour l’acheteur ou le locataire..." className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm" /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-bold">Statut<select value={form.status} onChange={event => patch({ status: event.target.value as ProductForm['status'] })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm"><option value="DRAFT">Brouillon</option><option value="PUBLISHED">Publié</option><option value="ARCHIVED">Archivé</option></select></label><label className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-xs font-bold"><input type="checkbox" checked={form.featured} onChange={event => patch({ featured: event.target.checked })} className="h-4 w-4 accent-[hsl(var(--primary))]" />Mettre en avant dans la boutique</label></div>
      <div className="modal-footer flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2.5 text-xs font-bold">Annuler</button><button type="submit" className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]"><Check className="mr-1 inline" size={14} />Enregistrer</button></div>
    </form>
  </Modal>;
}

function CategoryManager({
  data,
  canCreate,
  canModify,
  showProductCategories = true,
  canViewExpenses,
  canCreateExpenses,
  canModifyExpenses,
  canViewInvestments,
  canCreateInvestments,
  canModifyInvestments,
  run,
}: {
  data: EcommerceBootstrap;
  canCreate: boolean;
  canModify: boolean;
  showProductCategories?: boolean;
  canViewExpenses: boolean;
  canCreateExpenses: boolean;
  canModifyExpenses: boolean;
  canViewInvestments: boolean;
  canCreateInvestments: boolean;
  canModifyInvestments: boolean;
  run: (action: () => Promise<unknown>, success: string) => Promise<unknown | undefined>;
}) {
  const { confirm } = useAppDialog();
  const [editing, setEditing] = useState<EcommerceCategory | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', isActive: true, sortOrder: 0 });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const open = (category?: EcommerceCategory) => {
    setEditing(category ?? 'new');
    setSlugManuallyEdited(Boolean(category));
    setForm(category
      ? { name: category.name, slug: category.slug, description: category.description, isActive: category.isActive, sortOrder: category.sortOrder }
      : { name: '', slug: '', description: '', isActive: true, sortOrder: data.categories.length });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const body = { ...form, name: form.name.trim(), slug: slugify(form.slug || form.name), description: form.description.trim() };
    const result = editing === 'new'
      ? await run(() => createEcommerceApi(data.store.companyId).createCategory(body), 'Catégorie créée.')
      : editing ? await run(() => createEcommerceApi(data.store.companyId).updateCategory(editing.id, body), 'Catégorie mise à jour.') : undefined;
    if (result) setEditing(null);
  };
  const remove = async (category: EcommerceCategory) => {
    if (!await confirm({ title: 'Supprimer cette catégorie ?', description: `Les produits seront conservés sans catégorie : « ${category.name} ».`, confirmLabel: 'Supprimer', tone: 'danger' })) return;
    await run(() => createEcommerceApi(data.store.companyId).deleteCategory(category.id), 'Catégorie supprimée.');
  };
     return <div className="space-y-5 fade-up">
     {showProductCategories && <Panel title="Catégories de produits" description="Structurez le catalogue avec des catégories réutilisables et persistantes." action={canCreate ? <button type="button" onClick={() => open()} className="btn inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]"><Plus size={15} />Ajouter une catégorie</button> : undefined}>
      {data.categories.length === 0 ? <Empty icon={Tags} title="Aucune catégorie" text="Créez une catégorie pour mieux organiser vos produits." /> : <div className="table-scroll"><table className="w-full text-left text-sm"><thead><tr><th className="px-4">Nom</th><th className="px-4">Slug</th><th className="px-4">Ordre</th><th className="px-4">Statut</th><th className="px-4">Actions</th></tr></thead><tbody className="divide-y">{data.categories.map(category => <tr key={category.id}><td className="px-4 py-3 font-bold">{category.name}</td><td className="mono px-4 py-3 text-xs">{category.slug}</td><td className="px-4 py-3">{category.sortOrder}</td><td className="px-4 py-3">{category.isActive ? 'Active' : 'Inactive'}</td><td className="px-4 py-3"><div className="flex gap-2">{canModify && <button type="button" onClick={() => open(category)} className="rounded-lg border px-2.5 py-2 text-xs font-bold"><Pencil size={13} className="mr-1 inline" />Modifier</button>}{canModify && <button type="button" onClick={() => void remove(category)} className="rounded-lg border px-2.5 py-2 text-xs font-bold text-[hsl(var(--destructive))]">Supprimer</button>}</div></td></tr>)}</tbody></table></div>}
     </Panel>}
     {canViewExpenses && <EcommerceExpenseCategoriesPanel companyId={data.store.companyId} kind="EXPENSE" canCreate={canCreateExpenses} canModify={canModifyExpenses} />}
     {canViewInvestments && <EcommerceExpenseCategoriesPanel companyId={data.store.companyId} kind="INVESTMENT" canCreate={canCreateInvestments} canModify={canModifyInvestments} />}
     {editing && <Modal title={editing === 'new' ? 'Nouvelle catégorie' : 'Modifier la catégorie'} onClose={() => setEditing(null)}><form onSubmit={save} className="space-y-4"><Field label="Nom" required value={form.name} onChange={value => setForm({ ...form, name: value, ...(!slugManuallyEdited ? { slug: slugify(value) } : {}) })} placeholder="Ex. Accessoires" /><Field label="Slug" value={form.slug} onChange={value => { setSlugManuallyEdited(true); setForm({ ...form, slug: value }); }} placeholder="généré automatiquement" /><label className="block text-xs font-bold">Description<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} rows={3} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm" /></label><div className="grid gap-3 sm:grid-cols-2"><Field label="Ordre" type="number" value={String(form.sortOrder)} onChange={value => setForm({ ...form, sortOrder: Math.max(0, Number(value) || 0) })} /><label className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold"><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} />Catégorie active</label></div><div className="modal-footer flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2.5 text-xs font-bold">Annuler</button><button type="submit" className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]">Enregistrer</button></div></form></Modal>}
  </div>;
}

type ManualOrderInput = { customerName: string; customerEmail?: string; customerPhone?: string; shippingAddress?: string; note?: string; items: Array<{ productId: string; quantity: number }> };

function ManualOrderDialog({ products, currency, onClose, onSubmit }: { products: EcommerceProduct[]; currency: EcommerceStore['currency']; onClose: () => void; onSubmit: (input: ManualOrderInput) => Promise<unknown> }) {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<Array<{ productId: string; quantity: number }>>([{ productId: '', quantity: 1 }]);
  const [pending, setPending] = useState(false);
  const availableProducts = products.filter(product => product.status === 'PUBLISHED' && product.productType === 'SALE');
  const total = lines.reduce((sum, line) => {
    const product = availableProducts.find(candidate => candidate.id === line.productId);
    return sum + (product?.price ?? 0) * line.quantity;
  }, 0);
  const updateLine = (index: number, patch: Partial<(typeof lines)[number]>) =>
    setLines(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !customerName.trim() || lines.some(line => !line.productId || line.quantity < 1)) return;
    setPending(true);
    try {
      await onSubmit({
        customerName: customerName.trim(),
        ...(customerEmail.trim() ? { customerEmail: customerEmail.trim() } : {}),
        ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
        ...(shippingAddress.trim() ? { shippingAddress: shippingAddress.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        items: lines,
      });
    } finally {
      setPending(false);
    }
  };

  return <Modal title="Créer une commande manuelle" onClose={onClose} large>
    <form onSubmit={event => void submit(event)} className="space-y-4">
      <p className="rounded-lg border bg-[hsl(var(--muted)/.35)] p-3 text-xs text-[hsl(var(--muted-foreground))]">La commande sera créée sans passage par la boutique en ligne. Elle restera non payée jusqu’à confirmation de l’encaissement.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom du client" required value={customerName} onChange={setCustomerName} />
        <Field label="Téléphone" value={customerPhone} onChange={setCustomerPhone} />
        <Field label="E-mail (facultatif)" value={customerEmail} onChange={setCustomerEmail} />
        <Field label="Adresse de livraison" value={shippingAddress} onChange={setShippingAddress} />
      </div>
      <section className="space-y-3 rounded-xl border p-3">
        <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">Articles</h3><Button type="button" variant="outline" onClick={() => setLines(current => [...current, { productId: '', quantity: 1 }])}><Plus size={14} className="mr-1" />Ajouter un article</Button></div>
        {availableProducts.length === 0 ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Aucun produit publié disponible pour cette commande.</p> : lines.map((line, index) => {
          const selected = availableProducts.find(product => product.id === line.productId);
          return <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] items-end" key={index}>
            <label className="block text-xs font-bold">Produit<select data-testid={`select-manual-order-product-${index}`} required value={line.productId} onChange={event => updateLine(index, { productId: event.target.value })} className="mt-1.5 w-full rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5 text-sm"><option value="">Choisir un produit</option>{availableProducts.map(product => <option key={product.id} value={product.id}>{product.name} · {money(product.price, currency)}{product.fulfillmentType === 'PHYSICAL' ? ` · stock ${product.stock}` : ''}</option>)}</select></label>
            <Field label="Quantité" type="number" required value={String(line.quantity)} onChange={value => updateLine(index, { quantity: Math.max(1, Math.floor(Number(value) || 1)) })} />
            {lines.length > 1 && <Button type="button" variant="outline" aria-label={`Retirer la ligne ${index + 1}`} onClick={() => setLines(current => current.filter((_, lineIndex) => lineIndex !== index))}><X size={15} /></Button>}
            {selected && <span className="text-xs text-[hsl(var(--muted-foreground))] sm:col-span-3">Sous-total : {money(selected.price * line.quantity, currency)}</span>}
          </div>;
        })}
        <p className="text-right text-sm font-bold">Total estimé : {money(total, currency)}</p>
      </section>
      <label className="block text-xs font-bold">Note<textarea data-testid="input-manual-order-note" value={note} onChange={event => setNote(event.target.value)} rows={2} maxLength={500} className="mt-1.5 w-full rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5 text-sm" /></label>
      <div className="modal-footer flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" disabled={pending || availableProducts.length === 0 || !customerName.trim() || lines.some(line => !line.productId)}>{pending ? 'Création…' : 'Créer la commande'}</Button></div>
    </form>
  </Modal>;
}

function Orders({ data, canCreate, canModify, run, onCreate }: { data: EcommerceBootstrap; canCreate: boolean; canModify: boolean; run: (action: () => Promise<unknown>, success: string) => Promise<unknown | undefined>; onCreate: (input: ManualOrderInput) => Promise<unknown> }) {
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | EcommerceOrderStatus>('ALL');
  const paymentMethodLabel = (method: EcommerceOrder['paymentMethod']) => {
    if (method === 'CASH_ON_DELIVERY') return 'À encaisser à la livraison';
    if (method === 'ORANGE_MONEY') return 'Orange Money';
    if (method === 'WAVE') return 'Wave';
    return '';
  };
  const allOrders = Array.isArray(data.orders) ? data.orders : [];
  const orders = allOrders.filter(order => (filter === 'ALL' || order.status === filter) && `${order.reference ?? ''} ${order.customerName ?? ''} ${order.customerEmail ?? ''}`.toLocaleLowerCase('fr-FR').includes(query.toLocaleLowerCase('fr-FR')));
  const changeStatus = (order: EcommerceOrder, status: EcommerceOrderStatus) => run(() => createEcommerceApi(data.store.companyId).updateOrderStatus(order.id, status), 'Statut de commande mis à jour.');
  return <div className="space-y-5 fade-up"><Panel title="Commandes" description="Suivez les commandes de la boutique et créez-en directement depuis l’entreprise." action={canCreate ? <Button type="button" onClick={() => setCreating(true)}><Plus size={15} className="mr-1" />Créer une commande</Button> : undefined}><ResponsiveFilterGroup testId="ecommerce-orders-filters" activeCount={countActiveFilters([[filter, 'ALL']])} onClear={() => setFilter('ALL')} search={<label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={15} /><input aria-label="Rechercher une commande" value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher par référence, nom ou e-mail" className="w-full rounded-lg border bg-transparent py-2.5 pl-9 pr-3 text-sm" /></label>}><select aria-label="Filtrer par statut" value={filter} onChange={event => setFilter(event.target.value as typeof filter)} className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5 text-sm"><option value="ALL">Tous les statuts</option>{orderStatuses.map(item => <option key={item} value={item}>{item}</option>)}</select></ResponsiveFilterGroup>{orders.length === 0 ? <Empty icon={ClipboardList} title={allOrders.length ? 'Aucune commande trouvée' : 'Aucune commande pour le moment'} text={allOrders.length ? 'Modifiez votre recherche ou le filtre de statut.' : 'Les ventes de votre boutique apparaîtront ici dès la première vente.'} /> : <div className="table-scroll"><table className="w-full text-left text-sm"><thead><tr><th className="px-4">Commande</th><th className="px-4">Client</th><th className="px-4">Articles</th><th className="px-4">Total</th><th className="px-4">Statut et paiement</th><th className="px-4">Mise à jour</th></tr></thead><tbody className="divide-y">{orders.map(order => { const items = Array.isArray(order.items) ? order.items : []; return <tr key={order.id}><td className="px-4 py-4"><strong className="block">{order.reference}</strong><small className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{dateLabel(order.createdAt)}</small></td><td className="px-4 py-4"><strong className="block">{order.customerName}</strong><small className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{order.customerEmail || order.customerPhone || 'Coordonnées non renseignées'}</small></td><td className="px-4 py-4 text-xs">{items.reduce((sum, item) => sum + item.quantity, 0)} article{items.length > 1 ? 's' : ''}</td><td className="px-4 py-4 font-bold">{money(order.total, data.store.currency)}</td><td className="px-4 py-4"><StatusPill value={order.status} /><small className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{order.paymentStatus === 'UNPAID' ? 'Non payée' : paymentMethodLabel(order.paymentMethod ?? null)}</small></td><td className="px-4 py-4">{canModify ? <select aria-label={`Changer le statut de ${order.reference}`} value={order.status} onChange={event => void changeStatus(order, event.target.value as EcommerceOrderStatus)} className="rounded-lg border bg-[hsl(var(--card))] px-2 py-2 text-xs font-bold">{allowedNextStatuses(order.status).map(item => <option key={item} value={item}>{item}</option>)}</select> : <span className="text-xs text-[hsl(var(--muted-foreground))]">Lecture seule</span>}</td></tr>; })}</tbody></table></div>}</Panel>{creating && <ManualOrderDialog products={data.products} currency={data.store.currency} onClose={() => setCreating(false)} onSubmit={input => run(() => onCreate(input), 'Commande créée et enregistrée comme non payée.').then(result => { if (result !== undefined) setCreating(false); })} />}</div>;
}

function OrderAttachments({ data }: { data: EcommerceBootstrap }) {
  const orders = data.orders.filter(order => Array.isArray(order.attachments) && order.attachments.length > 0);
  if (orders.length === 0) return null;

  return <Panel title="Pièces jointes des commandes" description="Fichiers transmis par les clients au moment de la commande.">
    <div className="grid gap-3 md:grid-cols-2">
      {orders.map(order => <section key={order.id} className="rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="mono text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{order.reference}</p><p className="mt-1 text-sm font-bold">{order.customerName}</p></div>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{order.attachments?.length} fichier(s)</span>
        </div>
        <ul className="mt-3 space-y-2 border-t pt-3">
          {order.attachments?.map(attachment => <li key={attachment.id} className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate" title={attachment.name}>{attachment.name} · {Math.max(1, Math.round(attachment.size / 1024))} Ko</span>
            <a
              href={`/api/ecommerce/orders/${encodeURIComponent(order.id)}/attachments/${encodeURIComponent(attachment.id)}?companyId=${encodeURIComponent(data.store.companyId)}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 font-bold text-[hsl(var(--primary))]"
            >
              <ArrowDownToLine size={13} />Télécharger
            </a>
          </li>)}
        </ul>
      </section>)}
    </div>
  </Panel>;
}

function Clients({ data }: { data: EcommerceBootstrap }) {
  const clients = useMemo(() => {
    const map = new Map<string, { name: string; email: string; phone: string; orders: number; total: number; lastOrder: string }>();
    data.orders.forEach(order => {
      const key = order.customerEmail || order.customerName;
      const previous = map.get(key);
      map.set(key, { name: order.customerName, email: order.customerEmail ?? '', phone: order.customerPhone, orders: (previous?.orders ?? 0) + 1, total: (previous?.total ?? 0) + order.total, lastOrder: previous?.lastOrder && new Date(previous.lastOrder) > new Date(order.createdAt) ? previous.lastOrder : order.createdAt });
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [data.orders]);
  return <div className="space-y-5 fade-up"><Panel title="Clients" description="Une vue consolidée des acheteurs issus de votre boutique.">{clients.length === 0 ? <Empty icon={Users} title="Votre fichier client est vide" text="Les coordonnées apparaîtront automatiquement après les premières commandes." /> : <div className="table-scroll"><table className="w-full text-left text-sm"><thead><tr><th className="px-4">Client</th><th className="px-4">Contact</th><th className="px-4">Commandes</th><th className="px-4">Valeur cumulée</th><th className="px-4">Dernière commande</th></tr></thead><tbody className="divide-y">{clients.map(client => <tr key={client.email || client.name}><td className="px-4 py-4 font-bold">{client.name}</td><td className="px-4 py-4"><span className="block text-xs">{client.email || 'E-mail non renseigné'}</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{client.phone || 'Téléphone non renseigné'}</span></td><td className="px-4 py-4">{client.orders}</td><td className="px-4 py-4 font-bold">{money(client.total, data.store.currency)}</td><td className="px-4 py-4 text-xs text-[hsl(var(--muted-foreground))]">{dateLabel(client.lastOrder)}</td></tr>)}</tbody></table></div>}</Panel></div>;
}

function Promotions() {
  return <div className="fade-up"><Panel title="Promotions" description="Préparez vos temps forts commerciaux sans perdre de vue la cohérence de votre catalogue."><div className="mx-auto max-w-2xl py-8 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><Megaphone size={24} /></span><h2 className="mt-5 text-xl font-bold">Les promotions arrivent dans votre cockpit</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[hsl(var(--muted-foreground))]">Cette vue est prête pour vos futures campagnes. En attendant, gérez vos prix et vos prix barrés directement depuis le catalogue.</p></div></Panel></div>;
}

function Deliveries({ data, canCreate, canModify, run }: { data: EcommerceBootstrap; canCreate: boolean; canModify: boolean; run: (action: () => Promise<unknown>, success: string) => Promise<unknown | undefined> }) {
  const shipments = data.orders.filter(order => !['NOUVELLE', 'CONFIRMÉE', 'ANNULÉE'].includes(order.status));
  const change = (order: EcommerceOrder, status: EcommerceOrderStatus) => run(() => createEcommerceApi(data.store.companyId).updateOrderStatus(order.id, status), 'Flux de livraison mis à jour.');
  const changeRequest = (request: EcommerceDeliveryRequest, status: EcommerceDeliveryRequestStatus) => run(() => createEcommerceApi(data.store.companyId).updateDeliveryRequestStatus(request.id, status), 'Demande de livraison mise à jour.');
  return <div className="space-y-5 fade-up">
     <DeliveryZoneManager data={data} canCreate={canCreate} canModify={canModify} run={run} />
    <Panel title="Demandes de services" description="Les clients peuvent demander une livraison même sans panier.">
       {data.deliveryRequests.length === 0 ? <Empty icon={Truck} title="Aucune demande de livraison" text="Les demandes déposées depuis la vitrine apparaîtront ici." /> : <div className="grid gap-3 md:grid-cols-2">{data.deliveryRequests.map(request => <div key={request.id} className="rounded-xl border p-4 transition hover:border-[hsl(var(--primary)/.3)] hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="mono text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{request.reference}</p><h3 className="mt-1 font-bold">{request.requesterName}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{request.requesterEmail} · {request.requesterPhone || 'Téléphone non renseigné'}</p></div><StatusPill value={request.status} /></div><p className="mt-3 text-sm">{request.address}</p>{request.deliveryZoneName && <p className="mt-2 text-xs font-bold text-[hsl(var(--primary))]">Zone : {request.deliveryZoneName}{request.deliveryZoneFee ? ` · ${money(request.deliveryZoneFee, data.store.currency)}` : ''}</p>}<p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{request.serviceType === 'URGENT' ? 'Demande urgente' : 'Livraison standard'}{request.desiredDate ? ` · souhaitée le ${dateLabel(request.desiredDate)}` : ''}</p>{request.note && <p className="mt-2 rounded-lg bg-[hsl(var(--muted)/.45)] p-2 text-xs">{request.note}</p>}<div className="mt-4 flex items-center justify-between gap-3 border-t pt-3"><span className="text-xs text-[hsl(var(--muted-foreground))]">{dateLabel(request.createdAt)}</span>{canModify && <select aria-label={`Changer le statut de ${request.reference}`} value={request.status} onChange={event => void changeRequest(request, event.target.value as EcommerceDeliveryRequestStatus)} className="rounded-lg border bg-[hsl(var(--card))] px-2 py-2 text-xs font-bold">{(['DEMANDEE', 'CONFIRMEE', 'EN_COURS', 'LIVREE', 'ANNULEE'] as EcommerceDeliveryRequestStatus[]).map(item => <option key={item} value={item}>{item}</option>)}</select>}</div></div>)}</div>}
    </Panel>
    <Panel title="Livraisons de commandes" description="Le flux des commandes qui ont quitté le bureau pour rejoindre vos clients.">
      {shipments.length === 0 ? <Empty icon={Truck} title="Aucune livraison de commande en cours" text="Les commandes en préparation et expédiées seront suivies ici." /> : <div className="grid gap-3 md:grid-cols-2">{shipments.map(order => <div key={order.id} className="rounded-xl border p-4 transition hover:border-[hsl(var(--primary)/.3)] hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="mono text-[10px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{order.reference}</p><h3 className="mt-1 font-bold">{order.customerName}</h3></div><StatusPill value={order.status} /></div><p className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{order.shippingAddress || 'Adresse de livraison non renseignée'}</p><div className="mt-4 flex items-center justify-between gap-3 border-t pt-3"><span className="text-xs font-bold">{money(order.total, data.store.currency)}</span>{canModify && <select aria-label={`Avancer la livraison ${order.reference}`} value={order.status} onChange={event => void change(order, event.target.value as EcommerceOrderStatus)} className="rounded-lg border bg-[hsl(var(--card))] px-2 py-2 text-xs font-bold">{orderStatuses.filter(item => !['NOUVELLE', 'ANNULÉE'].includes(item)).map(item => <option key={item} value={item}>{item}</option>)}</select>}</div></div>)}</div>}
    </Panel>
  </div>;
}

type DeliveryZoneForm = {
  name: string;
  description: string;
  fee: number;
  estimatedMinutes: number;
  isActive: boolean;
  sortOrder: number;
};

function DeliveryZoneManager({ data, canCreate, canModify, run }: { data: EcommerceBootstrap; canCreate: boolean; canModify: boolean; run: (action: () => Promise<unknown>, success: string) => Promise<unknown | undefined> }) {
  const { confirm } = useAppDialog();
  const [editing, setEditing] = useState<EcommerceDeliveryZone | 'new' | null>(null);
  const [form, setForm] = useState<DeliveryZoneForm>({ name: '', description: '', fee: 0, estimatedMinutes: 0, isActive: true, sortOrder: data.deliveryZones.length });
  const open = (zone?: EcommerceDeliveryZone) => {
    setEditing(zone ?? 'new');
    setForm(zone
      ? { name: zone.name, description: zone.description, fee: zone.fee, estimatedMinutes: zone.estimatedMinutes, isActive: zone.isActive, sortOrder: zone.sortOrder }
      : { name: '', description: '', fee: 0, estimatedMinutes: 0, isActive: true, sortOrder: data.deliveryZones.length });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const body = { ...form, name: form.name.trim(), description: form.description.trim() };
    const result = editing === 'new'
      ? await run(() => createEcommerceApi(data.store.companyId).createDeliveryZone(body), 'Zone de livraison créée.')
      : editing ? await run(() => createEcommerceApi(data.store.companyId).updateDeliveryZone(editing.id, body), 'Zone de livraison mise à jour.') : undefined;
    if (result) setEditing(null);
  };
  const remove = async (zone: EcommerceDeliveryZone) => {
    if (!await confirm({ title: 'Supprimer cette zone ?', description: `Les anciennes demandes conserveront leur historique : « ${zone.name} ».`, confirmLabel: 'Supprimer', tone: 'danger' })) return;
    await run(() => createEcommerceApi(data.store.companyId).deleteDeliveryZone(zone.id), 'Zone de livraison supprimée.');
  };
  const duration = (minutes: number) => minutes <= 0 ? 'À confirmer' : minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;

  return <Panel title="Zones de livraison" description="Définissez les secteurs desservis et les frais affichés aux clients." action={canCreate ? <button type="button" onClick={() => open()} className="btn inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]"><Plus size={15} />Ajouter une zone</button> : undefined}>
    {data.deliveryZones.length === 0 ? <Empty icon={Truck} title="Aucune zone configurée" text="Créez une zone pour permettre aux clients de choisir leur secteur de livraison." action={canCreate ? <button type="button" onClick={() => open()} className="text-xs font-bold text-[hsl(var(--primary))]">Créer la première zone</button> : undefined} /> : <div className="grid gap-3 md:grid-cols-2">{data.deliveryZones.map(zone => <article key={zone.id} className={`rounded-xl border p-4 ${zone.isActive ? '' : 'opacity-60'}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{zone.name}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{zone.description || 'Aucune précision'}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${zone.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{zone.isActive ? 'Active' : 'Inactive'}</span></div><div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-lg bg-[hsl(var(--muted)/.55)] px-2.5 py-1.5">{zone.fee > 0 ? money(zone.fee, data.store.currency) : 'Gratuit'}</span><span className="rounded-lg bg-[hsl(var(--muted)/.55)] px-2.5 py-1.5">{duration(zone.estimatedMinutes)}</span></div>{canModify && <div className="mt-4 flex gap-2 border-t pt-3"><button type="button" onClick={() => open(zone)} className="rounded-lg border px-2.5 py-2 text-xs font-bold"><Pencil size={13} className="mr-1 inline" />Modifier</button><button type="button" onClick={() => void remove(zone)} className="rounded-lg border px-2.5 py-2 text-xs font-bold text-[hsl(var(--destructive))]"><Archive size={13} className="mr-1 inline" />Supprimer</button></div>}</article>)}</div>}
    {editing && <Modal title={editing === 'new' ? 'Nouvelle zone de livraison' : `Modifier ${editing.name}`} onClose={() => setEditing(null)}><form onSubmit={save} className="space-y-4"><Field label="Nom de la zone" required value={form.name} onChange={value => setForm({ ...form, name: value })} placeholder="Ex. Dakar centre" /><label className="block text-xs font-bold">Description<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} rows={2} placeholder="Quartiers, communes ou repères desservis" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm" /></label><div className="grid gap-4 sm:grid-cols-2"><Field label={`Frais (${data.store.currency})`} type="number" value={String(form.fee)} onChange={value => setForm({ ...form, fee: Math.max(0, Number(value) || 0) })} /><Field label="Délai indicatif (minutes)" type="number" value={String(form.estimatedMinutes)} onChange={value => setForm({ ...form, estimatedMinutes: Math.max(0, Number(value) || 0) })} /><Field label="Ordre d’affichage" type="number" value={String(form.sortOrder)} onChange={value => setForm({ ...form, sortOrder: Math.max(0, Number(value) || 0) })} /><label className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold"><input type="checkbox" checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} />Zone active</label></div><div className="modal-footer flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2.5 text-xs font-bold">Annuler</button><button type="submit" className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]">Enregistrer</button></div></form></Modal>}
  </Panel>;
}

function HomePanel({ store, canModify, run }: { store: EcommerceStore; canModify: boolean; run: (action: () => Promise<unknown>, success: string) => Promise<unknown | undefined> }) {
  const [heroFiles, setHeroFiles] = useState<File[]>([]);
  const api = createEcommerceApi(store.companyId);
  const remainingSlots = Math.max(0, 12 - store.heroImages.length);

  const upload = async () => {
    if (heroFiles.length === 0 || !canModify) return;
    const result = await run(() => api.uploadStoreHeroImages(heroFiles), 'Images de l’accueil ajoutées.');
    if (result) setHeroFiles([]);
  };

  const remove = (url: string) => {
    const imageId = url.split('/').pop();
    if (imageId) void run(() => api.deleteStoreHeroImage(imageId), 'Image supprimée de l’accueil.');
  };

  return <div className="space-y-5 fade-up">
    <Panel title="Accueil de la boutique" description="Ajoutez les images qui s’affichent dans la bannière de votre accueil public.">
      <div className="max-w-4xl space-y-5">
        <div className="rounded-2xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary)/.05)] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold"><ImagePlus size={17} className="text-[hsl(var(--primary))]" />Images de la bannière</div>
              <p className="mt-1.5 max-w-xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">Sélectionnez une ou plusieurs images. Elles seront ajoutées à celles déjà présentes et défileront horizontalement sur l’accueil public.</p>
            </div>
            <span className="shrink-0 rounded-full bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-bold">{store.heroImages.length}/12 images</span>
          </div>
          <label className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-8 text-center transition ${!canModify || remainingSlots === 0 ? 'cursor-not-allowed opacity-50' : 'border-[hsl(var(--primary)/.35)] hover:bg-[hsl(var(--primary)/.06)]'}`}>
            <ImagePlus size={24} className="text-[hsl(var(--primary))]" />
            <span className="mt-2 text-sm font-bold">{remainingSlots === 0 ? 'Limite de 12 images atteinte' : 'Ajouter des images à l’accueil'}</span>
            <span className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{remainingSlots > 0 ? `Jusqu’à ${remainingSlots} image(s) supplémentaire(s) · JPG, PNG ou WebP` : 'Supprimez une image pour en ajouter une nouvelle.'}</span>
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={!canModify || remainingSlots === 0} onChange={event => setHeroFiles(Array.from(event.target.files ?? []).slice(0, remainingSlots))} className="sr-only" />
          </label>
          {heroFiles.length > 0 && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5"><p className="text-xs font-semibold text-[hsl(var(--primary))]">{heroFiles.length} nouvelle(s) image(s) sélectionnée(s)</p><button type="button" onClick={() => void upload()} disabled={!canModify} className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50"><Check size={14} />Enregistrer les images</button></div>}
        </div>
        {store.heroImages.length > 0
          ? <div><p className="text-xs font-bold">Images actuellement affichées</p><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{store.heroImages.map((url, index) => <div key={url} className="group relative overflow-hidden rounded-xl border bg-[hsl(var(--muted)/.25)]"><img src={url} alt={`Image d’accueil ${index + 1}`} className="aspect-[4/3] w-full object-cover" /><button type="button" disabled={!canModify} onClick={() => remove(url)} className="absolute right-2 top-2 rounded-full bg-[hsl(var(--destructive))] px-2 py-1 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Supprimer l’image d’accueil ${index + 1}`}>×</button></div>)}</div></div>
          : <div className="rounded-xl border border-dashed px-5 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Aucune image personnalisée. L’accueil public utilise actuellement son visuel par défaut.</div>}
      </div>
    </Panel>
  </div>;
}

function SettingsPanel({ store, canModify, run }: { store: EcommerceStore; canModify: boolean; run: (action: () => Promise<unknown>, success: string) => Promise<unknown | undefined> }) {
  const [form, setForm] = useState({
    currency: store.currency,
    allowOrderAttachments: store.allowOrderAttachments,
  });
  const initializedCompanyId = useRef<string | null>(null);
  const api = createEcommerceApi(store.companyId);
  useEffect(() => {
    if (initializedCompanyId.current === store.companyId) return;
    initializedCompanyId.current = store.companyId;
    setForm({
      currency: store.currency,
      allowOrderAttachments: store.allowOrderAttachments,
    });
  }, [store]);
  const patch = (updates: Partial<typeof form>) => setForm(current => ({ ...current, ...updates }));
  const save = (event: FormEvent) => {
    event.preventDefault();
    void run(() => api.updateStore(form), 'Paramètres E-commerce enregistrés.');
  };
  return <div className="space-y-5 fade-up">
    <Panel title="Paramètres E-commerce" description="Configurez la devise et les options propres aux commandes. Les réglages de la page d’accueil se trouvent dans Organisation et accès → Site public.">
      <form onSubmit={save} className="max-w-3xl space-y-5">
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-bold">Devise<select disabled={!canModify} value={form.currency} onChange={event => patch({ currency: event.target.value as EcommerceStore['currency'] })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm"><option value="XOF">XOF — Franc CFA</option><option value="EUR">EUR — Euro</option><option value="USD">USD — Dollar américain</option></select></label></div>
         <label className="flex items-start gap-3 rounded-xl border p-4">
           <input
             type="checkbox"
             checked={form.allowOrderAttachments}
             onChange={event => patch({ allowOrderAttachments: event.target.checked })}
             disabled={!canModify}
             className="mt-0.5"
           />
           <span>
             <span className="block text-sm font-bold">Autoriser les pièces jointes aux commandes</span>
             <span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">Les clients pourront joindre jusqu’à 3 fichiers PDF ou images de 2 Mo maximum pendant le paiement. Les fichiers restent privés.</span>
           </span>
         </label>
         <div className="flex justify-end border-t pt-5"><button type="submit" disabled={!canModify} className="btn inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))] disabled:cursor-not-allowed disabled:opacity-50"><Check size={14} />Enregistrer les réglages E-commerce</button></div>
      </form>
    </Panel>
  </div>;
}

function OrderRow({ order, currency }: { order: EcommerceOrder; currency: EcommerceStore['currency'] }) {
  return <div className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><ShoppingBag size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{order.reference} <span className="font-normal text-[hsl(var(--muted-foreground))]">· {order.customerName}</span></p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{dateLabel(order.createdAt)}</p></div><div className="text-right"><p className="text-sm font-bold">{money(order.total, currency)}</p><StatusPill value={order.status} /></div></div>;
}

function CounterSaleRow({ sale }: { sale: EcommercePosSale }) {
  const paymentLabel = {
    CASH: 'Espèces',
    WAVE: 'Wave',
    ORANGE_MONEY: 'Orange Money',
  }[sale.paymentMethod];
  return <div className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><Banknote size={16} /></span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold">{sale.reference} <span className="font-normal text-[hsl(var(--muted-foreground))]">· {sale.customerName}</span></p>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{dateLabel(sale.createdAt)} · {paymentLabel}</p>
    </div>
    <div className="text-right">
      <p className="text-sm font-bold">{money(sale.total, sale.currency)}</p>
      <StatusPill value={sale.status === 'PAID' ? 'Payée' : 'Remboursée'} />
    </div>
  </div>;
}

function Panel({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="card-surface overflow-hidden rounded-2xl"><header className="section-heading border-b px-5 py-4 sm:px-6"><div><h2 className="font-bold">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{description}</p>}</div>{action}</header><div className="p-5 sm:p-6">{children}</div></section>;
}

function Metric({ label, value, detail, icon: Icon, accent, warning }: { label: string; value: string; detail: string; icon: typeof CircleDollarSign; accent?: boolean; warning?: boolean }) {
  return <div className={`metric-card card-surface rounded-xl p-4 ${accent ? 'border-[hsl(var(--primary)/.3)]' : ''}`}><div className="flex items-start justify-between gap-2"><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${warning ? 'bg-[hsl(var(--accent)/.18)] text-[hsl(var(--foreground))]' : 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]'}`}><Icon size={17} /></span><span className="mono text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Live</span></div><p className="mt-5 text-xs text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-1 break-words text-2xl font-bold leading-6 tracking-[-.04em]">{value}</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{detail}</p></div>;
}

function Insight({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="rounded-xl border bg-[hsl(var(--muted)/.25)] p-4"><p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{detail}</p></div>;
}

function Empty({ icon: Icon, title, text, action }: { icon: typeof Package; title: string; text: string; action?: ReactNode }) {
  return <div className="rounded-xl border border-dashed bg-[hsl(var(--muted)/.18)] px-5 py-10 text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><Icon size={19} /></span><h3 className="mt-4 text-sm font-bold">{title}</h3><p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-[hsl(var(--muted-foreground))]">{text}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

function StatusPill({ value }: { value: string }) {
  const positive = ['PUBLISHED', 'LIVRÉE', 'Disponible', 'Payée'];
  const warning = ['DRAFT', 'NOUVELLE', 'CONFIRMÉE', 'EN PRÉPARATION'];
  const danger = ['ARCHIVED', 'ANNULÉE', 'Remboursée'];
  const tone = positive.includes(value) ? 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]' : warning.includes(value) ? 'bg-[hsl(var(--accent)/.16)] text-[hsl(var(--foreground))]' : danger.includes(value) ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]';
  return <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[.06em] ${tone}`}>{value}</span>;
}

function Field({ label, value, onChange, placeholder, type = 'text', required, disabled }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean; disabled?: boolean }) {
  if (label === 'Slug' || label === 'Slug public (optionnel)') {
    return <div className="rounded-lg border bg-[hsl(var(--muted)/.28)] px-3 py-2.5"><span className="block text-[11px] font-bold text-[hsl(var(--muted-foreground))]">Slug généré automatiquement</span><span className="mono mt-1 block truncate text-xs">{value || 'Sera créé à partir du nom'}</span></div>;
  }
  return <label className="block text-xs font-bold">{label}{required && <span className="ml-1 text-[hsl(var(--destructive))]">*</span>}<input required={required} disabled={disabled} type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60" /></label>;
}

function Modal({ title, onClose, children, large = false }: { title: string; onClose: () => void; children: ReactNode; large?: boolean }) {
  return createPortal(
    <div className="ecommerce-modal-backdrop fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-[hsl(var(--foreground)/.4)] p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" className={`modal-panel card-surface w-full rounded-2xl p-5 fade-up sm:p-6 ${large ? 'max-h-[92vh] max-w-5xl overflow-y-auto sm:p-8' : 'max-w-2xl'}`}>
        <header className="modal-header flex items-center justify-between gap-4"><h2 className="text-lg font-bold">{title}</h2><button type="button" aria-label="Fermer" onClick={onClose} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]"><X size={17} /></button></header>
        <div className="modal-body pt-5">{children}</div>
      </section>
    </div>,
    document.body,
  );
}