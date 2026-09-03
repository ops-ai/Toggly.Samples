import { redirect } from 'next/navigation'

export default function LegacyActionsRedirect() {
  redirect('/server/actions')
}
