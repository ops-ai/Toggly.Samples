import { redirect } from 'next/navigation'

export default function LegacyApiDemoRedirect() {
  redirect('/server/api-demo')
}
