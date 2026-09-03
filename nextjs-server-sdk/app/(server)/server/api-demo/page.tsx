import { ApiDemoClient } from '@/components/api-demo-client'

export default function ApiDemoPage() {
  return (
    <>
      <h1>API demo</h1>
      <p>
        Toggle <code>api-v2</code>, wait ~5s or hard-refresh, then fetch again
        (version 1 ↔ 2).
      </p>
      <ApiDemoClient />
    </>
  )
}
