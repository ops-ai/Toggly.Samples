import assert from 'node:assert/strict';
import { createTogglyRequestContext } from '../src/toggly-config.ts';

const matching = createTogglyRequestContext(
  new URL('http://127.0.0.1:4321/?preset=matching&identity='),
);
assert.equal(matching.identity, 'alice', 'empty identity query must not block preset alice');
assert.equal(matching.userId, 'alice');
assert.equal(matching.presetName, 'matching');

const nonMatching = createTogglyRequestContext(
  new URL('http://127.0.0.1:4321/?preset=nonmatching'),
);
assert.equal(nonMatching.identity, 'bob');

const harnessNone = createTogglyRequestContext(
  new URL('http://127.0.0.1:4321/?preset=none'),
  { headers: { get: (name) => (name === 'x-demo-preset' ? 'matching' : null) } },
);
assert.equal(harnessNone.identity, 'alice', 'preset=none must defer to x-demo-preset');
assert.equal(harnessNone.presetName, 'matching');

const harnessStrippedRequestUrl = createTogglyRequestContext(
  new URL('http://127.0.0.1:4321/?preset=matching'),
  undefined,
  { url: 'http://127.0.0.1:4321/' },
);
assert.equal(
  harnessStrippedRequestUrl.presetName,
  'matching',
  'Astro.url query must apply when request.url omits search (Node adapter / Live E2E)',
);
assert.equal(harnessStrippedRequestUrl.identity, 'alice');

console.log('Astro request context preset tests passed.');
