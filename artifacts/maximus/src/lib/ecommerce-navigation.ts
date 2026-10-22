export function isEcommerceTabVisible(
  tabId: string,
  allowedFeatureIds?: string[],
  featurePermissions?: Partial<Record<string, string[]>>,
): boolean {
  if (tabId === 'rapport-ventes') {
    const reportFeatures = ['rapport-ventes', 'depenses', 'investissements'];
    const hasAllowedReport = reportFeatures.some(id =>
      (!allowedFeatureIds || allowedFeatureIds.includes(id))
      && (!featurePermissions || featurePermissions[id]?.includes('voir')),
    );
    if (!hasAllowedReport) return false;
    return true;
  } else if (['depenses', 'investissements'].includes(tabId) && featurePermissions && !featurePermissions[tabId]?.includes('voir')) {
    return false;
  }
  if (!allowedFeatureIds) return true;
  if (tabId === 'dashboard' || tabId === 'accueil') return true;
  if (allowedFeatureIds.includes(tabId)) return true;

  return tabId === 'categories' && ['catalogue', 'depenses', 'investissements'].some(id => allowedFeatureIds.includes(id));
}