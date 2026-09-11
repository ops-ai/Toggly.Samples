'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const COOKIE = 'toggly-identity'

export function IdentitySwitcher({ current }: { current?: string }) {
  const router = useRouter()
  const [value, setValue] = useState(current ?? '')

  // A session cookie makes the next server render see this targeting key. Refresh
  // reruns Server Components; it does not call the browser SDK setIdentity hook
  // and does not authenticate a user. No expiry is set on a nonempty cookie.
  function setIdentity(next: string) {
    if (next) {
      document.cookie = `${COOKIE}=${encodeURIComponent(next)}; path=/; SameSite=Lax`
    } else {
      document.cookie = `${COOKIE}=; path=/; Max-Age=0; SameSite=Lax`
    }
    router.refresh()
  }

  return (
    <div className="card">
      <h2>Identity cookie</h2>
      <p>
        Sets <code>{COOKIE}</code> for per-call server checks. Does not mutate
        process-wide <code>client.identity</code>.
      </p>
      <p>
        Current: <code>{current || '(none)'}</code>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setIdentity(value.trim())
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="user-123"
          aria-label="Identity"
        />
        <button type="submit">Set</button>
        <button
          type="button"
          onClick={() => {
            setValue('')
            setIdentity('')
          }}
        >
          Clear
        </button>
      </form>
    </div>
  )
}
