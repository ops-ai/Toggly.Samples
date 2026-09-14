// LOCAL MECHANICS ONLY. The live CLI never imports this module.
import { createServer } from 'node:http';
import { generateKeyPairSync, createHash, sign } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { computeKid } from '@ops-ai/toggly-signed-defs';
export async function fixture(options = {}) {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = pair.publicKey.export({ format: 'jwk' });
  const kid = await computeKid(jwk.x, jwk.y);
  let enabled = true,
    revision = 1;
  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', 'ETag');
    if (req.method === 'OPTIONS') {
      res.end();
      return;
    }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.includes('.well-known')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ keys: [{ ...jwk, kid, alg: 'ES256' }] }));
      return;
    }
    const backend = url.pathname.includes('/definitions-signed/');
    const filters = enabled ? [{ name: 'AlwaysOn', parameters: {} }] : [];
    const defs = backend
      ? [
          { featureKey: 'new-dashboard', filters },
          {
            featureKey: 'filter-targeting',
            filters: [
              {
                name: 'Targeting',
                parameters: {
                  'Audience.Users:0': 'alice',
                  'Audience.DefaultRolloutPercentage': 0,
                },
              },
            ],
          },
          {
            featureKey: 'ExpressCheckout',
            contextKind: 'Order',
            contextRequirementType: 'All',
            filters: [
              {
                name: 'ContextProperty',
                parameters: {
                  Property: 'Vip',
                  Operator: 'eq',
                  Value: 'true',
                  ValueType: 'boolean',
                },
              },
            ],
          },
        ]
      : {
          'new-dashboard': enabled,
          'filter-targeting': url.searchParams.get('u') === 'alice',
          ExpressCheckout: {
            requirement: 'all',
            rules: [{ property: 'Vip', op: 'eq', value: 'true', type: 'boolean' }],
          },
        };
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = createHash('sha256')
      .update(JSON.stringify(defs) + '|' + timestamp)
      .digest();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('ETag', `"revision-${revision}"`);
    res.end(
      JSON.stringify({
        defs,
        timestamp,
        kid,
        signature:
          options.invalid === true || (!backend && options.invalid === 'frontend')
            ? 'invalid'
            : sign('sha256', digest, {
                key: pair.privateKey,
                dsaEncoding: backend ? 'der' : 'ieee-p1363',
              }).toString('base64'),
      }),
    );
  });
  const sockets = new WebSocketServer({ server });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    baseURI: `http://127.0.0.1:${server.address().port}`,
    change(value) {
      enabled = value;
      revision++;
      for (const ws of sockets.clients)
        if (!options.noFrames)
          ws.send(
            JSON.stringify({
              type: 'flags-updated',
              etag: `"revision-${revision}"`,
            }),
          );
    },
    async close() {
      for (const ws of sockets.clients) ws.terminate();
      await new Promise((r) => sockets.close(r));
      await new Promise((r) => server.close(r));
    },
  };
}
