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

console.log('Astro request context preset tests passed.');
