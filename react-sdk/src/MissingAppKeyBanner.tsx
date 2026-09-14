type MissingAppKeyBannerProps = {
  appKey: string | undefined
}

/**
 * Browser app keys are intentionally public configuration, but they are still
 * required. This banner keeps the walkthrough usable with false defaults while
 * telling the developer exactly which Vite variable must be set locally.
 */
export function MissingAppKeyBanner({ appKey }: MissingAppKeyBannerProps) {
  if (appKey?.trim()) return null

  return (
    <aside className="banner" role="alert">
      <strong>Connect this sample to Toggly.</strong>{' '}
      Add <code>VITE_TOGGLY_APP_KEY</code> to <code>.env.local</code>, then
      restart Vite. Until then, the provider uses safe local defaults (every
      demo flag is off) and does not make a remote request.
    </aside>
  )
}
