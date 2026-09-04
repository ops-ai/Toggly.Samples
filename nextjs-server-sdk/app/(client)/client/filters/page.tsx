import { headers } from 'next/headers'
import { isServerFeatureOn } from '@ops-ai/nextjs-toggly-server'
import { FILTER_CATALOG, CLIENT_FILTER_KEYS } from '@/lib/filter-catalog'
import { hasTogglyAppKey } from '@/lib/env'
import { initSampleToggly } from '@/lib/toggly'

/**
 * UA-driven filters for “this browser”: evaluate on the server with the
 * incoming User-Agent / Accept-Language. Browser-side `evaluationMode: 'local'`
 * against definitions.toggly.io is blocked from localhost without CORS.
 */
export default async function ClientFiltersPage() {
  if (!hasTogglyAppKey()) {
    return (
      <p>
        Set <code>TOGGLY_APP_KEY</code> / <code>NEXT_PUBLIC_TOGGLY_APP_KEY</code>{' '}
        for filter demos.
      </p>
    )
  }

  await initSampleToggly()
  const h = await headers()
  const userAgent = h.get('user-agent') ?? undefined
  const acceptLanguage = h.get('accept-language') ?? undefined

  const options = {
    headers: {
      ...(userAgent ? { 'user-agent': userAgent } : {}),
      ...(acceptLanguage ? { 'accept-language': acceptLanguage } : {}),
    },
  }

  const rows = await Promise.all(
    CLIENT_FILTER_KEYS.map(async (key) => {
      const entry = FILTER_CATALOG.find((e) => e.key === key)!
      const on = await isServerFeatureOn(key, options)
      return { entry, on }
    }),
  )

  return (
    <>
      <h1>Client filters (request UA)</h1>
      <p>
        These flags use Browser Family / Language / Device / OS filters.
        Results below are evaluated with this request&apos;s{' '}
        <code>User-Agent</code> and <code>Accept-Language</code> (server-side
        local eval). Full matrix with controllable overrides:{' '}
        <a href="/server/filters">/server/filters</a>.
      </p>
      <div className="card">
        <h2>Request headers</h2>
        <pre>
          {JSON.stringify({ userAgent, acceptLanguage }, null, 2)}
        </pre>
      </div>
      {rows.map(({ entry, on }) => (
        <div className="card" key={entry.key}>
          <h3>
            <code>{entry.key}</code>{' '}
            <span className={on ? 'on' : 'off'}>{on ? 'ON' : 'OFF'}</span>
          </h3>
          <p>
            <strong>{entry.title}</strong> — {entry.filter}
          </p>
          <p className="muted">{entry.blurb}</p>
        </div>
      ))}
    </>
  )
}
