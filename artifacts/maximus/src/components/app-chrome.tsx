import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  Bell,
  CircleHelp,
  ChevronDown,
  ChevronRight,
  LogIn,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@workspace/maximus-design-system/components/ui/button';
import { Input } from '@workspace/maximus-design-system/components/ui/input';
import type { ModuleId, StoreData } from '@/lib/store';
import { SidebarSectionLabel } from '@/components/sidebar-section-label';
import { companyWorkspaceFeatureForPath, type CompanyWorkspaceFeatureId } from '@/lib/company-workspace-features';
import {
  buildModuleEntries,
  isModuleEntryActive,
  type CompanyNavigationMode,
} from '@/lib/company-navigation';
import {
  adminNav,
  companyNav,
  type Icon,
  type Session,
  type SidebarFeature,
  type SidebarFeatureGroup,
  adminNavGroups,
  getMostSpecificNavigationHref,
} from '@/lib/navigation';

type SidebarProps = {
  session: Session;
  location: string;
  allowed: ModuleId[];
  sidebarFeatureGroups?: SidebarFeatureGroup[];
  canManagePeople: boolean;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  employee: StoreData['employees'][number] | null;
  companyName?: string;
  companyPhoto?: string;
  adminLogo?: string;
  mobileOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeNavStyle?: CSSProperties;
  hiddenWorkspaceFeatures?: CompanyWorkspaceFeatureId[];
  navigationMode?: CompanyNavigationMode;
};

