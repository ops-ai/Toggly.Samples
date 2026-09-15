import { data, Form, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { requestContext } from '../lib/toggly.server'

export function loader({ request }: LoaderFunctionArgs) {
  return { context: requestContext(request) }
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData()
  const identity = String(form.get('identity') || '').trim()
  return data({ ok: true }, {
    headers: { 'Set-Cookie': `toggly-identity=${encodeURIComponent(identity)}; Path=/; SameSite=Lax` },
  })
}

export default function Identity() {
  const page = useLoaderData<typeof loader>()
  return (
    <>
      <h1>Request-scoped identity</h1>
      <p>
        The form writes a demo session cookie. Every loader/action reads it into the SDK async evaluation context
        for that request; it never assigns it to a process-global client identity.
      </p>
      <Form method="post">
        <input name="identity" placeholder="alice" />
        <button>Set demo identity</button>
      </Form>
      <pre>{JSON.stringify(page.context, null, 2)}</pre>
      <p>
        Identity, claims, and headers are targeting inputs. Derive real values from trusted authentication,
        then perform authorization on the server independently. Demo identities are not auth.
      </p>
    </>
  )
}
