import { gunzipSync } from 'node:zlib';
import { expect, test, type Page, type Request } from '@playwright/test';

type Packet = {
  k?: string;
  e?: string;
  u?: string;
  i?: string;
  f?: Record<string, Record<string, number[]>>;
  m?: Record<string, number>;
};

const urls = {
  enabled: 'http://127.0.0.1:4183',
  keyless: 'http://127.0.0.1:4184',
  optedOut: 'http://127.0.0.1:4185',
};

function decodePacket(request: Request): Packet {
  const body = request.postDataBuffer();
  if (!body) throw new Error('Telemetry POST has no request body');
  const decoded = request.headers()['content-encoding'] === 'gzip' ? gunzipSync(body) : body;
  return JSON.parse(decoded.toString('utf8')) as Packet;
}

async function captureTelemetry(page: Page, packets: Packet[]) {
  await page.route('https://metrics.toggly.io/**', async (route) => {
    expect(route.request().method()).toBe('POST');
    packets.push(decodePacket(route.request()));
    await route.fulfill({ status: 202, body: '' });
  });
  // Never let the browser test use production definitions or WebSocket hosts.
  await page.route('https://definitions.toggly.io/**', async (route) => {
    await route.fulfill({ status: 200, json: {} });
  });
  await page.routeWebSocket('wss://definitions.toggly.io/**', (socket) => {
    socket.close({ code: 1000, reason: 'isolated sample browser test' });
  });
}

function effectiveChecks(packets: Packet[], identity: string) {
  return packets
    .filter((packet) => packet.u === identity)
    .reduce(
      (sum, packet) =>
        sum +
        Object.values(packet.f ?? {}).reduce(
          (features, variants) =>
            features +
            Object.values(variants).reduce(
              (variantTotal, counts) => variantTotal + (counts[0] ?? 0),
              0,
            ),
          0,
        ),
      0,
    );
}

function eventCount(packets: Packet[], identity: string, index: 1 | 2) {
  return packets
    .filter((packet) => packet.u === identity)
    .reduce((sum, packet) => {
      const variants = packet.f?.['new-dashboard'] ?? {};
      return (
        sum + Object.values(variants).reduce((total, counts) => total + (counts[index] ?? 0), 0)
      );
    }, 0);
}

