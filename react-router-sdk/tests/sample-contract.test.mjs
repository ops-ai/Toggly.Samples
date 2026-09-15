import assert from 'node:assert/strict'
import test from 'node:test'
import { matchingPreset, nonMatchingPreset, orderContext } from '../app/lib/offline-fixtures.mjs'

test('matching and non-matching filter inputs remain the shared contract values', () => {
  assert.equal(matchingPreset.identity, 'alice')
  assert.equal(matchingPreset.claims.role, 'admin')
  assert.equal(matchingPreset.request.country, 'US')
  assert.match(matchingPreset.request.userAgent, /Macintosh.*Chrome\/120/)
  assert.equal(nonMatchingPreset.identity, 'bob')
  assert.equal(nonMatchingPreset.claims.role, 'user')
  assert.equal(nonMatchingPreset.request.country, 'CA')
  assert.match(nonMatchingPreset.request.userAgent, /Windows.*Firefox\/121/)
})

test('Order context preserves the exact key and Vip attributes used by ExpressCheckout', () => {
  assert.deepEqual(orderContext(matchingPreset.order), { kind: 'Order', key: 'ord-vip', attributes: { Vip: true, Total: 275 } })
  assert.deepEqual(orderContext(nonMatchingPreset.order), { kind: 'Order', key: 'ord-standard', attributes: { Vip: false, Total: 85 } })
})
