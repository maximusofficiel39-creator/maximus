export function isEcommerceTabVisible(
  tabId: string,
  allowedFeatureIds?: string[],
  featurePermissions?: Partial<Record<string, string[]>>,
): boolean {
  if (['rapport-ventes', 'depenses'].includes(tabId) && featurePermissions && !featurePermissions[tabId]?.includes('voir')) {
    return false;
  }
  if (!allowedFeatureIds) return true;
  if (tabId === 'dashboard' || tabId === 'accueil') return true;
  if (allowedFeatureIds.includes(tabId)) return true;

  return tabId === 'categories' && allowedFeatureIds.includes('catalogue');
}