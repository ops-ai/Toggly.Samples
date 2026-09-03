import { ActionsForm } from '@/components/actions-form'

export default function ActionsPage() {
  return (
    <>
      <h1>Server Actions</h1>
      <p>
        Toggle <code>enhanced-submit</code> (and for the gate demo also{' '}
        <code>api-v2</code>), wait for WebSocket or hard-refresh, then submit.
      </p>
      <ActionsForm />
    </>
  )
}
