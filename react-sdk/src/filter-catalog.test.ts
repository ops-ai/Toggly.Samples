import { describe, expect, it } from 'vitest'
import { filterRows } from './filter-catalog'

describe('filter matrix catalog', () => {
  it('keeps every shared filter row visible to the learner', () => {
    expect(filterRows.map((row) => row.key)).toEqual([
      'filter-always-on',
      'filter-percentage',
      'filter-targeting',
      'filter-user-claims',
      'filter-time-window',
      'filter-country',
      'filter-browser-family',
      'filter-browser-language',
      'filter-device-type',
      'filter-os',
      'filter-context-property',
    ])
  })

  it('labels browser and network-derived filters as browser-controlled', () => {
    const country = filterRows.find((row) => row.key === 'filter-country')
    const browser = filterRows.find((row) => row.key === 'filter-browser-family')

    expect(country?.limitation).toMatch(/network/i)
    expect(browser?.limitation).toMatch(/browser/i)
  })
})
