import { createContext, useContext, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Boxes, Check, ChevronLeft, ChevronRight, ClipboardCheck, Download, Edit3, FileBarChart, History, MapPin, Package, Plus, RefreshCw, Search, Settings, SlidersHorizontal, Trash2, Truck, UserRound, Users, Warehouse, X } from 'lucide-react';
import { createStockApi, type StockApi, type StockBootstrap, type StockBootstrapScope, type StockCategory, type StockInventory, type StockLocation, type StockMovement, type StockMovementInputType, type StockMovementType, type StockProduct, type StockRequest, type StockSupplier, type StockWarehouse } from '@/lib/stock-api';
import { useQueryTab } from '@/lib/query-tab';
import { WorkspaceTabs } from '@/components/workspace-tabs';
import { ResponsiveFilterGroup } from '@/components/responsive-filter-group';
import { countActiveFilters } from '@/lib/filter-group';
import { useAppDialog } from '@/components/confirm-dialog';
import { showAppToast } from '@workspace/maximus-design-system/hooks/use-toast';
import { useAutoRefresh } from '@/hooks/use-auto-refresh';

const dateLabel = (value: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const movementLabels: StockMovementType[] = ['ENTRÉE', 'SORTIE', 'TRANSFERT', 'AJUSTEMENT+', 'AJUSTEMENT-', 'PERTE'];
const movementOut = new Set<StockMovementType>(['SORTIE', 'AJUSTEMENT-', 'PERTE']);
const tabs = [
  ['dashboard', 'Tableau de bord', Boxes],
  ['products', 'Articles', Package],
  ['entries', 'Entrées de stock', ArrowDownToLine],
  ['exits', 'Sorties de stock', ArrowUpFromLine],
  ['requests', 'Demandes', ClipboardCheck],
  ['inventory', 'Inventaire', ClipboardCheck],
  ['reports', 'Rapports', FileBarChart],
  ['references', 'Référentiels', Warehouse],
  ['users', 'Utilisateurs', Users],
  ['settings', 'Paramètres', Settings],
] as const;

type Tab = typeof tabs[number][0];
type ProductForm = Omit<StockProduct, 'id' | 'companyId' | 'archived' | 'unit'>;
type WarehouseForm = Pick<StockWarehouse, 'name' | 'manager' | 'address'>;
type SupplierForm = Pick<StockSupplier, 'name' | 'contactName' | 'email' | 'phone' | 'address' | 'notes'>;
type MovementForm = { productId: string; warehouseId: string; destinationWarehouseId: string; quantity: number; reason: string; movementDate: string; userName: string; reference: string; comment: string };

const blankProduct: ProductForm = { name: '', category: '', brand: '', sku: '', barcode: '', imageUrl: '', minStock: 0, maxStock: 0, supplierId: null, description: '' };
const blankWarehouse: WarehouseForm = { name: '', manager: '', address: '' };
const blankSupplier: SupplierForm = { name: '', contactName: '', email: '', phone: '', address: '', notes: '' };
const emptyStockBootstrap: StockBootstrap = { products: [], categories: [], warehouses: [], locations: [], suppliers: [], balances: [], movements: [], requests: [], inventories: [], inventoryLines: [] };
const StockApiContext = createContext<StockApi | null>(null);
const StockAccessContext = createContext({ canCreate: true, canModify: true });
const useStockApi = () => {
  const api = useContext(StockApiContext);
  if (!api) throw new Error('Le contexte de gestion de stock est indisponible.');
  return api;
};
const useStockAccess = () => useContext(StockAccessContext);

export default function StockModulePage({ companyId, companyUsers = [], companyServices = [], canCreate = true, canModify = true, stockPermissions, singleModuleNavigation = false, preview = false }: { companyId: string; companyUsers?: { id: string; firstName: string; lastName: string; email: string; role: string; status: string }[]; companyServices?: { id: string; name: string }[]; canCreate?: boolean; canModify?: boolean; stockPermissions?: Record<string, string[]>; singleModuleNavigation?: boolean; preview?: boolean }) {
  const [data, setData] = useState<StockBootstrap | null>(null);
  const [tab, setTab] = useQueryTab({
    tabs: tabs.map(([id]) => id),
    defaultTab: 'dashboard',
    isAllowed: id => !stockPermissions || stockPermissions[id]?.includes('voir'),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const api = createStockApi(companyId);
  const loadedScopes = useRef(new Set<StockBootstrapScope>());
  const loadingScopes = useRef(new Set<StockBootstrapScope>());

  const scopeForTab = (currentTab: Tab): StockBootstrapScope => {
    if (currentTab === 'inventory') return 'inventory';
    if (currentTab === 'entries' || currentTab === 'exits' || currentTab === 'requests' || currentTab === 'reports') return 'operations';
    return 'core';
  };

  const load = async (silent = false, requestedScope: StockBootstrapScope = 'core') => {
    if (loadingScopes.current.has(requestedScope)) return;
    loadingScopes.current.add(requestedScope);
    if (requestedScope === 'core' && !data && !silent) setLoading(true);
    else setRefreshing(true);
    try {
      const nextData = await api.bootstrap(requestedScope);
      loadedScopes.current.add(requestedScope);
      setData(current => ({ ...emptyStockBootstrap, ...current, ...nextData }));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger le module Stocks.');
    } finally {
      loadingScopes.current.delete(requestedScope);
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => {
    if (preview) {
      setData(emptyStockBootstrap);
      setError('');
      setLoading(false);
      return;
    }
    loadedScopes.current.clear();
    loadingScopes.current.clear();
    setData(null);
    void load(false, 'core');
  }, [companyId, preview]);
  useEffect(() => {
    if (preview || !data) return;
    const scope = scopeForTab(tab);
    if (!loadedScopes.current.has(scope)) void load(false, scope);
  }, [tab, preview, data]);
  useAutoRefresh(() => load(true, scopeForTab(tab)), { enabled: !preview && Boolean(data) });
  const run = async (action: () => Promise<unknown>, success: string) => {
    if (pendingAction) return;
    setPendingAction(true);
    showAppToast('Action en cours…', 'info');
    try {
      await action();
      showAppToast(success, 'success');
      // The mutation is complete; do not make the user wait for the
      // consistency refresh. Keep the existing view usable while it runs.
      void load(true, scopeForTab(tab));
    }
    catch (cause) { showAppToast(cause instanceof Error ? cause.message : 'Opération impossible.', 'error'); }
    finally { setPendingAction(false); }
  };
  useEffect(() => {
    if (!data || !stockPermissions) return;
    if (!tabs.some(([id]) => id === tab && stockPermissions[id]?.includes('voir'))) {
      setTab(tabs.find(([id]) => stockPermissions[id]?.includes('voir'))?.[0] ?? 'dashboard');
    }
  }, [data, stockPermissions, tab]);
  if (loading) return <div className="card-surface min-h-80 rounded-2xl p-5"><div className="mb-5 h-5 w-44 animate-pulse rounded bg-[hsl(var(--muted))]" /><div className="grid gap-3 sm:grid-cols-3"><div className="h-24 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /><div className="h-24 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /><div className="h-24 animate-pulse rounded-xl bg-[hsl(var(--muted))]" /></div><div className="mt-6 h-52 animate-pulse rounded-xl bg-[hsl(var(--muted)/.7)]" /></div>;
  if (!data) return <div className="card-surface rounded-2xl p-8"><h2 className="font-bold">La gestion de stock est indisponible</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{error}</p><button onClick={() => void load()} className="mt-5 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--primary-foreground))]">Réessayer</button></div>;

  const visibleTabs = tabs.filter(([id]) => !stockPermissions || stockPermissions[id]?.includes('voir'));
  const currentTabPermissions = stockPermissions?.[tab];
  const currentCanCreate = canCreate && (!stockPermissions || (currentTabPermissions?.includes('voir') && currentTabPermissions.includes('créer')));
  const currentCanModify = canModify && (!stockPermissions || (currentTabPermissions?.includes('voir') && currentTabPermissions.includes('créer') && currentTabPermissions.includes('modifier')));

  const tabNav = (className?: string) => <WorkspaceTabs
    sidebarNavigation={singleModuleNavigation}
    items={tabs
      .filter(([id]) => visibleTabs.some(([visibleId]) => visibleId === id))
      .map(([id, label, icon]) => ({ id, label, icon }))}
    activeId={tab}
    onChange={id => setTab(id as Tab)}
    ariaLabel="Menu gestion de stock"
    testIdPrefix="stock-tab"
    className={className}
  />;

  return <StockApiContext.Provider value={api}><StockAccessContext.Provider value={{ canCreate: Boolean(currentCanCreate), canModify: Boolean(currentCanModify) }}><div className="space-y-5" aria-busy={pendingAction}>
    {pendingAction && <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--primary)/.24)] bg-[hsl(var(--primary)/.07)] px-4 py-3 text-sm font-semibold text-[hsl(var(--primary))]" role="status"><RefreshCw size={15} className="animate-spin" aria-hidden="true" />Enregistrement en cours…</div>}
    {error && <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--destructive)/.25)] bg-[hsl(var(--destructive)/.07)] px-4 py-3 text-sm text-[hsl(var(--destructive))]"><span>{error}</span><button onClick={() => setError('')}><X size={16} /></button></div>}
       <div className="space-y-5">
        <div className={`flex items-center justify-between gap-3 ${singleModuleNavigation ? 'justify-end' : 'border-b border-[hsl(var(--border))] pb-2'}`}>
          {!singleModuleNavigation && tabNav('flex-1 pb-1')}
        <button title="Actualiser" aria-label="Actualiser" onClick={() => void load(true)} className="shrink-0 rounded-lg border p-2.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">{refreshing ? <RefreshCw className="animate-spin" size={15} /> : <RefreshCw size={15} />}</button>
      </div>
      <div data-stock-can-create={currentCanCreate} data-stock-can-modify={currentCanModify}>
      {tab === 'dashboard' && <StockDashboard data={data} onTab={setTab} />}
      {tab === 'products' && <ProductsPanel data={data} run={run} />}
       {tab === 'entries' && <StockEntriesPanel data={data} run={run} onOpenReferences={() => setTab('references')} />}
       {tab === 'exits' && <StockExitsPanel data={data} run={run} services={companyServices} onOpenReferences={() => setTab('references')} />}
      {tab === 'requests' && <StockRequestsPanel data={data} run={run} />}
      {tab === 'inventory' && <InventoryPanel data={data} run={run} />}
      {tab === 'reports' && <ReportsPanel data={data} />}
      {tab === 'references' && <ReferencesPanel data={data} run={run} />}
      {tab === 'users' && <StockUsersPanel users={companyUsers} />}
      {tab === 'settings' && <StockSettingsPanel />}
      </div>
    </div>
  </div></StockAccessContext.Provider></StockApiContext.Provider>;
}

