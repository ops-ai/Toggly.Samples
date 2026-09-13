import { Link, useLocation } from '@remix-run/react'
import type { ReactNode } from 'react'

const links = [
  ['/', 'Home'], ['gates', 'Declarative gates'], ['programmatic', 'Programmatic API'],
  ['identity', 'Identity'], ['orders', 'Order context'], ['filters', 'Filters'],
]

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  return <><header><Link to="/" className="brand">Toggly × Remix</Link><nav>{links.map(([to, label]) => <Link key={to} to={to} className={location.pathname === to ? 'active' : ''}>{label}</Link>)}</nav></header><main>{children}</main></>
}

export function MissingKeyBanner({ publicKey, serverConfigured }: { publicKey?: string; serverConfigured: boolean }) {
  if (publicKey && serverConfigured) return null
  return <aside className="banner"><strong>Configuration practice mode.</strong> {serverConfigured ? 'Set REMIX_PUBLIC_TOGGLY_APP_KEY to enable browser gates.' : publicKey ? 'Set TOGGLY_APP_KEY to enable loader/action examples.' : 'Set both keys in .env to connect to your app. This sample remains navigable and treats unknown flags as off.'}</aside>
}
