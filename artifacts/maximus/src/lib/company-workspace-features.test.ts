import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canAccessCompanySetupGuide,
  companyWorkspaceFeatureForPath,
  normalizeCompanyWorkspaceFeatureIds,
  resolveCompanyWorkspaceHiddenFeatures,
} from './company-workspace-features';

test('le guide est accessible aux admins et aux managers de secteur seulement', () => {
  assert.equal(canAccessCompanySetupGuide(true, true, false), true);
  assert.equal(canAccessCompanySetupGuide(true, false, true), true);
  assert.equal(canAccessCompanySetupGuide(true, false, false), false);
  assert.equal(canAccessCompanySetupGuide(false, true, true), false);
});

test('normalise les fonctionnalités visibles de l’espace entreprise', () => {
  assert.deepEqual(
    normalizeCompanyWorkspaceFeatureIds([
      'controle',
      'controle',
      'organisation',
      'ancienne-fonctionnalite',
      null,
      'guide-configuration',
      'abonnement',
    ]),
    ['controle', 'organisation', 'guide-configuration', 'abonnement'],
  );
});

test('reconnaît les routes des fonctionnalités de l’espace entreprise', () => {
  assert.equal(companyWorkspaceFeatureForPath('/entreprise/controle?filtre=ouvert'), 'controle');
  assert.equal(companyWorkspaceFeatureForPath('/entreprise/organisation/'), 'organisation');
  assert.equal(companyWorkspaceFeatureForPath('/entreprise/organisation?tab=subscription'), 'abonnement');
  assert.equal(companyWorkspaceFeatureForPath('/entreprise/guide-configuration'), 'guide-configuration');
  assert.equal(companyWorkspaceFeatureForPath('/entreprise/dashboard'), null);
});

test('masque Abonnement en mode gratuit ou tant que le mode payant n’est pas confirmé', () => {
  assert.deepEqual(resolveCompanyWorkspaceHiddenFeatures([], true, 'FREE'), ['abonnement']);
  assert.deepEqual(resolveCompanyWorkspaceHiddenFeatures([], true, null), ['abonnement']);
});

test('affiche Abonnement en mode payant sauf si MAXIMUS l’a masqué', () => {
  assert.deepEqual(resolveCompanyWorkspaceHiddenFeatures([], true, 'PAID'), []);
  assert.deepEqual(resolveCompanyWorkspaceHiddenFeatures(['abonnement'], true, 'PAID'), ['abonnement']);
});

test('ne change pas la visibilité de l’abonnement pour une session sans compte administrateur', () => {
  assert.deepEqual(resolveCompanyWorkspaceHiddenFeatures([], false, null), []);
});