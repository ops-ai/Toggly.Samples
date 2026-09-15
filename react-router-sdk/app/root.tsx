import { RouterTogglyProvider, TOGGLY_LOADER_KEY } from '@ops-ai/react-router-toggly/client'
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from 'react-router'
import type { Route } from './+types/root'
import { Layout as SampleLayout, MissingKeyBanner } from './components/layout'
import { ENVIRONMENT, hasServerKey, publicServerContext, sampleLoader } from './lib/toggly.server'
import './styles.css'

export function meta() {
  return [{ title: 'React Router SDK Sample' }]
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export async function loader({ request }: Route.LoaderArgs) {
  // Hydration is optional. A missing key is not an exception: learners can read
  // every page and see safe OFF defaults before configuring a real application.
  const serverConfigured = hasServerKey()
  if (!serverConfigured) {
    return { serverConfigured, environment: ENVIRONMENT }
  }

  try {
    const loaded = await sampleLoader().getLoaderData({ request }, {
      serverConfigured,
      environment: ENVIRONMENT,
    })
    // The server SDK context includes its source appKey. The browser receives
    // its independently configured public key (VITE_TOGGLY_APP_KEY only).
    return {
      ...loaded,
      [TOGGLY_LOADER_KEY]: publicServerContext(loaded[TOGGLY_LOADER_KEY]),
    }
  } catch (error) {
    console.warn('[React Router SDK sample] Failed to load Toggly context', error)
    return { serverConfigured, environment: ENVIRONMENT }
  }
}

export default function App() {
  const data = useLoaderData<typeof loader>()
  return (
    <RouterTogglyProvider
      routeId="root"
      config={{
        // Never read TOGGLY_APP_KEY in the browser bundle.
        appKey: import.meta.env.VITE_TOGGLY_APP_KEY,
        environment: import.meta.env.VITE_TOGGLY_ENVIRONMENT || data.environment || 'Production',
      }}
    >
      <SampleLayout>
        <MissingKeyBanner publicKey={import.meta.env.VITE_TOGGLY_APP_KEY} serverConfigured={data.serverConfigured} />
        <Outlet />
      </SampleLayout>
    </RouterTogglyProvider>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!'
  let details = 'An unexpected error occurred.'
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error'
    details = error.status === 404 ? 'The requested page could not be found.' : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main>
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && <pre><code>{stack}</code></pre>}
    </main>
  )
}