function StockDashboard({ data, onTab }: { data: StockBootstrap; onTab: (tab: Tab) => void }) {
  const products = data.products.filter(product => !product.archived);
  const total = products.reduce((sum, product) => sum + data.balances.filter(balance => balance.productId === product.id).reduce((a, balance) => a + balance.quantity, 0), 0);
  const byProduct = products.map(product => ({ product, quantity: data.balances.filter(balance => balance.productId === product.id).reduce((a, balance) => a + balance.quantity, 0) }));
  const out = byProduct.filter(item => item.quantity <= 0);
  const low = byProduct.filter(item => item.quantity > 0 && item.quantity <= item.product.minStock);
  const entries = data.movements.filter(movement => movement.type === 'ENTRÉE').reduce((sum, movement) => sum + movement.quantity, 0);
  const sorties = data.movements.filter(movement => movementOut.has(movement.type)).reduce((sum, movement) => sum + movement.quantity, 0);
  const transfers = data.movements.filter(movement => movement.type === 'TRANSFERT').length;
  const losses = data.movements.filter(movement => movement.type === 'PERTE').reduce((sum, movement) => sum + movement.quantity, 0);
  const alerts = [...out.map(item => ({ label: 'Rupture de stock', product: item.product.name, tone: 'danger' })), ...low.map(item => ({ label: 'Stock faible', product: item.product.name, tone: 'warning' })), ...byProduct.filter(item => item.product.maxStock > 0 && item.quantity > item.product.maxStock).map(item => ({ label: 'Seuil maximum dépassé', product: item.product.name, tone: 'warning' })), ...products.filter(product => !data.movements.some(movement => movement.productId === product.id)).map(product => ({ label: 'Produit sans mouvement', product: product.name, tone: 'neutral' }))];
  return <div className="space-y-5">
    <div className="mobile-stat-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric label="Stock total" value={total.toLocaleString('fr-FR')} detail={`${products.length} références actives`} icon={Boxes} accent /><Metric label="Produits en rupture" value={String(out.length).padStart(2, '0')} detail="stock nul ou négatif bloqué" icon={AlertTriangle} warning /><Metric label="Produits sous seuil" value={String(low.length).padStart(2, '0')} detail="réapprovisionnement à prévoir" icon={Package} /></div>
    <div className="mobile-stat-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Entrées" value={entries.toLocaleString('fr-FR')} detail="articles ajoutés" icon={ArrowDownToLine} /><Metric label="Sorties" value={sorties.toLocaleString('fr-FR')} detail="articles retirés" icon={ArrowUpFromLine} /><Metric label="Transferts" value={String(transfers)} detail="mouvements inter-entrepôts" icon={ArrowLeftRight} /><Metric label="Pertes" value={losses.toLocaleString('fr-FR')} detail="articles déclarés" icon={AlertTriangle} warning /></div>
    <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
       <Panel title="Derniers mouvements" action={<button onClick={() => onTab('entries')} className="text-xs font-bold text-[hsl(var(--primary))]">Tout voir <ChevronRight className="inline" size={14} /></button>}><MovementTable data={data} movements={data.movements.slice(0, 6)} /></Panel>
      <Panel title="Alertes opérationnelles" action={<button onClick={() => onTab('reports')} className="text-xs font-bold text-[hsl(var(--primary))]">Rapports</button>}><div className="space-y-3">{alerts.length === 0 && <Empty text="Aucune alerte active." />}{alerts.slice(0, 7).map((alert, index) => <div key={`${alert.product}-${alert.label}-${index}`} className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${alert.tone === 'danger' ? 'bg-[hsl(var(--destructive))]' : alert.tone === 'warning' ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--primary))]'}`} /><div><p className="text-sm font-bold">{alert.label}</p><p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{alert.product}</p></div></div>)}</div></Panel>
    </div>
    <Panel title="Stock par entrepôt"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.warehouses.filter(warehouse => !warehouse.archived).map(warehouse => { const quantity = data.balances.filter(balance => balance.warehouseId === warehouse.id).reduce((sum, balance) => sum + balance.quantity, 0); return <div key={warehouse.id} className="rounded-xl border p-4"><div className="flex items-center justify-between"><p className="font-bold">{warehouse.name}</p><Warehouse size={17} className="text-[hsl(var(--primary))]" /></div><p className="mt-3 text-2xl font-bold">{quantity.toLocaleString('fr-FR')}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{warehouse.manager || 'Responsable non défini'}</p></div>; })}</div></Panel>
  </div>;
}

function StockRequestsPanel({ data, run }: { data: StockBootstrap; run: (action: () => Promise<unknown>, success: string) => Promise<void> }) {
  const { confirm } = useAppDialog();
  const stockApi = useStockApi();
  const { canCreate, canModify } = useStockAccess();
  const [modal, setModal] = useState<StockRequest | 'new' | null>(null);
  const [form, setForm] = useState({ productId: data.products.find(product => !product.archived)?.id ?? '', warehouseId: data.warehouses.find(warehouse => !warehouse.archived)?.id ?? '', quantity: 1, reason: '' });
  const open = (request: StockRequest | 'new') => {
    setModal(request);
    setForm(request === 'new' ? { productId: data.products.find(product => !product.archived)?.id ?? '', warehouseId: data.warehouses.find(warehouse => !warehouse.archived)?.id ?? '', quantity: 1, reason: '' } : { productId: request.productId, warehouseId: request.warehouseId, quantity: request.quantity, reason: request.reason });
  };
  const submit = () => { if (!modal || (modal === 'new' ? !canCreate : !canModify) || !form.productId || !form.warehouseId || form.quantity < 1 || !form.reason.trim()) return; const action = modal === 'new' ? stockApi.createRequest({ ...form, reason: form.reason.trim(), createdBy: 'Utilisateur connecté' }) : stockApi.updateRequest(modal.id, { ...form, reason: form.reason.trim() }); void run(() => action, modal === 'new' ? 'Demande enregistrée.' : 'Demande modifiée.').then(() => { setModal(null); }); };
  return <div className="space-y-5"><Panel title="Demandes de réapprovisionnement" action={canCreate ? <Button primary onClick={() => open('new')}><Plus size={15} />Nouvelle demande</Button> : undefined}><p className="mb-5 text-sm text-[hsl(var(--muted-foreground))]">Créez une demande lorsqu’un article atteint son seuil ou qu’un besoin d’approvisionnement est identifié.</p>{data.requests.length === 0 ? <Empty text="Aucune demande enregistrée. Créez votre première demande de réapprovisionnement." /> : <DataTable headers={['Article', 'Entrepôt', 'Quantité', 'Motif', 'Date', 'Statut', 'Actions']} rows={data.requests.map(request => [data.products.find(product => product.id === request.productId)?.name ?? 'Article supprimé', data.warehouses.find(warehouse => warehouse.id === request.warehouseId)?.name ?? 'Entrepôt supprimé', request.quantity, request.reason, dateLabel(request.createdAt), <StatusPill value={request.status} />, request.status === 'EN ATTENTE' && canModify ? <div className="flex flex-wrap gap-2"><button aria-label="Modifier la demande" title="Modifier" onClick={() => open(request)} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold hover:bg-[hsl(var(--muted))]"><Edit3 size={13} /><span>Modifier</span></button><button aria-label="Supprimer la demande" title="Supprimer" onClick={() => void confirm({ title: 'Supprimer cette demande ?', description: 'La demande en attente sera supprimée.', confirmLabel: 'Supprimer', tone: 'danger' }).then(ok => { if (ok) void run(() => stockApi.deleteRequest(request.id), 'Demande supprimée.'); })} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"><Trash2 size={13} /><span>Supprimer</span></button><button onClick={() => void run(() => stockApi.updateRequestStatus(request.id, 'APPROUVÉE'), 'Demande approuvée.')} className="rounded-lg bg-[hsl(var(--primary))] px-2.5 py-2 text-[10px] font-bold text-white">Approuver</button><button onClick={() => void run(() => stockApi.updateRequestStatus(request.id, 'REJETÉE'), 'Demande rejetée.')} className="rounded-lg border px-2.5 py-2 text-[10px] font-bold text-[hsl(var(--destructive))]">Rejeter</button></div> : '—'])} />}</Panel>{modal && <RequestModal value={modal === 'new' ? form : modal} data={data} onClose={() => setModal(null)} onChange={setForm} onSave={submit} />}</div>;
}

function ReferencesPanel({ data, run }: { data: StockBootstrap; run: (action: () => Promise<unknown>, success: string) => Promise<void> }) {
  return <div className="space-y-5"><div><p className="text-sm text-[hsl(var(--muted-foreground))]">Les catégories, entrepôts, emplacements et fournisseurs sont propres à votre entreprise.</p></div><CategoriesPanel data={data} run={run} /><WarehousesPanel data={data} run={run} /><SuppliersPanel data={data} run={run} /></div>;
}