export function Sidebar({
  session,
  location,
  allowed,
  sidebarFeatureGroups,
  canManagePeople,
  onNavigate,
  onLogout,
  employee,
  companyName,
  companyPhoto,
  adminLogo,
  mobileOpen,
  onClose,
  collapsed,
  onToggleCollapse,
  activeNavStyle,
  hiddenWorkspaceFeatures = [],
  navigationMode = 'menu',
}: SidebarProps) {
  const isAdmin = session === 'admin';
  const companyAdmin = session.startsWith('company:');
  const hiddenWorkspaceFeatureSet = new Set(hiddenWorkspaceFeatures);
  const nav = isAdmin
    ? adminNav
    : companyNav.filter(
        item =>
          (!item.peopleAdminOnly || companyAdmin || canManagePeople) &&
          (item.module === null || allowed.includes(item.module as ModuleId)) &&
          !hiddenWorkspaceFeatureSet.has(companyWorkspaceFeatureForPath(item.href) as CompanyWorkspaceFeatureId),
      );
  const companyCoreItems = nav.filter(item => item.module === null);
  const companyModuleItems = nav.filter(item => item.module !== null);
  const verticalModuleMenu = Boolean(
    !isAdmin && allowed.length >= 1 && sidebarFeatureGroups?.length,
  );
  const compact = collapsed && !mobileOpen;
  const fullGroups = isAdmin ? adminNavGroups : (sidebarFeatureGroups ?? []);
  const horizontalMode = !isAdmin && verticalModuleMenu && navigationMode === 'horizontal';
  const activeHref = getMostSpecificNavigationHref(location, [
    ...nav.map(item => item.href),
    ...fullGroups.flatMap(group => group.items.map(item => item.href)),
  ]);
  const moduleEntries = horizontalMode ? buildModuleEntries(fullGroups) : [];
  const moduleEntryByHref = new Map(moduleEntries.map(entry => [entry.href, entry]));
  // Horizontal mode: the sidebar lists module names only (one entry per permitted group).
  const navigationGroups: SidebarFeatureGroup[] = horizontalMode
    ? [{ label: 'Modules', items: moduleEntries.map(entry => ({ href: entry.href, label: entry.label, icon: entry.icon })) }]
    : fullGroups;
  const active = (href: string) => {
    const entry = moduleEntryByHref.get(href);
    return entry ? isModuleEntryActive(entry, activeHref) : href === activeHref;
  };
  const activeCompanyModule = companyModuleItems.some(item => item.href === activeHref);
  const activeFeatureGroupLabel =
    navigationGroups.find(group => group.items.some(item => active(item.href)))?.label ?? '';
  const [expandedMobileGroups, setExpandedMobileGroups] = useState<Record<string, boolean>>({});
  const [expandedMobileModules, setExpandedMobileModules] = useState(false);
  const companyModulesOpen = !mobileOpen || activeCompanyModule || expandedMobileModules;

  useEffect(() => {
    if (!mobileOpen) {
      setExpandedMobileGroups(current => (Object.keys(current).length ? {} : current));
      setExpandedMobileModules(false);
      return;
    }
    if (!activeFeatureGroupLabel) return;
    setExpandedMobileGroups(current => (
      current[activeFeatureGroupLabel]
        ? current
        : { ...current, [activeFeatureGroupLabel]: true }
    ));
  }, [activeFeatureGroupLabel, mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onClose]);

  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    if (activeCompanyModule) setExpandedMobileModules(true);
    const frame = window.requestAnimationFrame(() => {
      (activeLinkRef.current ?? mobileCloseButtonRef.current)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeCompanyModule, activeHref, mobileOpen]);

  const link = (item: SidebarFeature) => {
    const isActive = active(item.href);
    const className = `nav-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${compact ? 'justify-center' : ''} ${isActive ? 'active' : 'text-[hsl(var(--sidebar-foreground)/.7)]'}`;
    const content = (
      <>
        <item.icon size={17} strokeWidth={isActive ? 2.5 : 1.8} />
        {!compact && item.label}
      </>
    );
    const testId = `link-nav-${item.href.split('/').pop()?.split('?')[0]}`;

    return (
      <Link
        data-testid={testId}
        title={compact ? item.label : undefined}
        aria-current={isActive ? 'page' : undefined}
        ref={isActive ? activeLinkRef : undefined}
        onClick={event => {
          event.preventDefault();
          onNavigate(item.href);
          onClose();
        }}
        key={item.href}
        href={item.href}
        className={className}
        style={isActive ? activeNavStyle : undefined}
      >
        {content}
      </Link>
    );
  };
  const initials = employee
    ? `${employee.firstName[0]}${employee.lastName[0]}`
    : companyName
        ?.split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word[0])
        .join('')
        .toUpperCase() || 'KD';
  const singleModuleItems = nav.filter(
    item => 'module' in item && item.module === null,
  );
  const companyOverviewItems = singleModuleItems.filter(
    item => item.href === '/entreprise/dashboard',
  );
  const employeeAdministrationItems = singleModuleItems.filter(
    item => item.href !== '/entreprise/dashboard',
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Fermer le menu"
        aria-hidden="true"
        tabIndex={-1}
        data-testid="button-close-mobile-menu"
        onClick={onClose}
        className={`fixed inset-0 z-40 h-auto w-auto rounded-none bg-[hsl(var(--foreground)/.35)] p-0 backdrop-blur-sm md:hidden ${mobileOpen ? 'block' : 'hidden'}`}
      />
      <aside
        id="maximus-primary-navigation"
        aria-label={isAdmin ? 'Navigation MAXIMUS' : `Navigation ${companyName ?? 'entreprise'}`}
        data-collapsed={compact ? 'true' : 'false'}
        className={`sidebar min-h-0 shrink-0 flex-col overflow-hidden transition-[width] duration-200 md:relative md:flex md:h-[100dvh] ${compact ? 'md:w-20' : 'md:w-64'} ${mobileOpen ? 'fixed inset-y-0 left-0 z-50 flex w-72 shadow-2xl' : 'hidden'}`}
      >
        <div
          className={`sticky top-0 z-10 flex items-center border-b border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar)/.96)] backdrop-blur ${compact ? 'gap-1 px-2' : 'justify-between px-4'} py-4 md:border-b-0 md:bg-transparent md:py-6`}
        >
          {isAdmin ? (
            <div
              className={`flex min-w-0 items-center ${compact ? 'gap-1' : 'gap-3'}`}
            >
              <span
                className={`flex shrink-0 items-center justify-center overflow-hidden bg-[hsl(var(--accent)/.18)] font-bold text-[hsl(var(--accent))] ${compact ? 'h-8 w-8 rounded-lg text-[10px]' : 'h-12 w-12 rounded-xl text-sm'}`}
              >
                {adminLogo ? (
                  <img src={adminLogo} alt="Logo de l’administration MAXIMUS" className="h-full w-full object-cover" />
                ) : (
                  'MX'
                )}
              </span>
              {!compact && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">MAXIMUS</p>
                  <p className="mt-0.5 text-[10px] text-[hsl(var(--sidebar-foreground)/.55)]">
                    Centre de contrôle
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`flex min-w-0 items-center ${compact ? 'gap-1' : 'gap-3'}`}
            >
              <span
                className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[hsl(var(--accent)/.18)] font-bold text-[hsl(var(--accent))] ${compact ? 'h-8 w-8 rounded-lg text-[10px]' : 'h-12 w-12 rounded-xl text-sm'}`}
              >
                {companyPhoto ? (
                  <img
                    src={companyPhoto}
                    alt={`Logo de ${companyName ?? 'l’entreprise'}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </span>
              {!compact && (
                <div className="min-w-0">
                  <p
                    title={companyName ?? 'Entreprise'}
                    className="break-words text-sm font-bold leading-tight"
                  >
                    {companyName ?? 'Entreprise'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[hsl(var(--sidebar-foreground)/.55)]">
                    {employee ? employee.role : 'Espace entreprise'}
                  </p>
                </div>
              )}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={compact ? 'Déployer le menu' : 'Rétracter le menu'}
            title={compact ? 'Déployer le menu' : 'Rétracter le menu'}
            data-testid="button-toggle-sidebar"
            onClick={onToggleCollapse}
            className={`hidden rounded-lg text-[hsl(var(--sidebar-foreground)/.7)] hover:bg-[hsl(var(--sidebar-accent))] md:block ${compact ? 'p-1' : 'p-2'}`}
          >
            {compact ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={18} />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Fermer le menu"
            ref={mobileCloseButtonRef}
            data-testid="button-close-mobile-menu-inner"
            onClick={onClose}
            className="rounded-lg p-2 text-[hsl(var(--sidebar-foreground)/.7)] hover:bg-[hsl(var(--muted))] md:hidden"
          >
            <X size={18} />
          </Button>
        </div>
        <nav
          aria-label="Navigation principale"
          className={`${isAdmin ? 'flex-none' : 'min-h-0 flex-1'} space-y-1 overflow-hidden px-3 pb-4`}
        >
          {verticalModuleMenu || isAdmin ? (
            <>
              {verticalModuleMenu && companyOverviewItems.map(item => link(item))}
              {employeeAdministrationItems.length > 0 && (
                <>
                  {!compact && (
                    <SidebarSectionLabel>Administration</SidebarSectionLabel>
                  )}
                  <div className="space-y-1">
                    {employeeAdministrationItems.map(item => link(item))}
                  </div>
                </>
              )}
              {navigationGroups.map((group, groupIndex) => (
                (() => {
                  const groupIsActive = group.label === activeFeatureGroupLabel;
                  const hasManualMobileState = Object.prototype.hasOwnProperty.call(
                    expandedMobileGroups,
                    group.label,
                  );
                  const groupIsOpen = compact
                    || !mobileOpen
                    || groupIsActive
                    || expandedMobileGroups[group.label]
                    || (!activeFeatureGroupLabel && groupIndex === 0 && !hasManualMobileState);

                  return (
                    <section
                      key={group.label}
                      aria-label={group.label}
                      className={`${!compact && (groupIndex > 0 || employeeAdministrationItems.length > 0) ? 'mt-3 border-t border-[hsl(var(--sidebar-border))] pt-3' : ''}`}
                    >
                  {!compact && (
                    <Button
                      type="button"
                      variant="ghost"
                      data-testid={`module-section-${group.label}`}
                      aria-expanded={groupIsOpen}
                      onClick={() => {
                        if (!mobileOpen) return;
                        setExpandedMobileGroups(current => ({
                          ...current,
                          [group.label]: !groupIsOpen,
                        }));
                      }}
                      className="sidebar-section-toggle mb-1 flex h-auto w-full items-center justify-between rounded-md px-3 py-2 text-left md:cursor-default"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate sidebar-section-label p-0">
                          {group.label}
                        </span>
                      </span>
                      <span className="text-[hsl(var(--sidebar-foreground)/.5)] md:hidden">
                        {groupIsOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </span>
                    </Button>
                  )}
                      <div className={`${compact || groupIsOpen ? 'block' : 'hidden md:block'} space-y-1`}>
                        {group.items.map(item => link(item))}
                      </div>
                    </section>
                  );
                })()
              ))}
            </>
          ) : (
            <>
              {!compact && (
                <SidebarSectionLabel>Administration</SidebarSectionLabel>
              )}
              <div className="space-y-1">{companyCoreItems.map(item => link(item))}</div>
              {companyModuleItems.length > 0 && (
                <section className={compact ? '' : 'mt-4 border-t border-[hsl(var(--sidebar-border))] pt-3'}>
                  {!compact && mobileOpen && (
                    <Button
                      type="button"
                      variant="ghost"
                      data-testid="company-modules-section"
                      aria-expanded={companyModulesOpen}
                      aria-controls="company-module-navigation"
                      onClick={() => {
                        if (!mobileOpen) return;
                        setExpandedMobileModules(open => !open);
                      }}
                      className="sidebar-section-toggle mb-1 flex h-auto w-full items-center justify-between rounded-md px-3 py-2 text-left md:cursor-default"
                    >
                      <span className="sidebar-section-label p-0">
                        Modules
                      </span>
                      <span className="text-[hsl(var(--sidebar-foreground)/.5)] md:hidden">
                        {companyModulesOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </span>
                    </Button>
                  )}
                  {!compact && !mobileOpen && (
                    <SidebarSectionLabel>Modules</SidebarSectionLabel>
                  )}
                  <div
                    id="company-module-navigation"
                    className={`${compact || companyModulesOpen ? 'block' : 'hidden md:block'} space-y-1`}
                  >
                    {companyModuleItems.map(item => link(item))}
                  </div>
                </section>
              )}
            </>
          )}
        </nav>
        <div
          className={`border-t border-[hsl(var(--sidebar-border))] pt-4 ${compact ? 'm-3' : 'm-4'}`}
        >
          <Button
            type="button"
            variant="ghost"
            data-testid="button-logout"
            title={compact ? 'Se déconnecter' : undefined}
            onClick={onLogout}
            className={`nav-item flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[hsl(var(--sidebar-foreground)/.64)] ${compact ? 'justify-center' : ''}`}
          >
            <LogIn size={17} className="rotate-180" />
            {!compact && 'Se déconnecter'}
          </Button>
          {!isAdmin && (
            <div className={`mt-4 flex ${compact ? 'justify-center' : 'justify-start'}`}>
              {compact ? (
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-[hsl(var(--accent)/.18)] text-[10px] font-black text-[hsl(var(--accent))]">
                  {adminLogo ? <img src={adminLogo} alt="" className="h-full w-full object-cover" /> : 'M'}
                </span>
              ) : (
                <span className="text-sm font-black tracking-[-.06em] text-[hsl(var(--sidebar-foreground))]">
                  MAXIMUS<span className="text-[hsl(var(--accent))]">.</span>
                </span>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

type TopbarProps = {
  isAdmin: boolean;
  onNavigate: (path: string) => void;
  onToggleMenu: () => void;
  notificationPath: string;
  unreadCount: number;
  onHelp: () => void;
  onRefresh: () => void | Promise<void>;
  workspaceName: string;
  mobileOpen: boolean;
};

export function Topbar({
  isAdmin,
  onNavigate,
  onToggleMenu,
  notificationPath,
  unreadCount,
  onHelp,
  onRefresh,
  workspaceName,
  mobileOpen,
}: TopbarProps) {
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const wasMobileOpen = useRef(false);

  useEffect(() => {
    if (wasMobileOpen.current && !mobileOpen) mobileMenuTriggerRef.current?.focus();
    wasMobileOpen.current = mobileOpen;
  }, [mobileOpen]);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <header className="topbar sticky top-0 z-20 flex min-h-[64px] w-full min-w-0 items-center justify-between gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.9)] px-3 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="button-mobile-menu"
          aria-label="Ouvrir le menu"
          aria-controls="maximus-primary-navigation"
          aria-expanded={mobileOpen}
          ref={mobileMenuTriggerRef}
          onClick={onToggleMenu}
          className="topbar-icon shrink-0 rounded-lg p-2 md:hidden"
        >
          <Menu size={19} />
        </Button>
        <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary)/.12)] text-xs font-black text-[hsl(var(--primary))] sm:flex">
          {workspaceName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 sm:max-w-[38rem]">
          <p className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[hsl(var(--muted-foreground))] sm:flex">
            {isAdmin ? 'Centre de contrôle' : 'Espace de travail'}
          </p>
          <div
            data-testid="text-workspace-name"
            title={workspaceName}
            className="truncate text-sm font-black leading-tight tracking-[-.035em] sm:text-base"
          >
            {workspaceName}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-2.5">
        {isAdmin && (
          <div className="relative hidden lg:block">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
            />
            <Input
              data-testid="input-global-search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && search.trim()) {
                  sessionStorage.setItem('maximus-company-search', search.trim());
                  onNavigate('/maximus/entreprises');
                }
              }}
              placeholder="Rechercher une entreprise..."
              aria-label="Rechercher une entreprise"
              className="topbar-search h-10 w-72 rounded-lg border-[hsl(var(--border))] bg-[hsl(var(--muted)/.6)] pl-9 pr-3 text-xs"
            />
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          data-testid="button-global-refresh"
          aria-label="Actualiser les données"
          title="Actualiser les données"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="topbar-icon inline-flex w-10 shrink-0 items-center justify-center gap-2 rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:justify-start sm:px-3"
        >
          <RefreshCw size={18} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />
          <span className="hidden text-xs font-bold sm:inline">Actualiser</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="button-help"
          aria-label="Aide MAXIMUS"
          title="Aide MAXIMUS"
          onClick={onHelp}
          className="topbar-icon shrink-0 rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
        >
          <CircleHelp size={18} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid="button-header-notifications"
          aria-label={
            unreadCount
              ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
              : 'Notifications'
          }
          onClick={() => onNavigate(notificationPath)}
          className="topbar-icon relative shrink-0 rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[hsl(var(--destructive))] px-1 text-center text-[9px] font-bold leading-4 text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}

type PageHeaderProps = {
  kicker: string;
  title: string;
  description: string;
  location: string;
  onBack: () => void;
};

export function PageHeader({
  kicker,
  title,
  description,
  location,
  onBack,
}: PageHeaderProps) {
  return (
    <div className="page-header mb-6 flex flex-col justify-between gap-3 border-b border-[hsl(var(--border))] pb-5 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <p className="mono mb-1.5 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">
          {kicker}
        </p>
        <h1
          data-testid="text-page-title"
          className="max-w-4xl break-words text-2xl font-bold tracking-[-.04em] sm:text-3xl"
        >
          {title}
        </h1>
        <p className="mt-1.5 max-w-3xl break-words text-sm leading-6 text-[hsl(var(--muted-foreground))]">
          {description}
        </p>
      </div>
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3 sm:shrink-0">
        {location !== '/maximus/dashboard' && location !== '/entreprise/dashboard' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="button-page-back"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))] transition hover:border-[hsl(var(--primary)/.45)] hover:text-[hsl(var(--primary))]"
          >
            <ArrowLeft size={14} />
            Retour
          </Button>
        )}
      </div>
    </div>
  );
}