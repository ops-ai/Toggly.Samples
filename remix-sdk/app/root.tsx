import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from '@remix-run/react'
import { RemixTogglyProvider } from '@ops-ai/remix-toggly-client'
import { Layout, MissingKeyBanner } from './components/layout'
import { ENVIRONMENT, hasServerKey, sampleLoader } from './lib/toggly.server'
import './styles.css'

export async function loader({ request }: LoaderFunctionArgs) {
  // Hydration is optional. A missing key is not an exception: learners can read
  // every page and see safe OFF defaults before configuring a real application.
  const serverConfigured = hasServerKey()
  const loadedContext = serverConfigured ? await sampleLoader().load({ request, params: {}, context: {} }) : undefined
  // The server SDK context includes its source appKey. The browser receives its
  // independently configured public key, so never serialize the server key.
  const serverContext = loadedContext ? { ...loadedContext, appKey: undefined } : undefined
  return json({ serverContext, publicKey: process.env.REMIX_PUBLIC_TOGGLY_APP_KEY, serverConfigured, environment: ENVIRONMENT })
}

export default function App() {
  const data = useLoaderData<typeof loader>()
  return <html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><Meta /><Links /></head><body><RemixTogglyProvider fallbackContext={data.serverContext} config={{ appKey: data.publicKey, environment: data.environment }}><Layout><MissingKeyBanner publicKey={data.publicKey} serverConfigured={data.serverConfigured} /><Outlet /></Layout></RemixTogglyProvider><ScrollRestoration /><Scripts /></body></html>
}
