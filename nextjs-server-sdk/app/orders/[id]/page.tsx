import { redirect } from 'next/navigation'

export default async function LegacyOrderDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/server/orders/${id}`)
}
