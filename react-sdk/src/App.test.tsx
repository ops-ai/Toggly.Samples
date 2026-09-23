import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

const { toggly } = vi.hoisted(() => ({
  toggly: {
    isFeatureOn: vi.fn().mockResolvedValue(false),
    evaluateFeatureGate: vi.fn().mockResolvedValue(false),
    setContext: vi.fn().mockResolvedValue(undefined),
    subscribeFeaturesRefresh: vi.fn().mockReturnValue(() => undefined),
    subscribeLocalGatesChanged: vi.fn().mockReturnValue(() => undefined),
    getVariant: vi.fn().mockReturnValue(null),
  },
}))

vi.mock('@ops-ai/react-feature-flags-toggly', () => ({
  Feature: ({ children, render }: { children?: React.ReactNode; render?: (enabled: boolean) => React.ReactNode }) =>
    render ? <>{render(false)}</> : <>{children}</>,
  context: React.createContext({ toggly }),
  registerContext: vi.fn(),
  useFeatureFlag: () => ({ isEnabled: false, isLoading: false, refresh: vi.fn() }),
  useFeatureGate: () => ({ isEnabled: false, isLoading: false, refresh: vi.fn() }),
  useVariant: () => null,
}))

import App from './App'
import { FiltersMatrix } from './DemoPanels'

describe('React SDK showcase', () => {
  it('keeps the full sample contract discoverable when no key is configured', () => {
    render(<App appKey="" initialIdentity="sample-alice" />)

    expect(screen.getByRole('heading', { name: 'React SDK Showcase' })).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('VITE_TOGGLY_APP_KEY')
    expect(screen.getByText('Declarative gates')).toBeVisible()
    expect(screen.getByText('Programmatic API')).toBeVisible()
    expect(screen.getByText('Session identity')).toBeVisible()
    expect(screen.getByText('Order entity context')).toBeVisible()
    expect(screen.getByText('Filters matrix')).toBeVisible()
    expect(screen.getByText('React SDK surfaces')).toBeVisible()
    expect(screen.getByText('Live flag snapshot')).toBeVisible()
  })

  it('evaluates the context-property filter with the Order entity for both presets', async () => {
    const { container } = render(<FiltersMatrix />)

    await waitFor(() => {
      expect(toggly.isFeatureOn).toHaveBeenCalledWith(
        'filter-context-property',
        { id: 'ord-vip', vip: true, total: 149.95 },
        'Order',
      )
    })

    fireEvent.click(within(container).getByRole('button', { name: 'Apply non-matching preset' }))

    await waitFor(() => {
      expect(toggly.isFeatureOn).toHaveBeenCalledWith(
        'filter-context-property',
        { id: 'ord-standard', vip: false, total: 42 },
        'Order',
      )
    })
  })
})
