import { useLoaderData, type LoaderFunctionArgs } from 'react-router'
import { filterResultLabel, hasFlagDefinition } from '../lib/filter-results.mjs'
import { FILTER_ROWS, MATCHING_HEADERS, NON_MATCHING_HEADERS, ORDERS } from '../lib/sample-data'
import { hasServerKey, sampleLoader } from '../lib/toggly.server'

export async function loader({ request }: LoaderFunctionArgs) {
  const preset = new URL(request.url).searchParams.get('preset') === 'non-matching' ? 'non-matching' : 'matching'
  const headers = preset === 'matching' ? MATCHING_HEADERS : NON_MATCHING_HEADERS
  if (!hasServerKey()) {
    return { preset, configured: false, results: Object.fromEntries(FILTER_ROWS.map(([key]) => [key, 'missing'])) }
  }
  const client = sampleLoader().getClient()
  const order = preset === 'matching' ? ORDERS[0] : ORDERS[1]
  client.registerContext('Order', (value: typeof order) => ({
    kind: 'Order',
    key: value.id,
    attributes: { Vip: value.vip, Total: value.total },
  }))
  await client.init()
  const known = client.getFlags()
  const context = {
    identity: preset === 'matching' ? 'alice' : 'bob',
    claims: { role: preset === 'matching' ? 'admin' : 'user' },
    request: {
      country: headers['cf-ipcountry'],
      userAgent: headers['user-agent'],
      acceptLanguage: headers['accept-language'],
    },
  }
  const results = Object.fromEntries(
    await Promise.all(FILTER_ROWS.map(async ([key]) => {
      const present = hasFlagDefinition(known, key)
      const enabled = present ? await client.isEnabled(key, context, false, order, 'Order') : false
      return [key, filterResultLabel(present, enabled)]
    })),
  )
  return { preset, configured: true, results }
}

export default function Filters() {
  const page = useLoaderData<typeof loader>()
  return (
    <>
      <h1>Filters matrix</h1>
      <p><a href="?preset=matching">Matching preset</a> · <a href="?preset=non-matching">Non-matching preset</a></p>
      <table>
        <thead>
          <tr><th>Flag</th><th>Rule</th><th>Expected inputs</th><th>Result</th></tr>
        </thead>
        <tbody>
          {FILTER_ROWS.map(([key, rule, inputs]) => (
            <tr key={key}>
              <td><code>{key}</code></td>
              <td>{rule}</td>
              <td>{inputs}</td>
              <td>{page.results[key]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        The server package supports all rows through local definitions evaluation with per-call identity, claims,
        request fields, and Order context. Browser provider hooks expose identity/claims and entity context, but no API
        lets this page inject arbitrary User-Agent, Accept-Language, or country into an already-running browser.
        Browser filter verification therefore requires a real browser request and dashboard setup; this preset page is
        a server-only teaching surface.
      </p>
    </>
  )
}
