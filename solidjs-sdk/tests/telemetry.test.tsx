import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { TogglyProvider, useToggly, type TogglyOptions } from '@ops-ai/solid-feature-flags-toggly';
import App from '../src/App';
import { defaults } from '../src/catalog';

afterEach(cleanup);

function Harness(props: {
  config: TogglyOptions;
  capture: (value: ReturnType<typeof useToggly>) => void;
}) {
  const toggly = useToggly();
  props.capture(toggly);
  return <p>{String(toggly.evaluate(['Visible']))}</p>;
}

function renderHarness(
  config: TogglyOptions,
  capture: (value: ReturnType<typeof useToggly>) => void,
) {
  return render(() => (
    <TogglyProvider config={config}>
      <Harness config={config} capture={capture} />
    </TogglyProvider>
  ));
}

describe('SolidJS published browser telemetry API', () => {
  it.each([
    ['keyless', { flagDefaults: { Visible: true } }],
    ['opted out', { appKey: 'sample-test-key', enableTelemetry: false }],
  ])('%s clients keep explicit telemetry calls inactive', async (name, config) => {
    const requests: unknown[] = [];
    let client: ReturnType<typeof useToggly> | undefined;
    renderHarness(
      {
        ...config,
        enableLiveUpdates: false,
        refreshInterval: 0,
        telemetryFetch: async (...request) => {
          requests.push(request);
          return { status: 202 };
        },
      },
      (value) => (client = value),
    );
    await screen.findByText(name === 'keyless' ? 'true' : 'false');
    client!.recordUsage('Visible');
    client!.recordView('Visible');
    client!.incrementCounter('orders');
    client!.setGauge('cart-items', 3);
    await client!.flushTelemetry();
    expect(requests).toEqual([]);
  });

  it('sends direct checks, explicit events, and business metrics through one client', async () => {
    const requests: Array<{
      url: string;
      init: Parameters<NonNullable<TogglyOptions['telemetryFetch']>>[1];
    }> = [];
    let client: ReturnType<typeof useToggly> | undefined;
    renderHarness(
      {
        appKey: 'sample-test-key',
        environment: 'Production',
        flagDefaults: { Visible: true },
        enableLiveUpdates: false,
        refreshInterval: 0,
        fetch: async () => new Response(null, { status: 404 }),
        telemetryFetch: async (url, init) => {
          requests.push({ url, init });
          return { status: 202 };
        },
      },
      (value) => (client = value),
    );
    await screen.findByText('true');
    client!.recordUsage('Visible', 'sample-control');
    client!.recordView('Visible');
    client!.incrementCounter('orders', 2);
    client!.setGauge('cart-items', 3);
    await client!.flushTelemetry();

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://metrics.toggly.io/api/frontend/telemetry');
    expect(requests[0].init).toMatchObject({ method: 'POST', credentials: 'omit' });
    expect(requests[0].init.headers['Content-Type']).toBe('application/json');
    const packet = decode(requests[0].init.body, requests[0].init.headers['Content-Encoding']);
    expect(packet).toMatchObject({
      k: 'sample-test-key',
      e: 'Production',
      f: {
        Visible: {
          enabled: [1, 0, 1],
          'sample-control': [0, 1],
        },
      },
      m: { orders: 2, 'cart-items': 3 },
    });
    expect(Object.keys(packet)).toEqual(['k', 'e', 'f', 'm']);
  });

  it('exposes the same explicit telemetry methods in the workshop without rechecking', async () => {
    const requests: Array<{
      url: string;
      init: Parameters<NonNullable<TogglyOptions['telemetryFetch']>>[1];
    }> = [];
    render(() => (
      <App
        config={{
          appKey: 'sample-test-key',
          environment: 'Production',
          flagDefaults: defaults,
          enableLiveUpdates: false,
          refreshInterval: 0,
          fetch: async () => new Response(null, { status: 404 }),
          telemetryFetch: async (url, init) => {
            requests.push({ url, init });
            return { status: 202 };
          },
        }}
      />
    ));
    await screen.findByText(/Snapshot available/);
    for (const label of ['Record usage', 'Record view', 'Add orders', 'Set active carts'])
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    screen.getByRole('button', { name: 'Record usage' }).click();
    screen.getByRole('button', { name: 'Record view' }).click();
    screen.getByRole('button', { name: 'Add orders' }).click();
    screen.getByRole('button', { name: 'Set active carts' }).click();
    screen.getByRole('button', { name: 'Flush telemetry' }).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(requests.length).toBeGreaterThan(0);
    const packets = requests.map(({ init }) => decode(init.body, init.headers['Content-Encoding']));
    expect(packets.flatMap((packet) => Object.keys(packet.m ?? {}))).toEqual(
      expect.arrayContaining(['orders', 'active-carts']),
    );
    expect(packets.flatMap((packet) => Object.keys(packet.f?.['new-dashboard'] ?? {}))).toContain(
      'sample-control',
    );
  });
});

function decode(body: string | ArrayBuffer, encoding?: string) {
  if (typeof body === 'string') return JSON.parse(body);
  if (encoding === 'gzip') {
    return JSON.parse(gunzipSync(Buffer.from(body)).toString('utf8'));
  }
  return JSON.parse(new TextDecoder().decode(body));
}
