export type CompanyWorkspaceFeatureId = 'controle' | 'organisation' | 'guide-configuration' | 'abonnement';

export type CompanyWorkspaceFeatureDefinition = {
  id: CompanyWorkspaceFeatureId;
  label: string;
  description: string;
  path: string;
};

export const companyWorkspaceFeatureDefinitions: CompanyWorkspaceFeatureDefinition[] = [
  {
    id: 'controle',
    label: 'Contrôle & coordination',
    description: 'Tâches, décisions, événements et suivi des opérations.',
    path: '/entreprise/controle',
  },
  {
    id: 'organisation',
    label: 'Organisation & accès',
    description: 'Structure, rôles, permissions, comptes et managers.',
    path: '/entreprise/organisation',
  },
  {
    id: 'guide-configuration',
    label: 'Guide de configuration',
    description: 'Parcours de configuration et contrôles anti-oubli.',
    path: '/entreprise/guide-configuration',
  },
  {
    id: 'abonnement',
    label: 'Abonnement',
    description: 'Affichage du forfait, des tarifs et des paiements de l’entreprise.',
    path: '/entreprise/organisation?tab=subscription',
  },
];

export function companyWorkspaceFeatureForPath(path: string): CompanyWorkspaceFeatureId | null {
  const [pathname, query = ''] = path.split(/[?#]/, 2);
  const pathOnly = pathname.replace(/\/+$/, '') || '/';
  if (pathOnly === '/entreprise/organisation' && new URLSearchParams(query).get('tab') === 'subscription') {
    return 'abonnement';
  }
  return companyWorkspaceFeatureDefinitions.find(feature => feature.path === pathOnly)?.id ?? null;
}

export function canAccessCompanySetupGuide(
  companyExists: boolean,
  isCompanyAdmin: boolean,
  isSectorManager: boolean,
): boolean {
  return companyExists && (isCompanyAdmin || isSectorManager);
}

export function normalizeCompanyWorkspaceFeatureIds(value: unknown): CompanyWorkspaceFeatureId[] {
  if (!Array.isArray(value)) return [];
  const validIds = new Set(companyWorkspaceFeatureDefinitions.map(feature => feature.id));
  return [...new Set(
    value.filter((item): item is CompanyWorkspaceFeatureId => typeof item === 'string' && validIds.has(item as CompanyWorkspaceFeatureId)),
  )];
}

export function resolveCompanyWorkspaceHiddenFeatures(
  configuredHiddenFeatures: unknown,
  isCompanyAdmin: boolean,
  billingMode: 'FREE' | 'PAID' | null,
): CompanyWorkspaceFeatureId[] {
  const hiddenFeatures = new Set(normalizeCompanyWorkspaceFeatureIds(configuredHiddenFeatures));
  if (isCompanyAdmin && billingMode !== 'PAID') hiddenFeatures.add('abonnement');
  return [...hiddenFeatures];
}