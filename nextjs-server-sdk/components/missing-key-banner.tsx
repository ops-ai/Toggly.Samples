import { hasTogglyAppKey } from '@/lib/env'

export function MissingKeyBanner() {
  if (hasTogglyAppKey()) return null
  return (
    <div className="banner" role="alert">
      Set <code>TOGGLY_APP_KEY</code> and{' '}
      <code>NEXT_PUBLIC_TOGGLY_APP_KEY</code> in <code>.env.local</code> (see{' '}
      <code>.env.example</code>) and restart <code>npm run dev</code>.
    </div>
  )
}
