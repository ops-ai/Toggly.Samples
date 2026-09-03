'use client'

import { TogglyProvider } from '@ops-ai/nextjs-toggly-client'

type ProvidersProps = {
  children: React.ReactNode
  initialFeatures?: Record<string, boolean>
}

export function Providers({ children, initialFeatures }: ProvidersProps) {
  const appKey = process.env.NEXT_PUBLIC_TOGGLY_APP_KEY?.trim()
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
