import assert from 'node:assert/strict'
import test from 'node:test'
import { filterResultLabel, hasFlagDefinition } from '../app/lib/filter-results.mjs'
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

test('filters matrix labels a missing definition separately from an evaluated off rule', () => {
  assert.equal(filterResultLabel(false, false), 'missing')
  assert.equal(filterResultLabel(true, false), 'false')
  assert.equal(filterResultLabel(true, true), 'true')
  assert.equal(hasFlagDefinition({ 'filter-os': false }, 'filter-browser-family'), false)
  assert.equal(hasFlagDefinition({ 'filter-browser-family': false }, 'filter-browser-family'), true)
})

test('Order context preserves the exact key and Vip attributes used by ExpressCheckout', () => {
  assert.deepEqual(orderContext(matchingPreset.order), { kind: 'Order', key: 'ord-vip', attributes: { Vip: true, Total: 275 } })
  assert.deepEqual(orderContext(nonMatchingPreset.order), { kind: 'Order', key: 'ord-standard', attributes: { Vip: false, Total: 85 } })
})
