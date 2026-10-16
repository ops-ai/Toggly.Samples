import { createFeatureGatedAction } from '@ops-ai/react-router-toggly/server'
import { data, Form, useActionData, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { hasServerKey, requestContext, sampleLoader, sampleOptions } from '../lib/toggly.server'

export async function loader(args: LoaderFunctionArgs) {
  if (!hasServerKey()) return { configured: false, single: false, any: false, negated: true }
  return sampleLoader().run(args, async ({ client }) => ({
    configured: true,
    single: await client.isEnabled('new-dashboard'),
    any: await client.evaluateGate(['new-dashboard', 'api-v2'], 'any'),
    negated: await client.evaluateGate(['new-dashboard', 'api-v2'], 'all', true),
  }))
}

export async function action(args: ActionFunctionArgs) {
  if (!hasServerKey()) {
    return data({ accepted: false, reason: 'Add TOGGLY_APP_KEY before testing an action gate.' }, { status: 503 })
  }
  // createFeatureGatedAction is the unique action-gate helper. It still is not
  // authorization — the disabled branch only demonstrates the evaluation result.
  return createFeatureGatedAction(
    {
      ...sampleOptions(),
      requiredFeatures: 'enhanced-submit',
      onFeatureDisabled: async (request) => ({
        accepted: false,
        identity: requestContext(request).identity || 'anonymous',
      }),
    },
    async (_actionArgs, toggly) => ({
      accepted: true,
      identity: toggly.context.identity || 'anonymous',
    }),
  )(args)
}

export default function Programmatic() {
  const loaderData = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  return (
    <>
      <h1>Programmatic API</h1>
      <p>
        <code>createTogglyLoader().run</code> provides a request-bound context.
        The raw client below demonstrates individual and multi-key checks.
      </p>
      <pre>{JSON.stringify(loaderData, null, 2)}</pre>
      <Form method="post"><button>Try enhanced-submit action</button></Form>
      {actionData ? <pre>{JSON.stringify(actionData, null, 2)}</pre> : null}
      <p>
        The action uses <code>createFeatureGatedAction</code> on <code>enhanced-submit</code>
        (the same request-scoped evaluation as <code>createTogglyAction().run</code>).
        It remains a demonstration and does not confer authorization.
      </p>
    </>
  )
}
