'use client'

import { useState } from 'react'

export function ApiDemoClient() {
  const [payload, setPayload] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch again after a toggle: the API evaluates api-v2 on the server for this
  // request. This component only displays the payload; it does not decide which
  // API version to return and cannot protect the endpoint by hiding its button.
  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/data')
      const json = await res.json()
      if (!res.ok) {
        setError(JSON.stringify(json))
        setPayload(null)
        return
      }
      setPayload(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed')
    }
  }

  return (
    <div className="card">
      <button type="button" onClick={load}>
        GET /api/data
      </button>
      {error && <p className="off">{error}</p>}
      {payload != null && <pre>{JSON.stringify(payload, null, 2)}</pre>}
    </div>
  )
}
