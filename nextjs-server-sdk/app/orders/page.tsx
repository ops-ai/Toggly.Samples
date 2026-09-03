import { redirect } from 'next/navigation'

export default function LegacyOrdersRedirect() {
  redirect('/server/orders')
}
