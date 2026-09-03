'use client'

import { useState } from 'react'
import {
  submitWithCheck,
  submitWithFeatureGate,
  submitWithGate,
} from '@/app/actions'

type Result = {
  path: string
  note: string
  message: string
  allowed?: boolean
}

export function ActionsForm() {
  const [checkResult, setCheckResult] = useState<Result | null>(null)
  const [gateResult, setGateResult] = useState<Result | null>(null)
  const [featureGateResult, setFeatureGateResult] = useState<Result | null>(
    null,
  )

  return (
    <div className="card">
      <form
        action={async (fd) => {
          setCheckResult(await submitWithCheck(fd))
        }}
      >
        <label>
          Note <input name="note" defaultValue="hello" />
        </label>
        <button type="submit">submitWithCheck</button>
      </form>
      {checkResult && <pre>{JSON.stringify(checkResult, null, 2)}</pre>}

      <form
        action={async (fd) => {
          setGateResult(await submitWithGate(fd))
        }}
      >
        <button type="submit">submitWithGate (withFeature)</button>
      </form>
      {gateResult && <pre>{JSON.stringify(gateResult, null, 2)}</pre>}

      <form
        action={async (fd) => {
          setFeatureGateResult(await submitWithFeatureGate(fd))
        }}
      >
        <label>
          Note <input name="note" defaultValue="gate" />
        </label>
        <button type="submit">
          submitWithFeatureGate (enhanced-submit + api-v2)
        </button>
      </form>
      {featureGateResult && (
        <pre>{JSON.stringify(featureGateResult, null, 2)}</pre>
      )}
    </div>
  )
}