test('one layout reporter keeps queued Alice events across the route reconnect and attributes Bob separately', async ({
  page,
  request,
}) => {
  const packets: Packet[] = [];
  await captureTelemetry(page, packets);

  const html = await request.get(`${urls.enabled}/declarative?preset=matching`);
  expect(html.status()).toBe(200);
  expect(packets).toHaveLength(0);

  // Hold the browser entry until the SSR branch is visible. No browser packet
  // may be sent before hydration starts its layout-owned client.
  let releaseScripts!: () => void;
  const scriptGate = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  let scriptsReleased = false;
  await page.route(
    (url) => {
      const path = new URL(url).pathname;
      return (
        path.includes('/_app/immutable/entry/start.') || path.includes('/_app/immutable/entry/app.')
      );
    },
    async (route) => {
      if (!scriptsReleased) await scriptGate;
      await route.continue();
    },
  );
  const navigation = page.goto(`${urls.enabled}/declarative?preset=matching`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByTestId('dashboard-on')).toBeVisible();
  expect(packets).toHaveLength(0);
  scriptsReleased = true;
  releaseScripts();
  await navigation;
  await expect(page.getByTestId('telemetry-identity')).toHaveText('alice');
  await expect(page.getByTestId('dashboard-off')).toHaveCount(0);

  // Drain the automatic direct and declarative checks before measuring an
  // explicit-only action. The usage/view/metrics calls must not evaluate flags.
  await page.getByTestId('flush-browser-telemetry').click();
  await expect.poll(() => packets.length).toBeGreaterThan(0);
  const aliceChecksBeforeExplicit = effectiveChecks(packets, 'alice');
  expect(aliceChecksBeforeExplicit).toBeGreaterThan(0);

  await page.getByTestId('queue-browser-telemetry').click();
  await expect(page.getByTestId('telemetry-status')).toContainText('alice');
  await page.getByTestId('flush-browser-telemetry').click();
  await expect.poll(() => eventCount(packets, 'alice', 1)).toBe(1);
  expect(eventCount(packets, 'alice', 2)).toBe(1);
  expect(effectiveChecks(packets, 'alice')).toBe(aliceChecksBeforeExplicit);
  let alicePacket = packets.find(
    (packet) => packet.u === 'alice' && packet.m?.['sveltekit-demo-actions'],
  );
  expect(alicePacket).toMatchObject({ k: 'sveltekit-browser-test-key', e: 'Production' });
  expect(alicePacket?.m).toMatchObject({
    'sveltekit-demo-actions': 1,
    'sveltekit-demo-cart-size': 3,
  });
  expect(alicePacket).not.toHaveProperty('groups');
  expect(alicePacket).not.toHaveProperty('claims');

  // Queue under Alice, then let the real layout update its server snapshot and
  // reconnect for Bob before flushing. Accepted events keep their original u.
  await page.getByTestId('queue-browser-telemetry').click();
  await page.getByRole('link', { name: 'Identity', exact: true }).click();
  await page.getByRole('button', { name: 'Non-matching · bob' }).click();
  await expect(page.getByTestId('telemetry-identity')).toHaveText('bob');
  const beforeReconnectFlush = packets.length;
  await page.getByTestId('flush-browser-telemetry').click();
  await expect.poll(() => packets.length).toBeGreaterThan(beforeReconnectFlush);
  await expect.poll(() => eventCount(packets, 'alice', 1)).toBe(2);
  expect(eventCount(packets, 'alice', 2)).toBe(2);
  const bobChecksBeforeExplicit = effectiveChecks(packets, 'bob');

  await page.getByTestId('queue-browser-telemetry').click();
  await page.getByTestId('flush-browser-telemetry').click();
  await expect.poll(() => eventCount(packets, 'bob', 1)).toBe(1);
  expect(eventCount(packets, 'bob', 2)).toBe(1);
  expect(effectiveChecks(packets, 'bob')).toBe(bobChecksBeforeExplicit);
  expect(packets.every((packet) => packet.k === 'sveltekit-browser-test-key')).toBe(true);

  // Leave one accepted event buffered. Exercise the public pagehide lifecycle
  // while the document is still alive so Playwright can observe the keepalive
  // request. Delivery during an actual document teardown is best-effort.
  await page.getByTestId('queue-browser-telemetry').click();
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  await expect.poll(() => eventCount(packets, 'bob', 1)).toBe(2);
  const packetsAfterPagehide = packets.length;
  await page.goto('about:blank');
  await page.waitForTimeout(100);
  expect(packets).toHaveLength(packetsAfterPagehide);
});

test('keyless SvelteKit browser telemetry remains silent', async ({ page }) => {
  const packets: Packet[] = [];
  await captureTelemetry(page, packets);
  await page.goto(`${urls.keyless}/programmatic?preset=matching`);
  await page.getByTestId('queue-browser-telemetry').click();
  await page.getByTestId('flush-browser-telemetry').click();
  await page.waitForTimeout(100);
  expect(packets).toEqual([]);
});

test('telemetry opt-out preserves the sample while sending no browser packets', async ({
  page,
}) => {
  const packets: Packet[] = [];
  await captureTelemetry(page, packets);
  await page.goto(`${urls.optedOut}/programmatic?preset=matching`);
  await expect(page.getByTestId('dashboard-result')).toContainText('Enabled');
  await page.getByTestId('queue-browser-telemetry').click();
  await page.getByTestId('flush-browser-telemetry').click();
  await page.waitForTimeout(100);
  expect(packets).toEqual([]);
});