function CategoriesPanel({ data, run }: { data: StockBootstrap; run: (action: () => Promise<unknown>, success: string) => Promise<void> }) {
  const stockApi = useStockApi();
  const { confirm } = useAppDialog();
  const { canCreate, canModify } = useStockAccess();
  const [name, setName] = useState('');
  const create = () => {
    if (!canCreate || !name.trim()) return;
    void run(() => stockApi.createCategory(name.trim()), 'Catégorie créée.').then(() => setName(''));
  };
  const archive = async (category: StockCategory) => {
    if (!canModify || !await confirm({ title: 'Archiver cette catégorie ?', description: `La catégorie « ${category.name} » sera archivée. Les catégories utilisées ne peuvent pas être archivées.`, confirmLabel: 'Archiver', tone: 'danger' })) return;
    void run(() => stockApi.archiveCategory(category.id), 'Catégorie archivée.');
  };

  return <Panel title="Catégories d’articles" action={canCreate ? <button onClick={create} disabled={!name.trim()} className="rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Plus size={14} className="mr-1 inline" />Créer la catégorie</button> : undefined}>
    <div className="mb-4 max-w-lg"><Input label="Nouvelle catégorie" value={name} onChange={setName} placeholder="Ex. Matériel informatique" /></div>
    {data.categories.length === 0 ? <Empty text="Aucune catégorie. Créez-en une avant d’ajouter votre premier article." /> : <DataTable headers={['Catégorie', 'Articles associés', 'Action']} rows={data.categories.filter(category => !category.archived).map(category => {
      const usageCount = data.products.filter(product => product.category === category.name).length;
      return [category.name, usageCount, canModify ? <button disabled={usageCount > 0} onClick={() => void archive(category)} className="rounded-lg border px-2.5 py-1.5 text-xs font-bold text-[hsl(var(--destructive))] disabled:cursor-not-allowed disabled:opacity-40">Archiver</button> : '—'];
    })} />}
  </Panel>;
}

function StockUsersPanel({ users }: { users: { id: string; firstName: string; lastName: string; email: string; role: string; status: string }[] }) {
  return <div className="space-y-5"><Panel title="Utilisateurs de la gestion de stock"><div className="mb-5 flex items-center gap-3 rounded-xl bg-[hsl(var(--muted))] p-4"><Users className="text-[hsl(var(--primary))]" size={20} /><div><p className="font-bold">Accès gérés par l’organisation</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Les droits de chaque compte proviennent de son rôle et de son unité de rattachement.</p></div></div>{users.length === 0 ? <Empty text="Aucun compte employé n’est encore associé à cette entreprise." /> : <DataTable headers={['Utilisateur', 'Email', 'Rôle', 'Statut']} rows={users.map(user => [`${user.firstName} ${user.lastName}`, user.email, user.role || 'Rôle non défini', <StatusPill value={user.status} />])} />}</Panel></div>;
}

function StockSettingsPanel() {
  const { canModify } = useStockAccess();
  const [notifications, setNotifications] = useState(() => localStorage.getItem('maximus-stock-notifications') !== 'false');
  const [confirmSensitive, setConfirmSensitive] = useState(() => localStorage.getItem('maximus-stock-confirm-sensitive') !== 'false');
  const [saved, setSaved] = useState(false);
  const save = () => {
    if (!canModify) return;
    localStorage.setItem('maximus-stock-notifications', String(notifications));
    localStorage.setItem('maximus-stock-confirm-sensitive', String(confirmSensitive));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  };
  return <Panel title="Paramètres de la gestion de stock"><div className="max-w-2xl space-y-5"><SettingToggle title="Alertes de seuil" text="Afficher les alertes lorsque les articles passent sous leur stock minimum." checked={notifications} onChange={setNotifications} disabled={!canModify} /><SettingToggle title="Confirmation des opérations sensibles" text="Demander une confirmation avant les sorties, pertes, transferts et ajustements." checked={confirmSensitive} onChange={setConfirmSensitive} disabled={!canModify} /><div className="pt-2"><Button primary required="modify" onClick={save}>{saved ? 'Paramètres enregistrés' : 'Enregistrer'}</Button></div></div></Panel>;
}

function SettingToggle({ title, text, checked, onChange, disabled = false }: { title: string; text: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <div className="flex items-center justify-between gap-4 border-b pb-5 last:border-0"><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{text}</p></div><button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`h-6 w-11 shrink-0 rounded-full p-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} /></button></div>;
}

function ProductsPanel({ data, run }: { data: StockBootstrap; run: (action: () => Promise<unknown>, success: string) => Promise<void> }) {
  const { confirm } = useAppDialog();
  const stockApi = useStockApi();
  const { canCreate, canModify } = useStockAccess();
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('Toutes'); const [page, setPage] = useState(1); const [modal, setModal] = useState<StockProduct | 'new' | null>(null); const [history, setHistory] = useState<StockProduct | null>(null);
  const products = data.products.filter(product => !product.archived).filter(product => `${product.name} ${product.sku} ${product.barcode} ${product.brand}`.toLowerCase().includes(query.toLowerCase())).filter(product => category === 'Toutes' || product.category === category); const categories = ['Toutes', ...data.categories.filter(item => !item.archived).map(item => item.name)]; const pageData = paginate(products, page);
  const getQuantity = (id: string) => data.balances.filter(balance => balance.productId === id).reduce((sum, balance) => sum + balance.quantity, 0);
  return <div className="space-y-5"><Panel title="Articles stockés" action={canCreate ? <button onClick={() => setModal('new')} disabled={categories.length < 2} className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Plus size={15} />Ajouter un article</button> : undefined}>{categories.length < 2 && <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">Créez d’abord une catégorie dans Référentiels pour ajouter un article.</p>}<ResponsiveFilterGroup testId="stock-products-filters" activeCount={countActiveFilters([[category, 'Toutes']])} onClear={() => setCategory('Toutes')} search={<div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={15} /><input aria-label="Rechercher un article" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher par nom, SKU, marque ou code-barres..." className="w-full rounded-lg border bg-transparent py-2.5 pl-9 pr-3 text-sm" /></div>}><select aria-label="Filtrer par catégorie" value={category} onChange={event => setCategory(event.target.value)} className="rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5 text-sm">{categories.map(item => <option key={item}>{item}</option>)}</select></ResponsiveFilterGroup><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-[hsl(var(--muted)/.55)] text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr>{['Article', 'Référence', 'Catégorie', 'Stock', 'Seuils', 'Fournisseur', 'Actions'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y">{pageData.items.map(product => <tr key={product.id} className="hover:bg-[hsl(var(--muted)/.35)]"><td className="px-4 py-3"><div className="flex items-center gap-3">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><Package size={16} /></span>}<span><strong className="block">{product.name}</strong><small className="text-xs text-[hsl(var(--muted-foreground))]">{product.brand || 'Marque non définie'}</small></span></div></td><td className="mono px-4 py-3 text-xs">{product.sku}<small className="block text-[hsl(var(--muted-foreground))]">{product.barcode || 'Sans code-barres'}</small></td><td className="px-4 py-3">{product.category}</td><td className={`px-4 py-3 font-bold ${getQuantity(product.id) <= product.minStock ? 'text-[hsl(var(--destructive))]' : ''}`}>{getQuantity(product.id).toLocaleString('fr-FR')}</td><td className="px-4 py-3 text-xs">{product.minStock} min · {product.maxStock || '—'} max</td><td className="px-4 py-3 text-xs">{data.suppliers.find(supplier => supplier.id === product.supplierId)?.name ?? '—'}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1"><button aria-label={`Voir l’historique de ${product.name}`} title="Historique" onClick={() => setHistory(product)} className="inline-flex items-center gap-1 rounded border px-2 py-1.5 text-[10px] font-bold hover:bg-[hsl(var(--muted))]"><History size={13} /><span>Historique</span></button>{canModify && <><button aria-label={`Modifier ${product.name}`} title="Modifier" onClick={() => setModal(product)} className="inline-flex items-center gap-1 rounded border px-2 py-1.5 text-[10px] font-bold hover:bg-[hsl(var(--muted))]"><Edit3 size={13} /><span>Modifier</span></button><button aria-label={`Archiver ${product.name}`} title="Archiver" onClick={() => void confirm({ title: 'Archiver cet article ?', description: `L’article ${product.name} sera archivé.`, confirmLabel: 'Archiver', tone: 'danger' }).then(ok => { if (ok) void run(() => stockApi.archiveProduct(product.id), 'Article archivé.'); })} className="inline-flex items-center gap-1 rounded border px-2 py-1.5 text-[10px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"><Trash2 size={13} /><span>Archiver</span></button></>}</div></td></tr>)}</tbody></table></div><Pager page={page} pages={pageData.pages} setPage={setPage} total={products.length} /></Panel>{modal && <ProductModal value={modal === 'new' ? blankProduct : modal} categories={data.categories.filter(item => !item.archived)} suppliers={data.suppliers} onClose={() => setModal(null)} onSave={body => void run(() => modal === 'new' ? stockApi.createProduct(body) : stockApi.updateProduct(modal.id, body), modal === 'new' ? 'Article créé.' : 'Article modifié.').then(() => setModal(null))} />}{history && <HistoryModal product={history} data={data} onClose={() => setHistory(null)} />}</div>;
}

function WarehousesPanel({ data, run }: { data: StockBootstrap; run: (action: () => Promise<unknown>, success: string) => Promise<void> }) {
  const { confirm } = useAppDialog();
  const stockApi = useStockApi();
  const { canCreate, canModify } = useStockAccess();
  const [modal, setModal] = useState<StockWarehouse | 'new' | null>(null); const [locationWarehouse, setLocationWarehouse] = useState<string | null>(null); const [editingLocation, setEditingLocation] = useState<StockLocation | null>(null); const [locationName, setLocationName] = useState('');
  const openWarehouse = () => { if (canCreate) setModal('new'); };
  const openLocation = (warehouseId: string, location?: StockLocation) => {
    if (location ? !canModify : !canCreate) return;
    setLocationWarehouse(warehouseId);
    setEditingLocation(location ?? null);
    setLocationName(location?.name ?? '');
  };
  const archiveWarehouse = (warehouse: StockWarehouse) => {
    if (!canModify) return;
    void confirm({ title: 'Archiver cet entrepôt ?', description: `L’entrepôt ${warehouse.name} sera archivé.`, confirmLabel: 'Archiver', tone: 'danger' }).then(ok => {
      if (ok) void run(() => stockApi.archiveWarehouse(warehouse.id), 'Entrepôt archivé.');
    });
  };
  const archiveLocation = (location: StockLocation) => {
    if (!canModify) return;
    void confirm({ title: 'Archiver cet emplacement ?', description: `L’emplacement ${location.name} sera archivé.`, confirmLabel: 'Archiver', tone: 'danger' }).then(ok => {
      if (ok) void run(() => stockApi.archiveLocation(location.id), 'Emplacement archivé.');
    });
  };
  const saveWarehouse = (body: WarehouseForm) => {
    if (!modal) return;
    if (modal === 'new') {
      if (!canCreate) return;
      void run(() => stockApi.createWarehouse(body), 'Entrepôt créé.').then(() => setModal(null));
      return;
    }
    if (!canModify) return;
    void run(() => stockApi.updateWarehouse(modal.id, body), 'Entrepôt modifié.').then(() => setModal(null));
  };
  const saveLocation = () => {
    if (!locationWarehouse || !locationName.trim() || (editingLocation ? !canModify : !canCreate)) return;
    const action = editingLocation ? stockApi.updateLocation(editingLocation.id, locationName.trim()) : stockApi.createLocation(locationWarehouse, locationName.trim());
    void run(() => action, editingLocation ? 'Emplacement modifié.' : 'Emplacement créé.').then(() => { setLocationWarehouse(null); setEditingLocation(null); });
  };
  return <div className="space-y-5"><Panel title="Entrepôts et emplacements" action={canCreate ? <button onClick={openWarehouse} className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-3.5 py-2.5 text-xs font-bold text-white"><Plus size={15} />Ajouter un entrepôt</button> : undefined}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.warehouses.filter(warehouse => !warehouse.archived).map(warehouse => { const quantity = data.balances.filter(balance => balance.warehouseId === warehouse.id).reduce((sum, balance) => sum + balance.quantity, 0); const locations = data.locations.filter(location => location.warehouseId === warehouse.id && !location.archived); return <section key={warehouse.id} className="rounded-2xl border p-5"><div className="flex items-start justify-between"><span className="rounded-xl bg-[hsl(var(--primary)/.1)] p-3 text-[hsl(var(--primary))]"><Warehouse size={19} /></span>{canModify && <div className="flex flex-wrap gap-1"><button aria-label={`Modifier ${warehouse.name}`} title="Modifier l’entrepôt" onClick={() => { if (canModify) setModal(warehouse); }} className="inline-flex items-center gap-1 rounded border px-2 py-1.5 text-[10px] font-bold hover:bg-[hsl(var(--muted))]"><Edit3 size={13} /><span>Modifier</span></button><button aria-label={`Archiver ${warehouse.name}`} title="Archiver l’entrepôt" onClick={() => archiveWarehouse(warehouse)} className="inline-flex items-center gap-1 rounded border px-2 py-1.5 text-[10px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"><Trash2 size={13} /><span>Archiver</span></button></div>}</div><h2 className="mt-5 font-bold">{warehouse.name}</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{warehouse.address || 'Adresse non renseignée'}</p><div className="mt-5 grid grid-cols-2 gap-3 border-y py-4"><div><p className="text-2xl font-bold">{quantity.toLocaleString('fr-FR')}</p><small className="text-xs text-[hsl(var(--muted-foreground))]">unités en stock</small></div><div><p className="text-2xl font-bold">{locations.length}</p><small className="text-xs text-[hsl(var(--muted-foreground))]">emplacements</small></div></div><p className="mt-4 flex items-center gap-2 text-xs"><span className="rounded-full bg-[hsl(var(--accent)/.22)] px-2 py-1 font-bold">Responsable</span>{warehouse.manager || 'Non défini'}</p><div className="mt-4 space-y-2">{locations.map(location => <div key={location.id} className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><MapPin size={13} />{location.name}<span className="ml-auto">{data.balances.filter(balance => balance.locationId === location.id).reduce((sum, balance) => sum + balance.quantity, 0)} unités</span>{canModify && <><button aria-label={`Modifier ${location.name}`} title="Modifier l’emplacement" onClick={() => openLocation(warehouse.id, location)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-bold hover:bg-[hsl(var(--muted))]"><Edit3 size={12} /><span>Modifier</span></button><button aria-label={`Archiver ${location.name}`} title="Archiver l’emplacement" onClick={() => archiveLocation(location)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"><Trash2 size={12} /><span>Archiver</span></button></>}</div>)}{canCreate && <button onClick={() => openLocation(warehouse.id)} className="mt-2 text-xs font-bold text-[hsl(var(--primary))]"><Plus size={13} className="mr-1 inline" />Ajouter un emplacement</button>}</div></section>; })}</div></Panel>{modal && <WarehouseModal value={modal === 'new' ? blankWarehouse : modal} onClose={() => setModal(null)} onSave={saveWarehouse} />}{locationWarehouse && <Modal title={editingLocation ? 'Modifier l’emplacement' : 'Nouvel emplacement'} onClose={() => { setLocationWarehouse(null); setEditingLocation(null); }}><Input label="Nom de l’emplacement" value={locationName} onChange={setLocationName} /><div className="mt-6 flex justify-end"><Button primary required={editingLocation ? 'modify' : 'create'} onClick={saveLocation}>{editingLocation ? 'Enregistrer' : 'Créer l’emplacement'}</Button></div></Modal>}</div>;
}

function StockExitsPanel({ data, run, services, onOpenReferences }: { data: StockBootstrap; run: (action: () => Promise<unknown>, success: string) => Promise<void>; services: { id: string; name: string }[]; onOpenReferences: () => void }) {
  const { confirm } = useAppDialog();
  const stockApi = useStockApi();
  const { canCreate } = useStockAccess();
  const [modal, setModal] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ productId: '', supplierId: '', warehouseId: data.warehouses.find(warehouse => !warehouse.archived)?.id ?? '', quantity: 0, service: '', beneficiary: '', reason: '', comment: '' });
  const exits = data.movements.filter(movement => movementOut.has(movement.type)).filter(movement => `${movement.reference} ${data.products.find(product => product.id === movement.productId)?.name ?? ''} ${movement.requesterService ?? ''} ${movement.beneficiary ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const pageData = paginate(exits, page);
  const submit = async () => { if (!canCreate || !form.productId || !form.warehouseId || form.quantity < 1 || !form.service || !form.beneficiary.trim() || !form.reason.trim()) return; if (!await confirm({ title: 'Confirmer cette sortie ?', description: 'Cette opération diminuera le stock disponible.', confirmLabel: 'Confirmer' })) return; void run(() => stockApi.createMovement({ productId: form.productId, supplierId: form.supplierId || null, warehouseId: form.warehouseId, type: 'SORTIE', quantity: form.quantity, requesterService: form.service, beneficiary: form.beneficiary.trim(), reason: form.reason.trim(), movementDate: new Date().toISOString(), userName: 'Utilisateur connecté', reference: '', comment: form.comment.trim() }), 'Sortie enregistrée.').then(() => setModal(false)); };
  const open = () => { if (!canCreate) return; setForm(current => ({ ...current, productId: '', supplierId: '', quantity: 0, service: '', beneficiary: '', reason: '', comment: '' })); setModal(true); };
   return <div className="space-y-5"><header><h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl"><ArrowUpFromLine className="text-[hsl(var(--primary))]" size={29} />Sorties de stock</h1><p className="mt-2 max-w-2xl text-sm text-[hsl(var(--muted-foreground))] sm:text-base">Délivrance de matériel, aliments et articles aux services.</p></header><div className="flex flex-col gap-2 sm:flex-row">{canCreate && <button onClick={open} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-white shadow-sm hover:opacity-90"><Plus size={18} />Nouvelle sortie</button>}<button onClick={onOpenReferences} className="flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold hover:bg-[hsl(var(--muted))]"><Truck size={17} />Gérer les fournisseurs</button></div><Panel title="Historique des sorties"><div className="relative mb-5 max-w-xl"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={18} /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher par article, service..." className="w-full rounded-lg border bg-transparent py-3 pl-10 pr-3 text-base" /></div>{pageData.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-y bg-[hsl(var(--muted)/.45)] text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr>{['Date', 'Article', 'Quantité', 'Service demandeur', 'Bénéficiaire'].map(header => <th key={header} className="px-3 py-3">{header}</th>)}</tr></thead><tbody className="divide-y">{pageData.items.map(exit => { const product = data.products.find(item => item.id === exit.productId); const date = new Date(exit.movementDate); return <tr key={exit.id} className="hover:bg-[hsl(var(--muted)/.3)]"><td className="whitespace-nowrap px-3 py-4 text-[hsl(var(--muted-foreground))]"><span className="block">{date.toLocaleDateString('fr-FR')}</span><span className="block">{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span></td><td className="px-3 py-4"><strong className="block">{product?.name ?? 'Article supprimé'}</strong><small className="text-xs text-[hsl(var(--muted-foreground))]">{product?.sku ?? '—'}</small></td><td className="px-3 py-4"><strong className="text-[hsl(var(--accent-foreground))]">-{exit.quantity} article(s)</strong></td><td className="px-3 py-4"><strong className="block">{exit.requesterService ?? 'Service non renseigné'}</strong><small className="text-xs text-[hsl(var(--muted-foreground))]">{exit.reason}</small></td><td className="px-3 py-4 font-medium">{exit.beneficiary ?? '—'}</td></tr>; })}</tbody></table></div> : <Empty text="Aucune sortie de stock enregistrée." />}<Pager page={page} pages={pageData.pages} setPage={setPage} total={exits.length} /></Panel>{modal && <Modal title="Nouvelle sortie de stock" onClose={() => setModal(false)}><div className="mb-6 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/.2)] text-[hsl(var(--accent-foreground))]"><ArrowUpFromLine size={24} /></div><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Enregistrez une délivrance de matériel ou produit.</p></div><p className="mb-4 text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Article concerné</p><Select label="Article *" value={form.productId} onChange={value => setForm(current => ({ ...current, productId: value }))} options={[['', "Sélectionner l'article"], ...data.products.filter(product => !product.archived).map(product => [product.id, product.name])]} /><div className="my-6 border-t" /><p className="mb-4 text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Délivrance</p><div className="grid gap-4 sm:grid-cols-2"><Input label="Quantité d’articles *" type="number" value={String(form.quantity)} onChange={value => setForm(current => ({ ...current, quantity: Number(value) }))} /><Select label="Service demandeur *" value={form.service} onChange={value => setForm(current => ({ ...current, service: value }))} options={[['', 'Sélectionner'], ...services.map(service => [service.id, service.name])]} /><Select label="Fournisseur (facultatif)" value={form.supplierId} onChange={value => setForm(current => ({ ...current, supplierId: value }))} options={[['', 'Aucun fournisseur'], ...data.suppliers.filter(supplier => !supplier.archived).map(supplier => [supplier.id, supplier.name])]} /></div><Input label="Bénéficiaire *" value={form.beneficiary} onChange={value => setForm(current => ({ ...current, beneficiary: value }))} placeholder="Nom du réceptionnaire" /><Input label="Motif *" value={form.reason} onChange={value => setForm(current => ({ ...current, reason: value }))} placeholder="Ex : Alimentation bassins, entretien pc..." /><label className="mt-4 block text-xs font-bold">Observation<textarea value={form.comment} onChange={event => setForm(current => ({ ...current, comment: event.target.value }))} placeholder="Remarques éventuelles..." rows={4} className="mt-2 w-full resize-none rounded-lg border bg-transparent px-3 py-2.5 text-sm font-normal" /></label><div className="mt-6 flex justify-end gap-3"><Button onClick={() => setModal(false)}>Annuler</Button><Button primary disabled={!canCreate || !form.productId || !form.warehouseId || form.quantity < 1 || !form.service || !form.beneficiary.trim() || !form.reason.trim()} onClick={submit}>Enregistrer la sortie</Button></div></Modal>}</div>;
}

