'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  FILTER_CLAIMS_COOKIE,
  FILTER_COUNTRY_COOKIE,
  FILTER_LANG_COOKIE,
  FILTER_UA_COOKIE,
  FILTER_VIP_COOKIE,
  type ClaimsPreset,
  type FilterEvalCookieBag,
} from '@/lib/filter-eval-cookies'

const TOGGLY_IDENTITY_COOKIE = 'toggly-identity'

const CHROME_MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const FIREFOX_WIN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'

function setCookie(name: string, value: string) {
  if (value) {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`
  } else {
    document.cookie = `${name}=; path=/; Max-Age=0; SameSite=Lax`
  }
}

export function FilterContextControls({
  current,
}: {
  current: FilterEvalCookieBag
}) {
  const router = useRouter()
  const [identity, setIdentity] = useState(current.identity ?? '')
  const [claimsPreset, setClaimsPreset] = useState<ClaimsPreset>(
    current.claimsPreset ?? 'none',
  )
  const [country, setCountry] = useState(current.country ?? 'US')
  const [userAgent, setUserAgent] = useState(current.userAgent ?? CHROME_MAC_UA)
  const [acceptLanguage, setAcceptLanguage] = useState(
    current.acceptLanguage ?? 'en-US,en;q=0.9',
  )
  const [vip, setVip] = useState(current.vip ?? true)

  function apply() {
    setCookie(TOGGLY_IDENTITY_COOKIE, identity.trim())
    setCookie(FILTER_CLAIMS_COOKIE, claimsPreset === 'none' ? '' : claimsPreset)
    setCookie(FILTER_COUNTRY_COOKIE, country.trim())
    setCookie(FILTER_UA_COOKIE, userAgent.trim())
    setCookie(FILTER_LANG_COOKIE, acceptLanguage.trim())
    setCookie(FILTER_VIP_COOKIE, vip ? '1' : '0')
    router.refresh()
  }

  return (
    <div className="card">
      <h2>Eval context controls</h2>
      <p>
        Cookies feed per-call <code>FeatureCheckOptions</code> (identity,
        claims, headers, Order entity). They do not mutate process-wide{' '}
        <code>client.identity</code>.
      </p>
      <div className="filter-controls">
        <label>
          Identity
          <input
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            placeholder="alice"
          />
        </label>
        <label>
          Claims
          <select
            value={claimsPreset}
            onChange={(e) => setClaimsPreset(e.target.value as ClaimsPreset)}
          >
            <option value="none">(none)</option>
            <option value="admin">role=admin</option>
            <option value="user">role=user</option>
          </select>
        </label>
        <label>
          Country (cf-ipcountry)
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="US"
          />
        </label>
        <label>
          Accept-Language
          <input
            value={acceptLanguage}
            onChange={(e) => setAcceptLanguage(e.target.value)}
          />
        </label>
        <label>
          User-Agent
          <textarea
            value={userAgent}
            onChange={(e) => setUserAgent(e.target.value)}
            rows={3}
          />
        </label>
        <label className="filter-checkbox">
          <input
            type="checkbox"
            checked={vip}
            onChange={(e) => setVip(e.target.checked)}
          />
          Order Vip (ord-vip vs ord-standard)
        </label>
      </div>
      <div className="filter-presets">
        <button type="button" onClick={() => setUserAgent(CHROME_MAC_UA)}>
          UA: Chrome Mac
        </button>
        <button type="button" onClick={() => setUserAgent(FIREFOX_WIN_UA)}>
          UA: Firefox Win
        </button>
        <button
          type="button"
          onClick={() => {
            setIdentity('alice')
            setClaimsPreset('admin')
            setCountry('US')
            setAcceptLanguage('en-US,en;q=0.9')
            setUserAgent(CHROME_MAC_UA)
            setVip(true)
          }}
        >
          Matching preset
        </button>
        <button
          type="button"
          onClick={() => {
            setIdentity('bob')
            setClaimsPreset('user')
            setCountry('CA')
            setAcceptLanguage('fr-FR,fr;q=0.9')
            setUserAgent(FIREFOX_WIN_UA)
            setVip(false)
          }}
        >
          Non-matching preset
        </button>
        <button type="button" onClick={apply}>
          Apply & refresh
        </button>
      </div>
    </div>
  )
}
