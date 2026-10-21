import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModulePack, emptyModulePackDraft, updatePackPermission } from './module-pack';
import { getModuleFeatureOptions } from './module-features';
import { modules } from './store';
import type { Module } from './store';

const moduleFixture: Module = {
  id: 'achats',
  name: 'Achats',
  description: 'Demandes et commandes fournisseurs.',
  features: ['Demandes', 'Commandes'],
  status: 'ACTIF',
};
const [firstFeature] = getModuleFeatureOptions(moduleFixture);

test('construit un pack uniquement avec les fonctionnalités ayant un droit', () => {
  const draft = updatePackPermission(emptyModulePackDraft(), firstFeature.id, 'edit');
  const pack = buildModulePack(moduleFixture, { ...draft, name: 'Gestionnaire', description: 'Gérer cette fonctionnalité au quotidien.' }, 'pack-stocks');

  assert.deepEqual(pack, {
    id: 'pack-stocks',
    name: 'Gestionnaire',
    description: 'Gérer cette fonctionnalité au quotidien.',
    featureIds: [firstFeature.id],
    featurePermissions: { [firstFeature.id]: ['voir', 'créer', 'modifier'] },
  });
});

test('refuse un pack sans fonctionnalité autorisée', () => {
  const pack = buildModulePack(moduleFixture, { ...emptyModulePackDraft(), name: 'Pack vide' }, 'pack-empty');

  assert.equal(pack, null);
});

test('refuse un pack sans description', () => {
  const draft = updatePackPermission(emptyModulePackDraft(), firstFeature.id, 'view');
  const pack = buildModulePack(moduleFixture, { ...draft, name: 'Pack sans explication' }, 'pack-no-description');

  assert.equal(pack, null);
});

test('expose et conserve la fonctionnalité Catégories dans les packs e-commerce', () => {
  const ecommerce = modules.find((module) => module.id === 'ecommerce');
  assert.ok(ecommerce);

  const categories = getModuleFeatureOptions(ecommerce).find((feature) => feature.id === 'categories');
  assert.deepEqual(categories, { id: 'categories', label: 'Catégories' });

  const draft = updatePackPermission(emptyModulePackDraft(), 'categories', 'edit');
  const pack = buildModulePack(
    ecommerce,
    { ...draft, name: 'Gestion des catégories', description: 'Organiser le catalogue par familles.' },
    'pack-categories',
  );

  assert.deepEqual(pack?.featureIds, ['categories']);
  assert.deepEqual(pack?.featurePermissions?.categories, ['voir', 'créer', 'modifier']);
});

test('expose Rapport des ventes comme pack facultatif et à lecture seule', () => {
  const ecommerce = modules.find((module) => module.id === 'ecommerce');
  assert.ok(ecommerce);

  const report = getModuleFeatureOptions(ecommerce).find(feature => feature.id === 'rapport-ventes');
  assert.deepEqual(report, { id: 'rapport-ventes', label: 'Rapport des ventes' });

  const managementPack = ecommerce.featurePacks?.find(pack => pack.id === 'ecommerce-gestion');
  assert.equal(managementPack?.featureIds.includes('rapport-ventes'), false);

  const reportPack = ecommerce.featurePacks?.find(pack => pack.id === 'ecommerce-rapport-ventes');
  assert.ok(reportPack?.featureIds.includes('rapport-ventes'));
  assert.deepEqual(reportPack.featurePermissions?.['rapport-ventes'], ['voir']);

  const draft = updatePackPermission(emptyModulePackDraft(), 'rapport-ventes', 'view');
  const customPack = buildModulePack(
    ecommerce,
    { ...draft, name: 'Rapport', description: 'Consulter les ventes.' },
    'pack-report',
  );
  assert.deepEqual(customPack?.featurePermissions?.['rapport-ventes'], ['voir']);
});

test('expose Dépenses as a separate feature with its own assignable pack', () => {
  const ecommerce = modules.find(module => module.id === 'ecommerce');
  assert.ok(ecommerce);

  assert.deepEqual(
    getModuleFeatureOptions(ecommerce).find(feature => feature.id === 'depenses'),
    { id: 'depenses', label: 'Dépenses' },
  );
  const expensePack = ecommerce.featurePacks?.find(pack => pack.id === 'ecommerce-depenses');
  assert.deepEqual(expensePack?.featureIds, ['depenses']);
  assert.deepEqual(expensePack?.featurePermissions?.depenses, ['voir', 'créer', 'modifier']);
  const counterPack = ecommerce.featurePacks?.find(pack => pack.id === 'ecommerce-vente-comptoir');
  assert.equal(counterPack?.featureIds.includes('depenses'), false);
});

test('expose les autorisations de vente physique et numérique dans e-commerce', () => {
  const ecommerce = modules.find((module) => module.id === 'ecommerce');
  assert.ok(ecommerce);

  assert.deepEqual(
    getModuleFeatureOptions(ecommerce).filter((feature) => feature.id.startsWith('vente-')),
    [
      { id: 'vente-physique', label: 'Vente de produits physiques' },
      { id: 'vente-comptoir', label: 'Vente comptoir' },
      { id: 'vente-numerique', label: 'Vente de produits numériques' },
    ],
  );
});
