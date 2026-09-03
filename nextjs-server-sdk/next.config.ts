import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  // Externalize ws so Turbopack does not rewrite the live WebSocket client.
  // Do not externalize @ops-ai/nextjs-toggly-server — it imports `next/cache`
  // and Node ESM cannot resolve that subpath outside the Next bundler.
  serverExternalPackages: ['ws'],
  turbopack: {
    root: path.join(__dirname),
  },
}

export default nextConfig
