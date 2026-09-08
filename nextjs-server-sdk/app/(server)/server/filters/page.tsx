import { isServerFeatureOn } from '@ops-ai/nextjs-toggly-server'
import { FilterContextControls } from '@/components/filter-context-controls'
import { SERVER_FILTER_CATALOG } from '@/lib/filter-catalog'
import { readFilterEvalCookieBag, readFilterEvalOptions } from '@/lib/filter-eval-from-cookies'
import { hasTogglyAppKey } from '@/lib/env'
import { initSampleToggly } from '@/lib/toggly'

export default async function ServerFiltersPage() {
  if (!hasTogglyAppKey()) {
    return <p>Configure App Key to evaluate filters.</p>
  }

  await initSampleToggly()
  const bag = await readFilterEvalCookieBag()
  const options = await readFilterEvalOptions()

  // Every row uses the same per-call inputs against a separately provisioned
  // filter flag. Parallel checks do not mutate shared identity. If a row is OFF,
  // compare its exact flag key, configured rule, and options before blaming the SDK.
  const rows = await Promise.all(
    SERVER_FILTER_CATALOG.map(async (entry) => {
      const on = await isServerFeatureOn(entry.key, options)
      return { entry, on }
    }),
  )

  return (
    <>
      <h1>Server filters matrix</h1>
      <p>
        One dedicated flag per supported filter. Adjust eval context below, then
        Apply — results use per-call{' '}
        <code>isServerFeatureOn(key, options)</code>.
      </p>

      <FilterContextControls current={bag} />

      <div className="card">
        <h2>Active options (debug)</h2>
        <pre>{JSON.stringify(options, null, 2)}</pre>
      </div>

      <div className="filter-matrix">
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
      </div>
    </>
  )
}
