import { expect, it } from 'vitest';
import { createToggly } from '@ops-ai/toggly-sveltekit';
import { preset, vip, standard } from '../src/lib/catalog';
import { frontendExposeKeys, keylessFrontendSnapshot } from '../src/lib/frontend-snapshot';

it('exposes filter-* keys in the keyless frontend snapshot', async () => {
  expect(frontendExposeKeys).toContain('filter-targeting');
  const snapshot = await keylessFrontendSnapshot(true);
  expect(snapshot.definitions['filter-targeting']).toBe(true);
});

it('evaluates filter-targeting ON in the browser store for matching preset (SSR seed)', async () => {
  const toggly = createToggly(await keylessFrontendSnapshot(true), {
    appKey: '',
    environment: 'Production',
    enableTelemetry: false,
  });
  expect(toggly.isEnabled('filter-targeting', { entity: vip })).toBe(true);
  toggly.dispose();
  const nonMatching = createToggly(await keylessFrontendSnapshot(false), {
    appKey: '',
    environment: 'Production',
    enableTelemetry: false,
  });
  expect(nonMatching.isEnabled('filter-targeting', { entity: standard })).toBe(false);
  nonMatching.dispose();
});
