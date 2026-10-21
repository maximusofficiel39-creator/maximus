import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  CarFront,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileBarChart,
  FileText,
  Gauge,
  History,
  LayoutGrid,
  Package,
  Settings,
  ShoppingCart,
  ShoppingBag,
  Tags,
  Store,
  Users,
  WalletCards,
  Warehouse,
} from 'lucide-react';
import {
  commerceTabDefinitions,
  type CommerceTabId,
} from './commerce-permissions';
import { getSelectedFeatureIds, roleHasFeaturePermission } from './employee-permissions';
import { getModuleFeatureOptions } from './module-features';
import { featureSlug } from './permission-keys';
import {
  stockSubmodules,
  type Module,
  type ModuleId,
  type OrgNode,
  type Role,
} from './store';
import type { Icon, SidebarFeatureGroup } from './navigation';

const commerceTabIcons: Record<CommerceTabId, Icon> = {
  dashboard: Gauge,
  sales: ShoppingCart,
  products: Package,
  clients: Users,
  suppliers: Store,
  purchases: Package,
  expenses: ArrowDownToLine,
  cash: WalletCards,
  credit: CreditCard,
  invoices: FileBarChart,
  returns: ArrowUpFromLine,
  reports: FileBarChart,
  activity: History,
  team: Users,
  settings: Settings,
};

const stockFeatureIcons: Record<string, Icon> = {
  dashboard: Gauge,
  products: Package,
  entries: ArrowDownToLine,
  exits: ArrowUpFromLine,
  requests: ClipboardCheck,
  inventory: ClipboardCheck,
  reports: FileBarChart,
  settings: Settings,
  references: Warehouse,
  users: Users,
};

const ecommerceFeatureIcons: Record<string, Icon> = {
  dashboard: Gauge,
  catalogue: Package,
  categories: Tags,
  commandes: ShoppingCart,
  'rapport-ventes': FileBarChart,
  depenses: ArrowDownToLine,
  clients: Users,
  promotions: CreditCard,
  livraisons: Warehouse,
  parametres: Settings,
};

const ecommerceCapabilityFeatureIds = new Set(['vente-physique', 'vente-numerique']);

const payrollFeatureIcons: Record<string, Icon> = {
  'tableau-de-bord': Gauge,
  bénéficiaires: Users,
  'préparer-une-paie': FileText,
  validation: ClipboardCheck,
  virements: ArrowUpFromLine,
  'solde-de-paie': WalletCards,
  historique: History,
};

function buildEcommerceNavigationItems(
  module: Module,
  selectedFeatureIds: Set<string>,
  canViewSalesReport: boolean,
  canViewExpenses: boolean,
) {
  const featureItems = getModuleFeatureOptions(module)
    .filter(feature => !ecommerceCapabilityFeatureIds.has(feature.id))
    .filter(feature => selectedFeatureIds.has(feature.id))
    .filter(feature => feature.id !== 'rapport-ventes' || canViewSalesReport)
    .filter(feature => feature.id !== 'depenses' || canViewExpenses)
    .map(feature => ({
      href: `/entreprise/ecommerce?tab=${feature.id}`,
      label: feature.label,
      icon: ecommerceFeatureIcons[feature.id] ?? ShoppingBag,
    }));

  // Les catégories font partie de la gestion du catalogue : elles suivent
  // donc son autorisation sans devenir une permission indépendante.
  if (!selectedFeatureIds.has('catalogue') || featureItems.some(item => item.href.endsWith('?tab=categories'))) {
    return featureItems;
  }

  const catalogueIndex = featureItems.findIndex(item => item.href.endsWith('?tab=catalogue'));
  if (catalogueIndex < 0) return featureItems;

  return [
    ...featureItems.slice(0, catalogueIndex + 1),
    {
      href: '/entreprise/ecommerce?tab=categories',
      label: 'Catégories',
      icon: Tags,
    },
    ...featureItems.slice(catalogueIndex + 1),
  ];
}

