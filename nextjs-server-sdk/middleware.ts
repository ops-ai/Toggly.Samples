import { createPathFeatureMiddleware } from '@ops-ai/nextjs-toggly-edge'
import { NextResponse } from 'next/server'

const appKey = process.env.TOGGLY_APP_KEY?.trim()

/**
 * Gates /edge/beta with beta-access → redirect to /edge/waitlist when off.
 * /edge, /edge/waitlist, /edge/unavailable stay reachable (not in matcher).
 */
export const middleware = appKey
  ? createPathFeatureMiddleware({
      config: {
        appKey,
        environment: process.env.TOGGLY_ENVIRONMENT?.trim() || 'Production',
        onError: (message, error) => {
          console.warn('[Toggly edge sample]', message, error)
        },
      },
      routes: [
        {
          path: '/edge/beta',
          feature: {
            featureKey: 'beta-access',
            redirectTo: '/edge/waitlist',
          },
        },
        {
          path: '/edge/beta/*',
          feature: {
            featureKey: 'beta-access',
            redirectTo: '/edge/waitlist',
          },
        },
      ],
    })
  : () => NextResponse.next()

export const config = {
  matcher: ['/edge/beta', '/edge/beta/:path*'],
}
