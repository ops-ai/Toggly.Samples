import { getServerToggly } from '@ops-ai/nextjs-toggly-server'
import { hasTogglyAppKey } from '@/lib/env'
import { getRequestIdentity } from '@/lib/identity'

export async function FlagSnapshot() {
  if (!hasTogglyAppKey()) {
    return <p className="muted">Snapshot unavailable without App Key.</p>
  }

  const client = getServerToggly()
  if (!client) {
    return <p className="off">Toggly client not initialized.</p>
  }

  const identity = await getRequestIdentity()
  // This is process state for diagnosis, not a fresh evaluation for the cookie
  // shown above. Use a per-call helper for identity/Order-dependent decisions.
  // SDK initialization can generate a process identity even without a user cookie.
  const features = client.state.features
  const error = client.state.error

  return (
    <div className="card">
      <h2>Flag snapshot</h2>
      <p>
        Request identity (cookie): <code>{identity ?? '(none)'}</code>
      </p>
      <p>
        Process client.identity (SDK default, not request cookie):{' '}
        <code>{client.identity ?? '(none)'}</code>
      </p>
      <p>
        WebSocket:{' '}
        <span className={client.state.wsConnected ? 'on' : 'off'}>
          {client.state.wsConnected ? 'connected' : 'disconnected'}
        </span>
      </p>
      {error ? (
        <p className="off">Last error: {error.message}</p>
      ) : (
        <p className="on">No client error</p>
      )}
      <pre>{JSON.stringify(features, null, 2)}</pre>
    </div>
  )
}
