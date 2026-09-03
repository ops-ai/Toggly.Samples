'use client'

import { useState } from 'react'

export function ApiDemoClient() {
  const [payload, setPayload] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)

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
