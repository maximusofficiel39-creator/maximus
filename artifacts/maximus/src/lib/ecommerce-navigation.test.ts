import assert from 'node:assert/strict';
import test from 'node:test';
import { isEcommerceTabVisible } from './ecommerce-navigation';

test('shows the sales report only when its own feature is authorized', () => {
  assert.equal(isEcommerceTabVisible('rapport-ventes', ['dashboard']), false);
  assert.equal(isEcommerceTabVisible('rapport-ventes', ['rapport-ventes']), true);
  assert.equal(isEcommerceTabVisible(
    'rapport-ventes',
    ['rapport-ventes'],
    { 'rapport-ventes': ['voir'] },
  ), true);
  assert.equal(isEcommerceTabVisible(
    'rapport-ventes',
    ['rapport-ventes'],
    { 'rapport-ventes': [] },
  ), false);
});

test('shows expenses only when their own feature is authorized', () => {
  assert.equal(isEcommerceTabVisible('depenses', ['vente-comptoir']), false);
  assert.equal(isEcommerceTabVisible('depenses', ['depenses']), true);
  assert.equal(isEcommerceTabVisible('depenses', ['depenses'], { depenses: [] }), false);
});

test('continues to hide operation tabs that the role does not have', () => {
  assert.equal(isEcommerceTabVisible('commandes', ['dashboard']), false);
  assert.equal(isEcommerceTabVisible('commandes', ['commandes']), true);
});

test('keeps categories available with catalogue access', () => {
  assert.equal(isEcommerceTabVisible('categories', ['catalogue']), true);
  assert.equal(isEcommerceTabVisible('categories', ['commandes']), false);
});