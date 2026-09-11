'use client'

import {
  useFeatureFlag,
  useFeatureGate,
  useFeatures,
  useIdentity,
  useToggly,
} from '@ops-ai/nextjs-toggly-client'
import { useState } from 'react'

function Status({
  label,
  enabled,
  loading,
}: {
  label: string
  enabled: boolean
  loading: boolean
}) {
  if (loading) return <span className="muted">{label}: loading…</span>
  return (
    <span className={enabled ? 'on' : 'off'}>
      {label}: {enabled ? 'ON' : 'OFF'}
    </span>
  )
}

function HooksDemo() {
  // Hooks subscribe to the provider and expose loading separately from OFF.
  // "all" requires both flags; "any" allows either. These are boolean decisions,
  // not experiment allocation or conversion tracking.
  const flag = useFeatureFlag('new-dashboard')
  const gateAll = useFeatureGate(['new-dashboard', 'api-v2'], 'all')
  const gateAny = useFeatureGate(['new-dashboard', 'api-v2'], 'any')
  const { features, isLoading: featuresLoading } = useFeatures()
  // This changes only this browser provider's identity, not toggly-identity cookies
  // used by the server demo. In this published version, failed identity refresh
  // is not a transactional rollback; inspect errors before trusting a new result.
  const { identity, setIdentity, isUpdating } = useIdentity()
  const toggly = useToggly()
  const [draft, setDraft] = useState('')

  return (
    <>
      <div className="card">
        <h2>useFeatureFlag(&apos;new-dashboard&apos;)</h2>
        <p>
          <Status
            label="isEnabled"
            enabled={flag.isEnabled}
            loading={flag.isLoading}
          />
        </p>
        <button type="button" onClick={() => void flag.refresh()}>
          refresh
        </button>
      </div>

      <div className="card">
        <h2>useFeatureGate</h2>
        <p>
          <Status
            label="all (new-dashboard + api-v2)"
            enabled={gateAll.isAllowed}
            loading={gateAll.isLoading}
          />
        </p>
        <p>
          <Status
            label="any"
            enabled={gateAny.isAllowed}
            loading={gateAny.isLoading}
          />
        </p>
      </div>

      <div className="card">
        <h2>useFeatures</h2>
        {featuresLoading ? (
          <p className="muted">Loading features…</p>
        ) : (
          <pre>{JSON.stringify(features, null, 2)}</pre>
        )}
      </div>

      <div className="card">
        <h2>useIdentity</h2>
        <p>
          Identity: <code>{identity ?? '(none)'}</code>{' '}
          {isUpdating ? <span className="muted">(updating…)</span> : null}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void setIdentity(draft.trim())
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="client-user"
            aria-label="Client identity"
          />
          <button type="submit" disabled={isUpdating}>
            setIdentity
          </button>
        </form>
      </div>

      <div className="card">
        <h2>useToggly</h2>
        <ul>
          <li>
            isReady:{' '}
            <span className={toggly.isReady ? 'on' : 'off'}>
              {String(toggly.isReady)}
            </span>
          </li>
          <li>
            isLoading:{' '}
            <span className="muted">{String(toggly.isLoading)}</span>
          </li>
          <li>
            identity: <code>{toggly.identity ?? '(none)'}</code>
          </li>
          <li>
            error:{' '}
            {toggly.error ? (
              <span className="off">{toggly.error.message}</span>
            ) : (
              <span className="on">none</span>
            )}
          </li>
        </ul>
        <button type="button" onClick={() => void toggly.refresh()}>
          refresh
        </button>
      </div>
    </>
  )
}

export default function ClientHooksPage() {
  const hasKey = Boolean(process.env.NEXT_PUBLIC_TOGGLY_APP_KEY?.trim())

  if (!hasKey) {
    return (
      <>
        <h1>Client hooks</h1>
        <p className="muted">
          Provider is inactive without NEXT_PUBLIC_TOGGLY_APP_KEY — hooks are
          not mounted.
        </p>
      </>
    )
  }

  return (
    <>
      <h1>Client hooks</h1>
      <p>
        Each exported hook with loading / enabled state. Flags update live when
        the client WebSocket delivers a refresh.
      </p>
      <HooksDemo />
    </>
  )
}
