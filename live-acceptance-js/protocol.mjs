export const families = ['nest', 'solid', 'solidstart', 'sveltekit'];
export function configuration(env) {
  const family = env.LIVE_FAMILY;
  if (!families.includes(family))
    throw new Error('Select family with LIVE_FAMILY to nest, solid, solidstart or sveltekit');
  const backendKey = env.LIVE_BACKEND_KEY;
  const frontendKey = env.LIVE_FRONTEND_KEY;
  if (family !== 'solid' && !backendKey?.trim())
    throw new Error('Missing backend key environment input');
  if (family !== 'nest' && !frontendKey?.trim())
    throw new Error('Missing frontend key environment input');
  if (backendKey && backendKey === frontendKey)
    throw new Error('Backend and frontend keys must differ');
  const baseURI = env.LIVE_BASE_URL || 'https://definitions.toggly.io';
  const u = new URL(baseURI);
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname)
  )
    throw new Error('Live mode requires a remote HTTPS definitions endpoint');
  const timeout = Number(env.LIVE_TIMEOUT_MS || 180000);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 600000)
    throw new Error('LIVE_TIMEOUT_MS must be 1000..600000');
  const port = Number(env.LIVE_PORT || 0);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('LIVE_PORT must be 0..65535');
  return {
    port,
    family,
    backendKey,
    frontendKey,
    baseURI,
    environment: env.LIVE_ENVIRONMENT || 'Production',
    timeout,
  };
}
export function transition(s, expected) {
  return (
    s.value === expected && s.frame > 0 && s.fetch > s.frame && s.decision > s.fetch && !s.error
  );
}
export async function until(check, timeout = 15000, label = 'condition', signal) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    signal?.throwIfAborted();
    const result = await check();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error(`Timed out: ${label}`);
}
export function updateFrame(data) {
  try {
    const text = String(data);
    const m = ['update', 'flags-updated'].includes(text) ? { type: text } : JSON.parse(text);
    return ['update', 'flags-updated'].includes(m.type);
  } catch {
    return false;
  }
}
