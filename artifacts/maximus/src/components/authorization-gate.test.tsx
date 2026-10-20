/** @jsxRuntime automatic */
/** @jsxImportSource react */
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthorizationGate } from './authorization-gate';
import { gateReducer, initialGateState, shouldBlockGateEvent } from '@/lib/authorization-gate';

const noop = () => undefined;
const gate = (over: Partial<Parameters<typeof AuthorizationGate>[0]['gate']> = {}) => ({
  locked: true, confirming: false, pending: false, requestUnlock: noop, confirmUnlock: noop, cancelUnlock: noop, relock: noop, ...over,
});
const render = (g = gate()) => renderToStaticMarkup(
  <AuthorizationGate gate={g}><input type="checkbox" data-testid="inner" /></AuthorizationGate>,
);

test('gate no longer adds lock controls or blocks its settings', () => {
  assert.deepEqual(initialGateState, { locked: false, confirming: false });
  const html = render();
  assert.match(html, /data-testid="inner"/);
  assert.doesNotMatch(html, /data-locked|authorization-gate-unlock|Déverrouiller|<fieldset/);
});

test('unlock actions cannot relock settings', () => {
  const requested = gateReducer(initialGateState, 'request');
  assert.deepEqual(requested, initialGateState);
  assert.deepEqual(gateReducer(requested, 'cancel'), initialGateState);
  assert.deepEqual(gateReducer(initialGateState, 'confirm'), initialGateState);
});

test('settings wrapper stays transparent', () => {
  const html = render(gate({ locked: false }));
  assert.match(html, /data-testid="inner"/);
  assert.doesNotMatch(html, /authorization-gate-relock|Reverrouiller/);
  assert.deepEqual(gateReducer({ locked: false, confirming: false }, 'relock'), initialGateState);
});

test('locked gate blocks click and keyboard events', () => {
  assert.equal(shouldBlockGateEvent(true), true);
  assert.equal(shouldBlockGateEvent(false), false);
});
