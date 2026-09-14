import { createClient } from '@ops-ai/solid-feature-flags-toggly';
import { createToggly } from '@ops-ai/toggly-sveltekit';
const context = (identity) => ({
  identity,
  groups: identity === 'alice' ? ['staff'] : [],
  claims: { role: identity === 'alice' ? 'admin' : 'user' },
});
const expose = ['new-dashboard', 'filter-targeting', 'ExpressCheckout'];
window.boot = (config, identity = 'alice', seed) => {
  window.acceptanceClient?.dispose();
  const options = {
    appKey: config.frontendKey,
    environment: config.environment,
    baseURI: config.baseURI,
    refreshInterval: 0,
    enableLiveUpdates: true,
    storage: localStorage,
  };
  let client, snapshot;
  if (config.family === 'sveltekit') {
    client = createToggly(
      seed || {
        definitions: {},
        context: context(identity),
        expose,
        source: 'defaults',
      },
      options,
    );
    client.subscribe((s) => {
      snapshot = s;
    });
    void client.start();
  } else {
    client = createClient({ ...options, ...context(identity), expose, flagDefaults: {} }, seed);
    client.start();
    void client.refresh();
  }
  window.acceptanceClient = client;
  window.probe = () => {
    const evaluate = (key, entity) =>
      config.family === 'sveltekit'
        ? client.isEnabled(key, { entity })
        : client.evaluate([key], 'all', false, entity);
    return {
      value: evaluate('new-dashboard'),
      targeted: evaluate('filter-targeting'),
      vip: evaluate('ExpressCheckout', {
        kind: 'Order',
        key: 'vip',
        attributes: { Vip: true },
      }),
      standard: evaluate('ExpressCheckout', {
        kind: 'Order',
        key: 'standard',
        attributes: { Vip: false },
      }),
      definitions: config.family === 'sveltekit' ? snapshot.definitions : client.flags(),
      ...window.transportEvidence,
      decision: ++window.transportSequence,
    };
  };
};