function StockMovementModePanel({ data, run, mode }: { data: StockBootstrap; run: (action: () => Promise<unknown>, success: string) => Promise<void>; mode: 'entries' | 'exits' }) {
  const { confirm } = useAppDialog();
  const stockApi = useStockApi();
  const { canCreate } = useStockAccess();
  const isEntry = mode === 'entries';
  const types: StockMovementInputType[] = isEntry ? ['ENTRÉE', 'AJUSTEMENT+'] : ['SORTIE', 'AJUSTEMENT-', 'PERTE'];
  const [modal, setModal] = useState(false);
  const [type, setType] = useState<StockMovementInputType>(types[0]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ productId: data.products.find(product => !product.archived)?.id ?? '', warehouseId: data.warehouses.find(product => !product.archived)?.id ?? '', destinationWarehouseId: '', quantity: 1, reason: '', movementDate: new Date().toISOString().slice(0, 10), userName: 'Utilisateur connecté', reference: '', comment: '' });
  const filtered = data.movements.filter(movement => types.includes(movement.type as StockMovementInputType)).filter(movement => `${movement.type} ${movement.reference} ${movement.reason} ${movement.userName}`.toLowerCase().includes(query.toLowerCase()));
  const pageData = paginate(filtered, page);
  const open = (nextType: StockMovementInputType) => { if (!canCreate) return; setType(nextType); setForm(current => ({ ...current, destinationWarehouseId: '', reason: '', quantity: 1 })); setModal(true); };
  const submit = async () => { if (!canCreate || !form.productId || !form.warehouseId || !form.quantity || !form.reason) return; if (movementOut.has(type) && !await confirm({ title: 'Confirmer cette sortie ?', description: 'Cette opération diminuera le stock disponible.', confirmLabel: 'Confirmer' })) return; void run(() => stockApi.createMovement({ ...form, type, destinationWarehouseId: null, movementDate: new Date(form.movementDate).toISOString() }), isEntry ? 'Entrée enregistrée.' : 'Sortie enregistrée.').then(() => setModal(false)); };
  return <div className="space-y-5"><Panel title={isEntry ? 'Entrées de stock' : 'Sorties de stock'} action={<div className="flex flex-wrap gap-2">{types.map(action => <button key={action} onClick={() => open(action)} className="rounded-lg border px-2.5 py-2 text-[10px] font-bold hover:bg-[hsl(var(--muted))]"><Plus size={12} className="mr-1 inline" />{action}</button>)}</div>}><p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">{isEntry ? 'Enregistrez les réceptions et augmentations de stock.' : 'Enregistrez les sorties, pertes et ajustements de stock.'}</p><div className="mb-4 relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={15} /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder={isEntry ? 'Rechercher une entrée...' : 'Rechercher une sortie...'} className="w-full rounded-lg border bg-transparent py-2.5 pl-9 pr-3 text-sm" /></div>{pageData.items.length ? <MovementTable data={data} movements={pageData.items} detailed /> : <Empty text={isEntry ? 'Aucune entrée de stock enregistrée.' : 'Aucune sortie de stock enregistrée.'} />}<Pager page={page} pages={pageData.pages} setPage={setPage} total={filtered.length} /></Panel>{modal && <MovementModal data={data} type={type} form={form} setForm={setForm} onClose={() => setModal(false)} onSave={submit} />}</div>;
}

