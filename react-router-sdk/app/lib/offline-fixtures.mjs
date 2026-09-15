export const matchingPreset = {
  identity: 'alice',
  claims: { role: 'admin' },
  request: { country: 'US', acceptLanguage: 'en-US,en;q=0.9', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  order: { id: 'ord-vip', vip: true, total: 275 },
}

export const nonMatchingPreset = {
  identity: 'bob',
  claims: { role: 'user' },
  request: { country: 'CA', acceptLanguage: 'fr-FR,fr;q=0.9', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0' },
  order: { id: 'ord-standard', vip: false, total: 85 },
}

// This is the exact domain-to-Toggly mapping used by the Order explanation.
export function orderContext(order) {
  return { kind: 'Order', key: order.id, attributes: { Vip: order.vip, Total: order.total } }
}
