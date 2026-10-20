/** @jsxRuntime automatic */
/** @jsxImportSource react */
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Company } from '@/lib/store';
import {
  CompanyNavigationSettingsPanel,
  MaximusNavigationSettings,
  NavigationModeChoice,
} from './company-navigation-settings';
import { NavigationSettingsContext } from '@/lib/navigation-settings-context';
import { effectiveCustomAllowed } from '@/lib/company-navigation';
import { CompanyFeatureRail } from './company-feature-rail';
import { Package } from 'lucide-react';

const company = (extra: Partial<Company> = {}) => ({ id: 'c1', name: 'Acme', ...extra }) as Company;
const panel = (isCompanyAdmin: boolean, c: Company) => renderToStaticMarkup(
  <NavigationSettingsContext.Provider value={{ isCompanyAdmin }}>
    <CompanyNavigationSettingsPanel company={c} />
  </NavigationSettingsContext.Provider>,
);

test('company control visible only for admin with grant', () => {
  assert.match(panel(true, company({ navigationCustomAllowed: true })), /company-navigation-settings/);
  assert.doesNotMatch(panel(true, company()), /company-navigation-settings/);
  assert.doesNotMatch(panel(false, company({ navigationCustomAllowed: true })), /company-navigation-settings/);
});

test('revoked grant hides control while mode data is retained on company', () => {
  const c = company({ navigationCustomAllowed: false, moduleNavigationMode: 'horizontal' });
  assert.equal(panel(true, c), '');
});

test('mode choice reflects both menu modes', () => {
  const menu = renderToStaticMarkup(<NavigationModeChoice value="menu" onChange={() => undefined} />);
  assert.match(menu, /<button[^>]*aria-pressed="true"[^>]*navigation-mode-menu"|<button[^>]*navigation-mode-menu"[^>]*aria-pressed="true"/);
  const horizontal = renderToStaticMarkup(<NavigationModeChoice value="horizontal" onChange={() => undefined} />);
  assert.match(horizontal, /<button[^>]*aria-pressed="true"[^>]*navigation-mode-horizontal"|<button[^>]*navigation-mode-horizontal"[^>]*aria-pressed="true"/);
});

test('maximus grant switch has no lock or unlock controls', () => {
  const html = renderToStaticMarkup(<MaximusNavigationSettings company={company()} />);
  assert.doesNotMatch(html, /data-locked|Déverrouiller|Verrouillé/);
  assert.match(html, /<button[^>]*switch-navigation-custom-allowed[^>]*>/);
  assert.match(html, /button-save-navigation-authorization/);
});

test('rail renders only the active module features', () => {
  const groups = [
    { label: 'Stock', items: [
      { href: '/entreprise/stocks?tab=a', label: 'Produits', icon: Package },
      { href: '/entreprise/stocks?tab=b', label: 'Mouvements', icon: Package },
    ] },
    { label: 'Paie', items: [{ href: '/entreprise/paie', label: 'Bulletins', icon: Package }] },
  ];
  const html = renderToStaticMarkup(<CompanyFeatureRail groups={groups} location="/entreprise/stocks?tab=b" onNavigate={() => undefined} />);
  assert.match(html, /Produits/);
  assert.match(html, /Mouvements/);
  assert.doesNotMatch(html, /Bulletins/);
  assert.match(html, /aria-current="page"/);
  assert.equal(renderToStaticMarkup(<CompanyFeatureRail groups={groups} location="/entreprise/dashboard" onNavigate={() => undefined} />), '');
});

test('cached remote grant never overrides a revoked bootstrap grant', () => {
  assert.equal(effectiveCustomAllowed(false, true), false);
  assert.equal(effectiveCustomAllowed(true, false), false);
  assert.equal(effectiveCustomAllowed(true, true), true);
  assert.equal(effectiveCustomAllowed(true, undefined), true);
  assert.equal(effectiveCustomAllowed(false, undefined), false);
});
