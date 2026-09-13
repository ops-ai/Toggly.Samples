import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'
import { hasServerKey, sampleAction, sampleLoader } from '../lib/toggly.server'

export async function loader(args: LoaderFunctionArgs) {
  if (!hasServerKey()) return json({ configured: false, single: false, any: false, negated: true })
  return (await sampleLoader()).run(args, async ({ client }: { client: any }) => json({ configured: true, single: await client.isEnabled('new-dashboard'), any: await client.evaluateGate(['new-dashboard', 'api-v2'], 'any'), negated: await client.evaluateGate(['new-dashboard', 'api-v2'], 'all', true) }))
}

export async function action(args: LoaderFunctionArgs) {
  if (!hasServerKey()) return json({ accepted: false, reason: 'Add TOGGLY_APP_KEY before testing an action gate.' }, { status: 503 })
  return (await sampleAction()).run(args, async (_request: unknown, toggly: { isEnabled: (key: string) => Promise<boolean>; context: { identity?: string } }) => json({ accepted: await toggly.isEnabled('enhanced-submit'), identity: toggly.context.identity || 'anonymous' }))
}
export default function Programmatic() { const data = useLoaderData<typeof loader>(); return <><h1>Programmatic API</h1><p><code>createTogglyLoader().run</code> provides a request-bound context. The raw client below demonstrates individual and multi-key checks.</p><pre>{JSON.stringify(data, null, 2)}</pre><Form method="post"><button>Try enhanced-submit action</button></Form><p>The action uses <code>createTogglyAction().run</code>; it remains a demonstration and does not confer authorization.</p></> }
