import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MissingAppKeyBanner } from './MissingAppKeyBanner'

describe('MissingAppKeyBanner', () => {
  it('makes a missing browser app key actionable without hiding the sample', () => {
    render(<MissingAppKeyBanner appKey="" />)

    expect(screen.getByRole('alert')).toHaveTextContent('VITE_TOGGLY_APP_KEY')
    expect(screen.getByRole('alert')).toHaveTextContent('safe local defaults')
  })

  it('renders nothing after an app key has been configured', () => {
    const { container } = render(<MissingAppKeyBanner appKey="sample-key" />)

    expect(container).toBeEmptyDOMElement()
  })
})