function StockEntriesPanel({ data, run, onOpenReferences }: { data: StockBootstrap; run: (action: () => Promise<unknown>, success: string) => Promise<void>; onOpenReferences: () => void }) {
  const { confirm } = useAppDialog();
  const stockApi = useStockApi();
  const { canCreate } = useStockAccess();
  const [modal, setModal] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ productId: '', supplierId: '', warehouseId: data.warehouses.find(warehouse => !warehouse.archived)?.id ?? '', quantity: 0, comment: '' });
  const activeProducts = data.products.filter(product => !product.archived);
  const entries = data.movements.filter(movement => movement.type === 'ENTRÉE' || movement.type === 'AJUSTEMENT+').filter(movement => `${movement.reference} ${data.products.find(product => product.id === movement.productId)?.name ?? ''} ${data.suppliers.find(supplier => supplier.id === movement.supplierId)?.name ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const pageData = paginate(entries, page);
  const open = () => { if (!canCreate) return; setForm(current => ({ ...current, productId: '', supplierId: '', quantity: 0, comment: '' })); setModal(true); };
  const canSubmit = Boolean(form.productId && form.supplierId && form.warehouseId && form.quantity >= 1);
  const submit = () => { if (!canCreate || !canSubmit) return; void run(() => stockApi.createMovement({ productId: form.productId, supplierId: form.supplierId, warehouseId: form.warehouseId, type: 'ENTRÉE', quantity: form.quantity, reason: 'Réception / approvisionnement', movementDate: new Date().toISOString(), userName: 'Utilisateur connecté', comment: form.comment.trim() }), 'Entrée enregistrée.').then(() => setModal(false)); };
   return <div className="space-y-5"><header><h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl"><ArrowDownToLine className="text-[hsl(var(--primary))]" size={29} />Entrées de stock</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))] sm:text-base">Enregistrement des réceptions et approvisionnements.</p></header>{canCreate && <button onClick={open} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-white shadow-sm hover:opacity-90"><Plus size={18} />Nouvelle entrée</button>}<Panel title="Historique des entrées"><div className="relative mb-5 max-w-xl"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={18} /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher par article, fournisseur..." className="w-full rounded-lg border bg-transparent py-3 pl-10 pr-3 text-base" /></div>{pageData.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-y bg-[hsl(var(--muted)/.45)] text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr>{['Date', 'Article', 'Quantité', 'Fournisseur'].map(header => <th key={header} className="px-3 py-3">{header}</th>)}</tr></thead><tbody className="divide-y">{pageData.items.map(entry => { const product = data.products.find(item => item.id === entry.productId); const supplier = data.suppliers.find(item => item.id === entry.supplierId) ?? data.suppliers.find(item => item.id === product?.supplierId); const date = new Date(entry.movementDate); return <tr key={entry.id} className="hover:bg-[hsl(var(--muted)/.3)]"><td className="whitespace-nowrap px-3 py-4 text-[hsl(var(--muted-foreground))]"><span className="block">{date.toLocaleDateString('fr-FR')}</span><span className="block">{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span></td><td className="px-3 py-4"><strong className="block">{product?.name ?? 'Article supprimé'}</strong><small className="text-xs text-[hsl(var(--muted-foreground))]">{product?.sku ?? '—'}</small></td><td className="px-3 py-4"><strong className="text-[hsl(var(--primary))]">+{entry.quantity}</strong><small className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">{product?.unit ?? 'unité'}</small></td><td className="px-3 py-4 font-medium">{supplier?.name ?? 'Fournisseur non renseigné'}</td></tr>; })}</tbody></table></div> : <Empty text="Aucune entrée de stock enregistrée." />}<Pager page={page} pages={pageData.pages} setPage={setPage} total={entries.length} /></Panel>{modal && <Modal title="Nouvelle entrée de stock" onClose={() => setModal(false)}><div className="mb-6 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.14)] text-[hsl(var(--primary))]"><ArrowDownToLine size={24} /></div><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">Enregistrez une réception ou un approvisionnement.</p></div><p className="mb-4 text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Article concerné</p><Select label="Article *" value={form.productId} onChange={value => { const product = data.products.find(item => item.id === value); setForm(current => ({ ...current, productId: value, supplierId: product?.supplierId ?? '' })); }} options={[['', activeProducts.length ? "Sélectionner l'article" : 'Aucun article actif'], ...activeProducts.map(product => [product.id, product.name])]} help={activeProducts.length ? 'Sélectionnez l’article à recevoir.' : 'Aucun article actif. Ajoutez d’abord un article dans Articles.'} /><div className="my-6 border-t" /><p className="mb-4 text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Réception</p><div className="grid gap-4 sm:grid-cols-2"><Input label="Quantité reçue *" type="number" value={String(form.quantity)} onChange={value => setForm(current => ({ ...current, quantity: Number(value) }))} /><Select label="Fournisseur *" value={form.supplierId} onChange={value => setForm(current => ({ ...current, supplierId: value }))} options={[['', 'Sélectionner'], ...data.suppliers.filter(supplier => !supplier.archived).map(supplier => [supplier.id, supplier.name])]} /></div><label className="mt-4 block text-xs font-bold">Observation<textarea value={form.comment} onChange={event => setForm(current => ({ ...current, comment: event.target.value }))} placeholder="Remarques éventuelles..." rows={4} className="mt-2 w-full resize-none rounded-lg border bg-transparent px-3 py-2.5 text-sm font-normal" /></label>{!canSubmit && <p className="mt-4 rounded-lg border border-[hsl(var(--accent)/.4)] bg-[hsl(var(--accent)/.12)] px-3 py-2 text-xs leading-5 text-[hsl(var(--accent-foreground))]" role="status">{!form.productId ? (activeProducts.length ? 'Sélectionnez un article pour activer l’enregistrement.' : 'Aucun article actif. Ajoutez d’abord un article dans Articles.') : !form.supplierId ? 'Sélectionnez un fournisseur pour activer l’enregistrement.' : 'Saisissez une quantité supérieure ou égale à 1 pour activer l’enregistrement.'}</p>}<div className="mt-6 flex justify-end gap-3"><Button onClick={() => setModal(false)}>Annuler</Button><Button primary disabled={!canCreate || !canSubmit} onClick={submit}>Enregistrer l’entrée</Button></div></Modal>}</div>;
}

function MovementsPanel({ data, run }: { data: StockBootstrap; run: (action: () => Promise<unknown>, success: string) => Promise<void> }) {
  const { confirm } = useAppDialog();
  const stockApi = useStockApi();
  const { canCreate } = useStockAccess();
  const [modal, setModal] = useState(false); const [type, setType] = useState<StockMovementInputType>('ENTRÉE'); const [query, setQuery] = useState(''); const [page, setPage] = useState(1); const [form, setForm] = useState({ productId: data.products.find(product => !product.archived)?.id ?? '', warehouseId: data.warehouses.find(warehouse => !warehouse.archived)?.id ?? '', destinationWarehouseId: '', quantity: 1, reason: '', movementDate: new Date().toISOString().slice(0, 10), userName: 'Utilisateur connecté', reference: '', comment: '' });
  const filtered = data.movements.filter(movement => `${movement.type} ${movement.reference} ${movement.reason} ${movement.userName}`.toLowerCase().includes(query.toLowerCase())); const pageData = paginate(filtered, page);
  const open = (nextType: StockMovementInputType) => { if (!canCreate) return; setType(nextType); setForm(current => ({ ...current, destinationWarehouseId: '', reason: '', quantity: 1 })); setModal(true); };
  const submit = async () => { if (!canCreate || !form.productId || !form.warehouseId || !form.quantity || !form.reason) return; if ((movementOut.has(type) || type === 'TRANSFERT') && !await confirm({ title: 'Confirmer cette opération ?', description: 'Cette opération sensible mettra à jour le stock et l’historique.', confirmLabel: 'Confirmer' })) return; void run(() => stockApi.createMovement({ ...form, type, destinationWarehouseId: type === 'TRANSFERT' ? form.destinationWarehouseId : null, movementDate: new Date(form.movementDate).toISOString() }), type === 'TRANSFERT' ? 'Transfert validé.' : 'Mouvement validé.').then(() => setModal(false)); };
  return <div className="space-y-5"><Panel title="Opérations de stock" action={<div className="flex flex-wrap gap-2">{(['ENTRÉE', 'SORTIE', 'TRANSFERT', 'AJUSTEMENT+', 'AJUSTEMENT-', 'PERTE'] as StockMovementInputType[]).map(action => <button key={action} onClick={() => open(action)} className="rounded-lg border px-2.5 py-2 text-[10px] font-bold hover:bg-[hsl(var(--muted))]"><Plus size={12} className="mr-1 inline" />{action}</button>)}</div>}><p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">Chaque validation met à jour le stock de l’entrepôt concerné et crée une trace d’audit.</p><div className="mb-4 relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={15} /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher un mouvement..." className="w-full rounded-lg border bg-transparent py-2.5 pl-9 pr-3 text-sm" /></div><MovementTable data={data} movements={pageData.items} detailed /><Pager page={page} pages={pageData.pages} setPage={setPage} total={filtered.length} /></Panel>{modal && <MovementModal data={data} type={type} form={form} setForm={setForm} onClose={() => setModal(false)} onSave={submit} />}</div>;
}

function InventoryPanel({ data, run }: { data: StockBootstrap; run: (action: () => Promise<unknown>, success: string) => Promise<void> }) {
  const { confirm } = useAppDialog();
  const stockApi = useStockApi();
  const { canCreate, canModify } = useStockAccess();
  const [warehouseId, setWarehouseId] = useState(data.warehouses.find(warehouse => !warehouse.archived)?.id ?? '');
  const [actuals, setActuals] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const products = data.products.filter(product => !product.archived);
  const theoretical = (productId: string) => data.balances
    .filter(balance => balance.productId === productId && balance.warehouseId === warehouseId)
    .reduce((sum, balance) => sum + balance.quantity, 0);

  const create = async () => {
    if (!canCreate || !warehouseId) return;
    if (!await confirm({
      title: 'Créer cet inventaire ?',
      description: 'Les quantités saisies seront enregistrées pour cet entrepôt.',
      confirmLabel: 'Créer',
    })) return;

    void run(
      () => stockApi.createInventory({
        warehouseId,
        notes,
        createdBy: 'Utilisateur connecté',
        lines: products.map(product => ({
          productId: product.id,
          actualQuantity: actuals[product.id] ?? theoretical(product.id),
        })),
      }),
      'Inventaire créé.',
    );
  };

  const validate = async (inventoryId: string) => {
    if (!canModify) return;
    if (!await confirm({
      title: 'Valider cet inventaire ?',
      description: 'Les écarts seront appliqués automatiquement au stock.',
      confirmLabel: 'Valider',
    })) return;

    void run(
      () => stockApi.validateInventory(inventoryId),
      'Inventaire validé, écarts appliqués.',
    );
  };

  return (
    <div className="space-y-5">
      <Panel
        title="Créer un inventaire"
        action={canCreate ? (
          <Button primary required="create" onClick={create}>
            <ClipboardCheck size={15} />Créer l’inventaire
          </Button>
        ) : undefined}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Entrepôt à compter"
            value={warehouseId}
            onChange={setWarehouseId}
            options={data.warehouses
              .filter(warehouse => !warehouse.archived)
              .map(warehouse => [warehouse.id, warehouse.name])}
          />
          <Input
            label="Notes"
            value={notes}
            onChange={setNotes}
            placeholder="Équipe, zone ou consigne..."
          />
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-[hsl(var(--muted)/.55)] text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3">Stock théorique</th>
                <th className="px-4 py-3">Stock réel</th>
                <th className="px-4 py-3">Écart</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map(product => {
                const theory = theoretical(product.id);
                const actual = actuals[product.id] ?? theory;
                return (
                  <tr key={product.id}>
                    <td className="px-4 py-3 font-bold">{product.name}</td>
                    <td className="px-4 py-3">{theory}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        value={actual}
                        disabled={!canCreate}
                        onChange={event => setActuals(current => ({
                          ...current,
                          [product.id]: Number(event.target.value),
                        }))}
                        className="w-28 rounded-lg border bg-transparent px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </td>
                    <td className={`px-4 py-3 font-bold ${actual - theory === 0 ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--accent-foreground))]'}`}>
                      {actual - theory > 0 ? '+' : ''}{actual - theory}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Historique des inventaires">
        <DataTable
          headers={['Référence', 'Entrepôt', 'Date', 'Statut', 'Notes', 'Action']}
          rows={data.inventories.map(inventory => [
            inventory.id.slice(-12),
            data.warehouses.find(warehouse => warehouse.id === inventory.warehouseId)?.name ?? '—',
            dateLabel(inventory.inventoryDate),
            <StatusPill value={inventory.status} />,
            inventory.notes || '—',
            inventory.status === 'VALIDÉ'
              ? <Check size={16} className="text-[hsl(var(--primary))]" />
              : canModify
                ? (
                  <button
                    onClick={() => void validate(inventory.id)}
                    className="rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-[10px] font-bold text-white"
                  >
                    Valider
                  </button>
                )
                : '—',
          ])}
        />
      </Panel>
    </div>
  );
}

