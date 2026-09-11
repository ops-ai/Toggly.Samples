import type { Metadata } from 'next'
import { Nav } from '@/components/nav'
import { MissingKeyBanner } from '@/components/missing-key-banner'
import { initSampleToggly } from '@/lib/toggly'
import './globals.css'

export const metadata: Metadata = {
  title: 'Next.js SDK Showcase',
  description:
    'Server, Client, and Edge demos for @ops-ai/nextjs-toggly packages',
}

/** Always render from the live server client (WS-updated), never a static shell. */
export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Establish application configuration for rendering. Actions and API handlers
  // also initialize themselves because they can run independently of this layout.
  await initSampleToggly()

  return (
    <html lang="en">
      <body>
        <Nav />
        <main>
          <MissingKeyBanner />
          {children}
        </main>
      </body>
    </html>
  )
}
