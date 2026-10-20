import { useEffect, useState } from 'react';
import type { Company, StoreData } from '@/lib/store';
import { CompanyProfileSection } from './company-profile-section';
import { OrganizationPublicSite } from './organization-public-site';
import { EmployeesTab } from './organization-employees';
import { RolesTab } from './organization-roles';
import { StructureTab } from './organization-structure';
import { WorkspaceTabs } from '@/components/workspace-tabs';
import { CompanySubscriptionTab } from './company-subscription-tab';

type Mutate = (fn: (data: StoreData) => void, message?: string | null) => void;
type OrganizationTab = 'structure' | 'roles' | 'employees' | 'profile' | 'publicSite' | 'subscription';

export { CompanyProfileSection } from './company-profile-section';

export function CompanyOrganizationAdmin({
  company,
  data,
  mutate,
  initialTab = 'structure',
  standalone = false,
  sectorManager = false,
  scopeNodeId,
}: {
  company: Company;
  data: StoreData;
  mutate: Mutate;
  initialTab?: OrganizationTab;
  standalone?: boolean;
  sectorManager?: boolean;
  scopeNodeId?: string;
}) {
  const companyNodes = data.orgNodes.filter(node => node.companyId === company.id);
  const scopedNodeIds = new Set<string>();

  if (scopeNodeId) {
    const pending = [scopeNodeId];
    while (pending.length) {
      const nodeId = pending.pop();
      if (!nodeId || scopedNodeIds.has(nodeId)) continue;
      scopedNodeIds.add(nodeId);
      companyNodes
        .filter(node => node.parentId === nodeId)
        .forEach(node => pending.push(node.id));
    }
  }

  const scopedData =
    sectorManager && scopeNodeId
      ? {
          ...data,
          orgNodes: data.orgNodes.filter(
            node => !node.companyId || scopedNodeIds.has(node.id),
          ),
          roles: data.roles.filter(
            role => !role.companyId || scopedNodeIds.has(role.sectorId ?? ''),
          ),
          employees: data.employees.filter(
            employee =>
              !employee.companyId || scopedNodeIds.has(employee.sectorId ?? ''),
          ),
        }
      : data;
  const subscriptionHidden = company.hiddenWorkspaceFeatures?.includes('abonnement') ?? false;
  const [tab, setTab] = useState<OrganizationTab>(
    sectorManager && initialTab === 'structure'
      ? 'roles'
      : subscriptionHidden && initialTab === 'subscription'
        ? 'structure'
        : initialTab,
  );

  useEffect(() => {
    setTab(
      sectorManager && initialTab === 'structure'
        ? 'roles'
        : subscriptionHidden && initialTab === 'subscription'
          ? 'structure'
          : initialTab,
    );
  }, [initialTab, sectorManager, subscriptionHidden]);

  useEffect(() => {
    if (subscriptionHidden && tab === 'subscription') setTab('structure');
  }, [subscriptionHidden, tab]);

  const organizationNodes = scopedData.orgNodes.filter(
    node => node.companyId === company.id,
  );
  const tabs = ([
    { id: 'structure', label: '1 · Structure & unités' },
    { id: 'roles', label: '2 · Rôles & permissions' },
    { id: 'employees', label: '3 · Comptes & managers' },
    { id: 'profile', label: 'Mon profil' },
    { id: 'publicSite', label: 'Site public' },
    { id: 'subscription', label: 'Abonnement' },
  ] as { id: OrganizationTab; label: string }[]).filter(
    item =>
      !sectorManager ||
      item.id === 'roles' ||
      item.id === 'employees',
  ).filter(
    item => item.id !== 'subscription' || !subscriptionHidden,
  );

  return (
    <div className="min-w-0 space-y-6">
      <div className="card-surface rounded-2xl p-4 sm:p-6">
        <h1 className="text-xl font-bold">
          {sectorManager
            ? 'Règles d’accès de mon unité'
            : `Modèle d'Accès & Organisation : ${company.name}`}
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {sectorManager
            ? 'Gérez les rôles, sous-autorisations et comptes de votre unité et de ses descendants.'
            : 'Construisez la hiérarchie, configurez les rôles et sous-autorisations, puis affectez les comptes et managers.'}
        </p>
        <WorkspaceTabs
          items={tabs}
          activeId={tab}
          onChange={id => setTab(id as OrganizationTab)}
          ariaLabel="Rubriques Organisation et accès"
          testIdPrefix="tab"
          className="mt-6 grid grid-cols-2 sm:flex sm:flex-wrap"
        />
      </div>
      {tab === 'structure' && !sectorManager && <StructureTab company={company} data={scopedData} mutate={mutate} />}
      {tab === 'roles' && <RolesTab company={company} data={scopedData} mutate={mutate} />}
      {tab === 'employees' && <EmployeesTab
        company={company}
        data={scopedData}
        mutate={mutate}
        allowSectorAdmin={!sectorManager}
        actorRole={sectorManager ? 'sector_manager' : 'company_admin'}
      />}
      {tab === 'profile' && !sectorManager && <CompanyProfileSection company={company} data={scopedData} mutate={mutate} />}
      {tab === 'publicSite' && !sectorManager && <OrganizationPublicSite company={company} />}
      {tab === 'subscription' && !sectorManager && !subscriptionHidden && <CompanySubscriptionTab company={company} />}
    </div>
  );
}