import { createPathFeatureMiddleware } from '@ops-ai/nextjs-toggly-edge'
import { NextResponse } from 'next/server'

const appKey = process.env.TOGGLY_APP_KEY?.trim()

/**
 * Gates /edge/beta with beta-access → redirect to /edge/waitlist when off.
 * /edge, /edge/waitlist, /edge/unavailable stay reachable (not in matcher).
 */
// This published edge package fetches remote evaluated booleans and caches them
// (default TTL 60 seconds); it does not share the Node server's local definitions
// or WebSocket. Use a global beta-access toggle for this demonstration: 1.2.3
// assigns request identity on a shared client and can reuse cached results.
// This is not a safe reference for per-user authorization or isolated targeting.
// Without an App Key we deliberately allow the route so setup pages still work.
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

// Restrict invocation as well as route rules. The waitlist must remain outside
// this matcher or the disabled redirect could repeatedly gate its own destination.
export const config = {
  matcher: ['/edge/beta', '/edge/beta/:path*'],
}