type SidebarNavigationInput = {
  allowed: ModuleId[];
  configuredModules: Module[];
  employeeRole: Role | null;
  employeeNode: OrgNode | null;
  companyAdmin?: boolean;
  selectedFeatureIdsByModule?: Partial<Record<ModuleId, string[]>>;
  ecommerceFeatureIds?: string[];
  commerceTabIds?: string[];
  stockPermissions?: Record<string, string[]>;
};

export function buildSidebarFeatureGroups({
  allowed,
  configuredModules,
  employeeRole,
  employeeNode,
  companyAdmin = false,
  selectedFeatureIdsByModule,
  ecommerceFeatureIds,
  commerceTabIds,
  stockPermissions,
}: SidebarNavigationInput): SidebarFeatureGroup[] {
  return allowed.flatMap(moduleId => {
    const module = configuredModules.find(item => item.id === moduleId);
    if (!module) return [];
    const hasExplicitCompanySelection =
      companyAdmin && Object.prototype.hasOwnProperty.call(selectedFeatureIdsByModule ?? {}, module.id);
    const selectedFeatureIds = companyAdmin && !employeeRole
      ? new Set(
          selectedFeatureIdsByModule?.[module.id]
            ?? getModuleFeatureOptions(module).map(feature => feature.id),
        )
      : getSelectedFeatureIds(
          employeeRole,
          module,
          employeeNode?.moduleFeatures?.[module.id],
        );
    const visibleFeatureIds = employeeRole
      ? new Set(
          [...selectedFeatureIds].filter(featureId =>
            roleHasFeaturePermission(employeeRole, employeeNode, module.id, featureId, 'voir'),
          ),
        )
      : selectedFeatureIds;

    if (moduleId === 'ecommerce' && allowed.includes('commerce')) return [];

    if (moduleId === 'commerce' || moduleId === 'ecommerce') {
      const items: SidebarFeatureGroup['items'] = [];
      if (allowed.includes('commerce')) {
        const visibleCommerceTabs = commerceTabIds
          ? commerceTabDefinitions.filter(tab =>
              commerceTabIds.includes(tab.id)
              && (!employeeRole || visibleFeatureIds.has(tab.id)))
          : companyAdmin
            ? commerceTabDefinitions.filter(tab => !hasExplicitCompanySelection || visibleFeatureIds.has(tab.id))
            : [];
        items.push(...visibleCommerceTabs.map(tab => ({
          href: `/entreprise/commerce?tab=${tab.id}`,
          label: tab.label,
          icon: commerceTabIcons[tab.id],
        })));
      }

      if (allowed.includes('ecommerce')) {
        const ecommerceModule = configuredModules.find(item => item.id === 'ecommerce');
        if (ecommerceModule) {
          const hasExplicitEcommerceSelection =
            Object.prototype.hasOwnProperty.call(selectedFeatureIdsByModule ?? {}, 'ecommerce');
          const ecommerceFeatures = ecommerceFeatureIds
            ?? (moduleId === 'ecommerce'
              ? [...visibleFeatureIds]
              : getModuleFeatureOptions(ecommerceModule)
                .filter(feature => !(
                  companyAdmin
                  && !employeeRole
                  && !hasExplicitEcommerceSelection
                  && feature.id === 'rapport-ventes'
                ))
                .map(feature => feature.id));
          const features = new Set(
            ecommerceFeatures.filter(featureId =>
              !employeeRole || visibleFeatureIds.has(featureId),
            ),
          );
          const canViewSalesReport = (companyAdmin && !employeeRole)
            || roleHasFeaturePermission(employeeRole, employeeNode, ecommerceModule.id, 'rapport-ventes', 'voir');
          const canViewExpenses = (companyAdmin && !employeeRole)
            || roleHasFeaturePermission(employeeRole, employeeNode, ecommerceModule.id, 'depenses', 'voir');
          items.push(...buildEcommerceNavigationItems(ecommerceModule, features, canViewSalesReport, canViewExpenses));
        }
      }

      return items.length ? [{ label: 'Commerce', items }] : [];
    }

    const items = moduleId === 'stocks'
        ? (stockPermissions
          ? stockSubmodules.filter(submodule => stockPermissions[submodule.id]?.includes('voir'))
          : companyAdmin
            ? stockSubmodules.filter(submodule => !hasExplicitCompanySelection || selectedFeatureIds.has(submodule.id))
            : [])
          .map(submodule => ({
            href: `/entreprise/stocks?tab=${submodule.id}`,
            label: submodule.name,
            icon: stockFeatureIcons[submodule.id] ?? Warehouse,
          }))
        : moduleId === 'ecommerce'
          ? buildEcommerceNavigationItems(
            module,
            visibleFeatureIds,
            (companyAdmin && !employeeRole)
              || roleHasFeaturePermission(employeeRole, employeeNode, module.id, 'rapport-ventes', 'voir'),
            (companyAdmin && !employeeRole)
              || roleHasFeaturePermission(employeeRole, employeeNode, module.id, 'depenses', 'voir'),
          )
        : moduleId === 'presences'
          ? getModuleFeatureOptions(module)
            .filter(feature => Boolean(
              visibleFeatureIds.has(feature.id)
              && (companyAdmin
                || roleHasFeaturePermission(employeeRole, employeeNode, module.id, feature.id, 'voir')),
            ))
            .map(feature => ({
              href: `/entreprise/presences?tab=${({
                'tableau-de-bord': 'dashboard',
                pointage: 'clock',
                présences: 'presence',
                absences: 'absence',
                horaires: 'schedules',
                congés: 'leave',
                historique: 'history',
                rapports: 'reports',
              } as Record<string, string>)[feature.id] ?? 'dashboard'}`,
              label: feature.label,
              icon: CalendarDays,
            }))
          : moduleId === 'transport'
            ? getModuleFeatureOptions(module)
              .filter(feature =>
                visibleFeatureIds.has(feature.id)
                && (companyAdmin && !employeeRole
                  ? true
                  : roleHasFeaturePermission(employeeRole, employeeNode, module.id, feature.id, 'voir')))
              .map(feature => ({
                href: `/entreprise/transport?tab=${feature.id}`,
                label: feature.label,
                icon: CarFront,
              }))
            : moduleId === 'immobilier'
              ? getModuleFeatureOptions(module)
                .filter(feature =>
                  visibleFeatureIds.has(feature.id)
                  && (companyAdmin && !employeeRole
                    ? true
                    : roleHasFeaturePermission(employeeRole, employeeNode, module.id, feature.id, 'voir')))
                .map(feature => ({
                  href: `/entreprise/immobilier?feature=${encodeURIComponent(feature.id)}`,
                  label: feature.label,
                  icon: feature.id === 'biens' ? Building2 : feature.id === 'annonces' ? FileText : LayoutGrid,
                }))
            : moduleId === 'amicales'
              ? getModuleFeatureOptions(module)
                .filter(feature => visibleFeatureIds.has(feature.id))
                .map(feature => ({
                  href: `/entreprise/amicales?feature=${feature.id}`,
                  label: feature.label,
                  icon: LayoutGrid,
                }))
              : module.features
                .filter(feature => visibleFeatureIds.has(featureSlug(feature)))
                .map(feature => featureSlug(feature))
                .map(featureId => ({
                  href: `/entreprise/${moduleId}?feature=${featureId}`,
                  label: module.features.find(feature => featureSlug(feature) === featureId) ?? featureId,
                  icon: moduleId === 'paie'
                    ? payrollFeatureIcons[featureId] ?? WalletCards
                    : moduleId === 'ventes'
                      ? ShoppingCart
                      : moduleId === 'finance'
                        ? WalletCards
                        : moduleId === 'rh'
                          ? Users
                          : LayoutGrid,
                }));

    if (items.length) return [{ label: module.name, items }];
    if (moduleId === 'paie' && allowed.includes('paie')) {
      return [{
        label: module.name,
        items: [{
          href: '/entreprise/paie',
          label: module.name,
          icon: WalletCards,
        }],
      }];
    }
    return [];
  });
}