function SuppliersPanel({ data, run }: { data: StockBootstrap; run: (action: () => Promise<unknown>, success: string) => Promise<void> }) {
  const { confirm } = useAppDialog();
  const stockApi = useStockApi();
  const { canCreate, canModify } = useStockAccess();
  const [modal, setModal] = useState<StockSupplier | 'new' | null>(null);
  const [selected, setSelected] = useState<StockSupplier | null>(null);
  const selectedProducts = selected ? data.products.filter(product => product.supplierId === selected.id) : [];
  const archiveSupplier = async (supplier: StockSupplier) => {
    if (!canModify) return;
    if (!await confirm({ title: 'Archiver ce fournisseur ?', description: `Le fournisseur ${supplier.name} sera archivé.`, confirmLabel: 'Archiver' })) return;
    void run(() => stockApi.archiveSupplier(supplier.id), 'Fournisseur archivé.').then(() => {
    if (selected?.id === supplier.id) setSelected(null);
    });
  };
  const openSupplier = (supplier: StockSupplier | 'new') => {
    if (supplier === 'new' ? !canCreate : !canModify) return;
    setModal(supplier);
  };
  const saveSupplier = (body: SupplierForm) => {
    if (!modal || (modal === 'new' ? !canCreate : !canModify)) return;
    void run(() => modal === 'new' ? stockApi.createSupplier(body) : stockApi.updateSupplier(modal.id, body), modal === 'new' ? 'Fournisseur créé.' : 'Fournisseur modifié.').then(() => setModal(null));
  };
  return <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
    <Panel title="Fournisseurs" action={canCreate ? <button onClick={() => openSupplier('new')} className="rounded-lg bg-[hsl(var(--primary))] px-3 py-2.5 text-xs font-bold text-white"><Plus size={14} className="mr-1 inline" />Ajouter</button> : undefined}>
      <div className="space-y-2">
        {data.suppliers.filter(supplier => !supplier.archived).map(supplier => <div key={supplier.id} className={`rounded-xl border p-4 ${selected?.id === supplier.id ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.05)]' : ''}`}>
          <div className="flex items-start gap-3">
            <button aria-label={`Voir les produits de ${supplier.name}`} aria-pressed={selected?.id === supplier.id} onClick={() => setSelected(supplier)} className="min-w-0 flex-1 text-left">
              <strong className="block truncate">{supplier.name}</strong>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{supplier.contactName || 'Contact non défini'} · {supplier.phone || 'Téléphone non défini'}</p>
            </button>
            <div className="flex shrink-0 flex-wrap gap-1">
              {canModify && <button aria-label={`Modifier ${supplier.name}`} title="Modifier le fournisseur" onClick={() => openSupplier(supplier)} className="inline-flex items-center gap-1 rounded border px-2 py-1.5 text-[10px] font-bold hover:bg-[hsl(var(--muted))]"><Edit3 size={13} /><span>Modifier</span></button>}
              {canModify && <button aria-label={`Archiver ${supplier.name}`} title="Archiver le fournisseur" onClick={() => archiveSupplier(supplier)} className="inline-flex items-center gap-1 rounded border px-2 py-1.5 text-[10px] font-bold text-[hsl(var(--destructive))] hover:bg-[hsl(var(--muted))]"><Trash2 size={13} /><span>Archiver</span></button>}
            </div>
          </div>
        </div>)}
        {data.suppliers.filter(supplier => !supplier.archived).length === 0 && <Empty text="Aucun fournisseur actif." />}
      </div>
    </Panel>
    <Panel title={selected ? selected.name : 'Produits fournis'}>
      {selected ? <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Articles fournis" value={String(selectedProducts.length)} detail="références liées" icon={Package} /><Metric label="Réceptions" value={String(data.movements.filter(movement => selectedProducts.some(product => product.id === movement.productId) && movement.type === 'ENTRÉE').length)} detail="historique enregistré" icon={ArrowDownToLine} /><Metric label="Dernière activité" value={selectedProducts.length && data.movements.some(movement => selectedProducts.some(product => product.id === movement.productId)) ? 'Active' : 'Aucune'} detail="sur les réceptions et approvisionnements" icon={History} /></div><DataTable headers={['Article', 'Référence', 'Réceptions']} rows={selectedProducts.map(product => [product.name, product.sku, data.movements.filter(movement => movement.productId === product.id && movement.type === 'ENTRÉE').length])} /></div> : <Empty text="Sélectionnez un fournisseur pour voir les articles et leurs réceptions." />}
    </Panel>
    {modal && <SupplierModal value={modal === 'new' ? blankSupplier : modal} onClose={() => setModal(null)} onSave={saveSupplier} />}
  </div>;
}

function ReportsPanel({ data }: { data: StockBootstrap }) {
  const [productId, setProductId] = useState('Tous'); const [warehouseId, setWarehouseId] = useState('Tous'); const [category, setCategory] = useState('Toutes'); const [query, setQuery] = useState(''); const [type, setType] = useState('Mouvements'); const [page, setPage] = useState(1);
  const productMap = new Map(data.products.map(product => [product.id, product])); const warehouseMap = new Map(data.warehouses.map(warehouse => [warehouse.id, warehouse])); const movements = data.movements.filter(movement => productId === 'Tous' || movement.productId === productId).filter(movement => warehouseId === 'Tous' || movement.warehouseId === warehouseId).filter(movement => !query || `${movement.reference} ${movement.reason} ${movement.comment}`.toLowerCase().includes(query.toLowerCase())).filter(movement => category === 'Toutes' || productMap.get(movement.productId)?.category === category); const reportRows = type === 'Produits sous seuil' ? data.products.filter(product => !product.archived && data.balances.filter(balance => balance.productId === product.id).reduce((sum, balance) => sum + balance.quantity, 0) <= product.minStock).map(product => [product.name, product.sku, product.category, data.balances.filter(balance => balance.productId === product.id).reduce((sum, balance) => sum + balance.quantity, 0), product.minStock]) : type === 'Stock par entrepôt' ? data.warehouses.filter(warehouse => !warehouse.archived).map(warehouse => [warehouse.name, warehouse.manager || '—', data.balances.filter(balance => balance.warehouseId === warehouse.id).reduce((sum, balance) => sum + balance.quantity, 0)]) : movements.map(movement => [dateLabel(movement.movementDate), movement.type, productMap.get(movement.productId)?.name ?? movement.productId, warehouseMap.get(movement.warehouseId)?.name ?? '—', movement.quantity, movement.reference || '—', movement.userName]); const pageData = paginate(reportRows, page); const exportCsv = () => { const rows = reportRows.map(row => row.map(cell => String(cell).replace(/"/g, '""')).map(cell => `"${cell}"`).join(';')); const blob = new Blob([rows.join('\\n')], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `rapport-stock-${type.toLowerCase().replace(/\\s+/g, '-')}.csv`; link.click(); URL.revokeObjectURL(url); };
  return <div className="space-y-5"><Panel title="Rapports de stock" action={<button onClick={exportCsv} className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold"><Download size={15} />Exporter CSV</button>}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><Select label="Rapport" value={type} onChange={value => { setType(value); setPage(1); }} options={['Mouvements', 'Produits sous seuil', 'Stock par entrepôt'].map(value => [value, value])} /><Select label="Article" value={productId} onChange={setProductId} options={[['Tous', 'Tous les articles'], ...data.products.map(product => [product.id, product.name])]} /><Select label="Entrepôt" value={warehouseId} onChange={setWarehouseId} options={[['Tous', 'Tous les entrepôts'], ...data.warehouses.map(warehouse => [warehouse.id, warehouse.name])]} /><Select label="Catégorie" value={category} onChange={setCategory} options={[['Toutes', 'Toutes les catégories'], ...new Set(data.products.map(product => product.category))].map(value => Array.isArray(value) ? value : [value, value]) as [string, string][]} /><div><label className="text-xs font-bold">Recherche<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Référence, motif..." className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm" /></label></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[hsl(var(--muted)/.55)] text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr>{(type === 'Produits sous seuil' ? ['Article', 'Référence', 'Catégorie', 'Stock', 'Minimum'] : type === 'Stock par entrepôt' ? ['Entrepôt', 'Responsable', 'Articles en stock'] : ['Date', 'Type', 'Article', 'Entrepôt', 'Quantité', 'Référence', 'Utilisateur']).map(header => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y">{pageData.items.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody></table></div><Pager page={page} pages={pageData.pages} setPage={setPage} total={reportRows.length} /></Panel></div>;
}

function RequestModal({ value, data, onClose, onChange, onSave }: { value: StockRequest | { productId: string; warehouseId: string; quantity: number; reason: string }; data: StockBootstrap; onClose: () => void; onChange: (form: { productId: string; warehouseId: string; quantity: number; reason: string }) => void; onSave: () => void }) {
  return <Modal title={'id' in value ? 'Modifier la demande de réapprovisionnement' : 'Nouvelle demande de réapprovisionnement'} onClose={onClose}><Select label="Article" value={value.productId} onChange={productId => onChange({ ...value, productId })} options={data.products.filter(product => !product.archived).map(product => [product.id, `${product.name} (${product.sku})`])} /><Select label="Entrepôt" value={value.warehouseId} onChange={warehouseId => onChange({ ...value, warehouseId })} options={data.warehouses.filter(warehouse => !warehouse.archived).map(warehouse => [warehouse.id, warehouse.name])} /><Input label="Quantité demandée" type="number" value={String(value.quantity)} onChange={quantity => onChange({ ...value, quantity: Number(quantity) })} /><Input label="Motif" value={value.reason} onChange={reason => onChange({ ...value, reason })} placeholder="Seuil atteint, commande client..." /><div className="mt-6 flex justify-end"><Button primary required={'id' in value ? 'modify' : 'create'} disabled={!value.productId || !value.warehouseId || value.quantity < 1 || !value.reason.trim()} onClick={onSave}>{'id' in value ? 'Enregistrer les modifications' : 'Enregistrer la demande'}</Button></div></Modal>;
}

function ProductModal({ value, categories, suppliers, onClose, onSave }: { value: ProductForm | StockProduct; categories: StockCategory[]; suppliers: StockSupplier[]; onClose: () => void; onSave: (body: ProductForm) => void }) {
  const { canCreate, canModify } = useStockAccess();
  const [form, setForm] = useState<ProductForm>({ ...blankProduct, ...value });
  const update = (key: keyof ProductForm, nextValue: string | number | null) => setForm(current => ({ ...current, [key]: nextValue }));

  const save = () => {
    if ('id' in value ? !canModify : !canCreate) return;
    onSave(form);
  };

  return <Modal large title={'id' in value ? 'Modifier le produit' : 'Ajouter un produit'} onClose={onClose}>
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label="Nom du produit" value={form.name} onChange={value => update('name', value)} />
      <Input label="SKU / référence" value={form.sku} onChange={value => update('sku', value)} />
      <Select label="Catégorie" value={form.category} onChange={value => update('category', value)} options={categories.map(category => [category.name, category.name])} />
      <Input label="Stock minimum" type="number" value={String(form.minStock)} onChange={value => update('minStock', Number(value))} />
      <Input label="Stock maximum" type="number" value={String(form.maxStock)} onChange={value => update('maxStock', Number(value))} />
    </div>
    <Select label="Fournisseur" value={form.supplierId ?? ''} onChange={value => update('supplierId', value || null)} options={[['', 'Aucun fournisseur'], ...suppliers.filter(supplier => !supplier.archived).map(supplier => [supplier.id, supplier.name])]} />
    <label className="mt-4 block text-xs font-bold">Description<textarea value={form.description} onChange={event => update('description', event.target.value)} rows={3} className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm" /></label>
    <div className="mt-6 flex justify-end"><Button primary required={'id' in value ? 'modify' : 'create'} disabled={!form.name || !form.sku || !form.category} onClick={save}>Enregistrer</Button></div>
  </Modal>;
}

 function WarehouseModal({ value, onClose, onSave }: { value: WarehouseForm | StockWarehouse; onClose: () => void; onSave: (body: WarehouseForm) => void }) { const { canCreate, canModify } = useStockAccess(); const [form, setForm] = useState<WarehouseForm>({ ...blankWarehouse, ...value }); const save = () => { if ('id' in value ? !canModify : !canCreate) return; onSave(form); }; return <Modal title={'id' in value ? 'Modifier l’entrepôt' : 'Ajouter un entrepôt'} onClose={onClose}><div className="space-y-4"><Input label="Nom" value={form.name} onChange={value => setForm({ ...form, name: value })} /><Input label="Responsable" value={form.manager} onChange={value => setForm({ ...form, manager: value })} /><Input label="Adresse" value={form.address} onChange={value => setForm({ ...form, address: value })} /></div><div className="mt-6 flex justify-end"><Button primary required={'id' in value ? 'modify' : 'create'} disabled={!form.name} onClick={save}>Enregistrer</Button></div></Modal>; }
 function SupplierModal({ value, onClose, onSave }: { value: SupplierForm | StockSupplier; onClose: () => void; onSave: (body: SupplierForm) => void }) { const { canCreate, canModify } = useStockAccess(); const [form, setForm] = useState<SupplierForm>({ ...blankSupplier, ...value }); const save = () => { if ('id' in value ? !canModify : !canCreate) return; onSave(form); }; return <Modal title={'id' in value ? 'Modifier le fournisseur' : 'Ajouter un fournisseur'} onClose={onClose}><div className="grid gap-4 sm:grid-cols-2"><Input label="Nom" value={form.name} onChange={value => setForm({ ...form, name: value })} /><Input label="Contact" value={form.contactName} onChange={value => setForm({ ...form, contactName: value })} /><Input label="Email" value={form.email} onChange={value => setForm({ ...form, email: value })} /><Input label="Téléphone" value={form.phone} onChange={value => setForm({ ...form, phone: value })} /><Input label="Adresse" value={form.address} onChange={value => setForm({ ...form, address: value })} /></div><label className="mt-4 block text-xs font-bold">Notes<textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} rows={3} className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm" /></label><div className="mt-6 flex justify-end"><Button primary required={'id' in value ? 'modify' : 'create'} disabled={!form.name} onClick={save}>Enregistrer</Button></div></Modal>; }
function MovementModal({ data, type, form, setForm, onClose, onSave }: { data: StockBootstrap; type: StockMovementInputType; form: MovementForm; setForm: (form: MovementForm) => void; onClose: () => void; onSave: () => void }) {
  const update = (key: keyof MovementForm, value: string | number) => setForm({ ...form, [key]: value });
  return <Modal title={`${type} — mouvement de stock`} onClose={onClose}>
    <div className="grid gap-4 sm:grid-cols-2">
      <Select label="Article" value={form.productId} onChange={value => update('productId', value)} options={data.products.filter(product => !product.archived).map(product => [product.id, `${product.name} (${product.sku})`])} />
      <Select label="Entrepôt source" value={form.warehouseId} onChange={value => update('warehouseId', value)} options={data.warehouses.filter(warehouse => !warehouse.archived).map(warehouse => [warehouse.id, warehouse.name])} />
      {type === 'TRANSFERT' && <Select label="Entrepôt destination" value={form.destinationWarehouseId} onChange={value => update('destinationWarehouseId', value)} options={data.warehouses.filter(warehouse => !warehouse.archived && warehouse.id !== form.warehouseId).map(warehouse => [warehouse.id, warehouse.name])} />}
      <Input label="Quantité d’articles" type="number" value={String(form.quantity)} onChange={value => update('quantity', Number(value))} />
      <Input label="Date" type="date" value={form.movementDate} onChange={value => update('movementDate', value)} />
      <Input label="Référence / document" value={form.reference} onChange={value => update('reference', value)} />
      <Input label="Motif" value={form.reason} onChange={value => update('reason', value)} />
    </div>
    <label className="mt-4 block text-xs font-bold">Commentaire<textarea value={form.comment} onChange={event => update('comment', event.target.value)} rows={3} className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm" /></label>
    <p className="mt-4 rounded-lg bg-[hsl(var(--muted))] p-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{movementOut.has(type) ? 'Cette opération diminuera le stock. Le stock négatif est interdit.' : type === 'TRANSFERT' ? 'Le stock sera retiré de la source puis ajouté à la destination.' : 'Cette opération augmentera le stock de l’entrepôt sélectionné.'}</p>
    <div className="mt-6 flex justify-end"><Button primary disabled={!form.productId || !form.warehouseId || !form.reason || !form.quantity || (type === 'TRANSFERT' && !form.destinationWarehouseId)} onClick={onSave}>Valider l’opération</Button></div>
  </Modal>;
}

function HistoryModal({ product, data, onClose }: { product: StockProduct; data: StockBootstrap; onClose: () => void }) { const movements = data.movements.filter(movement => movement.productId === product.id); return <Modal title={`Historique — ${product.name}`} onClose={onClose}><div className="space-y-3">{movements.length === 0 && <Empty text="Aucun mouvement enregistré pour cet article." />}{movements.map(movement => <div key={movement.id} className="flex items-start justify-between gap-3 border-b pb-3 text-sm"><div><p className="font-bold">{movement.type} · {movement.quantity} article(s)</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{movement.reason || 'Sans motif'} · {movement.userName}</p></div><span className="text-right text-xs text-[hsl(var(--muted-foreground))]">{dateLabel(movement.movementDate)}<br />{movement.reference}</span></div>)}</div></Modal>; }

function MovementTable({ data, movements, detailed = false }: { data: StockBootstrap; movements: StockMovement[]; detailed?: boolean }) { return <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[hsl(var(--muted)/.55)] text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr>{(detailed ? ['Date', 'Type', 'Produit', 'Entrepôt', 'Quantité', 'Motif', 'Utilisateur'] : ['Type', 'Produit', 'Entrepôt', 'Quantité', 'Date']).map(header => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y">{movements.map(movement => <tr key={movement.id}><td className="px-4 py-3">{detailed ? dateLabel(movement.movementDate) : <StatusPill value={movement.type} />}</td>{detailed && <td className="px-4 py-3"><StatusPill value={movement.type} /></td>}<td className="px-4 py-3 font-bold">{data.products.find(product => product.id === movement.productId)?.name ?? 'Produit supprimé'}</td><td className="px-4 py-3 text-xs">{data.warehouses.find(warehouse => warehouse.id === movement.warehouseId)?.name ?? '—'}</td><td className={`px-4 py-3 font-bold ${movementOut.has(movement.type) ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--primary))]'}`}>{movementOut.has(movement.type) ? '-' : '+'}{movement.quantity}</td>{detailed ? <><td className="px-4 py-3 text-xs">{movement.reason || '—'}</td><td className="px-4 py-3 text-xs">{movement.userName}</td></> : <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">{dateLabel(movement.movementDate)}</td>}</tr>)}</tbody></table></div>; }

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) { return <div className="table-scroll"><table className="data-table w-full min-w-[680px] text-left text-sm"><thead className="bg-[hsl(var(--muted)/.55)] text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr>{headers.map(header => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row, index) => <tr key={index} className="hover:bg-[hsl(var(--muted)/.35)]">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody></table></div>; }
function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) { return <section className="surface-panel card-surface overflow-hidden rounded-2xl p-5 sm:p-6"><div className="section-heading mb-5"><h2 className="font-bold">{title}</h2>{action}</div>{children}</section>; }
function Metric({ label, value, detail, icon: Icon, accent = false, warning = false }: { label: string; value: string; detail: string; icon: ComponentType<{ size?: number }>; accent?: boolean; warning?: boolean }) { return <div className={`metric-card card-surface rounded-2xl p-5 ${accent ? 'border-[hsl(var(--primary)/.25)]' : ''}`}><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${warning ? 'bg-[hsl(var(--accent)/.2)]' : accent ? 'bg-[hsl(var(--primary)/.11)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}><Icon size={17} /></span><p className="mt-5 text-xs text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-1 text-2xl font-bold tracking-[-.05em]">{value}</p><p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">{detail}</p></div>; }
function StatusPill({ value }: { value: string }) { return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${value === 'VALIDÉ' || value === 'ENTRÉE' || value === 'AJUSTEMENT+' ? 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : value === 'PERTE' || value === 'SORTIE' || value === 'AJUSTEMENT-' ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--accent)/.2)] text-[hsl(var(--foreground))]'}`}>{value}</span>; }
function Input({ label, value, onChange, type = 'text', placeholder = '', help }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; help?: string }) { const explanation = help ?? `Saisissez ${label.toLowerCase()} pour cette opération.`; return <label className="block text-xs font-bold">{label}<input type={type} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm font-normal" /><span className="mt-1 block text-[10px] font-normal leading-4 text-[hsl(var(--muted-foreground))]">{explanation}</span></label>; }
function Select({ label, value, onChange, options, help }: { label: string; value: string; onChange: (value: string) => void; options: string[][]; help?: string }) { const explanation = help ?? `Sélectionnez ${label.toLowerCase()} concerné.`; return <label className="mt-4 block text-xs font-bold">{label}<select value={value} onChange={event => onChange(event.target.value)} className="mt-2 w-full rounded-lg border bg-[hsl(var(--card))] px-3 py-2.5 text-sm font-normal">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select><span className="mt-1 block text-[10px] font-normal leading-4 text-[hsl(var(--muted-foreground))]">{explanation}</span></label>; }
function Button({ children, onClick, primary = false, disabled = false, required = primary ? 'create' : 'none' }: { children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean; required?: 'none' | 'create' | 'modify' }) {
  const { canCreate, canModify } = useStockAccess();
  const denied = (required === 'create' && !canCreate) || (required === 'modify' && !canModify);
  const guardedClick = () => { if (denied) return; onClick(); };
  return <button type="button" data-stock-write="true" disabled={disabled || denied} onClick={guardedClick} className={`app-action inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${primary ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]'}`}>{children}</button>;
}
function Modal({ title, onClose, children, large = false }: { title: string; onClose: () => void; children: ReactNode; large?: boolean }) { return <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--foreground)/.35)] p-4 backdrop-blur-sm"><div className={`modal-panel card-surface w-full rounded-2xl p-6 ${large ? 'max-h-[92vh] max-w-5xl overflow-y-auto sm:p-8' : 'max-w-4xl'}`}><div className="modal-header mb-6 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]"><X size={18} /></button></div><div className="modal-body">{children}</div></div></div>; }
function Empty({ text }: { text: string }) { return <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">{text}</div>; }
function Pager({ page, pages, setPage, total }: { page: number; pages: number; setPage: (page: number) => void; total: number }) { return <div className="mt-4 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]"><span>{total} élément{total > 1 ? 's' : ''}</span>{pages > 1 && <div className="flex items-center gap-2"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded border p-1.5 disabled:opacity-40"><ChevronLeft size={14} /></button><span>Page {page} / {pages}</span><button disabled={page === pages} onClick={() => setPage(page + 1)} className="rounded border p-1.5 disabled:opacity-40"><ChevronRight size={14} /></button></div>}</div>; }
function paginate<T>(items: T[], page: number, size = 8) { const pages = Math.max(1, Math.ceil(items.length / size)); const safePage = Math.min(page, pages); return { items: items.slice((safePage - 1) * size, safePage * size), pages }; }