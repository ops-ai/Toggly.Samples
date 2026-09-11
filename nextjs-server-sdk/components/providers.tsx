'use client'

import { TogglyProvider } from '@ops-ai/nextjs-toggly-client'

type ProvidersProps = {
  children: React.ReactNode
  initialFeatures?: Record<string, boolean>
}

export function Providers({ children, initialFeatures }: ProvidersProps) {
  const appKey = process.env.NEXT_PUBLIC_TOGGLY_APP_KEY?.trim()
  // NEXT_PUBLIC_ references are inlined at browser build time. TOGGLY_ENVIRONMENT
  // is a fallback in this source, but normal Next.js browser bundles cannot read
  // that server-only variable: set NEXT_PUBLIC_TOGGLY_ENVIRONMENT outside Production.
  const environment =
    process.env.NEXT_PUBLIC_TOGGLY_ENVIRONMENT?.trim() ||
    process.env.TOGGLY_ENVIRONMENT?.trim() ||
    'Production'

  if (!appKey) {
    return (
      <>
        <div className="banner" role="status">
          Set <code>NEXT_PUBLIC_TOGGLY_APP_KEY</code> in{' '}
          <code>.env.local</code> (same value as <code>TOGGLY_APP_KEY</code>)
          and restart <code>npm run dev</code> for client demos.
        </div>
        {children}
      </>
    )
  }

  // initialFeatures seeds boolean defaults, not definitions or an Order context.
  // autoInit starts the browser client; its default remote evaluation and identity
  // are independent of the server cookie. The initial snapshot may later change.
  return (
    <TogglyProvider
      config={{
        appKey,
        environment,
        onError: (message, error) => {
          console.warn('[Toggly client sample]', message, error)
        },
      }}
      initialFeatures={initialFeatures}
      autoInit
    >
      {children}
    </TogglyProvider>
  )
}
