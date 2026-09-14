import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

const { toggly } = vi.hoisted(() => ({
  toggly: {
    isFeatureOn: vi.fn().mockResolvedValue(false),
    evaluateFeatureGate: vi.fn().mockResolvedValue(false),
    setContext: vi.fn().mockResolvedValue(undefined),
    subscribeFeaturesRefresh: vi.fn().mockReturnValue(() => undefined),
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
})
