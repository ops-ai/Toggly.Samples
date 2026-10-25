import { useEffect, useState } from 'react';
import {
  $flags,
  initTogglyClient,
  setIdentity,
} from '@ops-ai/astro-feature-flags-toggly/client/store';
import {
  liveSnapshotKeys,
  readLiveSnapshot,
  subscribeLiveSnapshot,
  type LiveSnapshot,
} from '../sample/live-flags.ts';
import { filterCatalog } from '../sample/catalog.ts';
import {
  createTogglyRequestContext,
  parseDocumentCookies,
} from '../toggly-config';

type Mode = 'snapshot' | 'filters';

/**
 * Client live snapshot / filter checklist.
 *
 * Hydrates against `/client/setup`. Subscribes to native `$flags` so SDK
 * background refresh (WebSocket / refreshFlags) updates the UI. The listener
 * only re-reads the store — it never issues its own fetch.
 */
export default function LiveFlagsIsland({ mode }: { mode: Mode }) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(() =>
    readLiveSnapshot($flags.get()),
  );

  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;

    const syncPresetToClientStore = async () => {
      const base = (
        window as Window & { __TOGGLY_CONFIG__?: Record<string, unknown> }
      ).__TOGGLY_CONFIG__;
      if (!base?.appKey) {
        if (!active) return;
        unsubscribe = subscribeLiveSnapshot($flags, setSnapshot);
        return;
      }

      const url = new URL(window.location.href);
      const cookies = parseDocumentCookies();
      const hasPreset =
        url.searchParams.has('preset') ||
        Boolean(cookies?.get('sample-preset')) ||
        Boolean(cookies?.get('toggly-preset'));
      const hasContextOverride =
        url.searchParams.has('identity') ||
        url.searchParams.has('role') ||
        url.searchParams.has('order');
      if (!hasPreset && !hasContextOverride && mode === 'snapshot') {
        if (!active) return;
        unsubscribe = subscribeLiveSnapshot($flags, setSnapshot);
        return;
      }

      const ctx = createTogglyRequestContext(url, { cookies });

      try {
        await initTogglyClient({
          ...base,
          identity: ctx.identity,
          claims: ctx.claims,
        });
      } catch {
        // Still subscribe so programmatic refresh / store updates can recover.
      }

      if (!active) return;

      if (ctx.identity) {
        setIdentity(ctx.identity);
      }

      unsubscribe = subscribeLiveSnapshot($flags, setSnapshot);
      setSnapshot(readLiveSnapshot($flags.get()));
    };

    void syncPresetToClientStore();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (mode === 'filters') {
    return (
      <table
        className="checklist"
        id="live-filter-checklist"
        data-testid="live-filter-checklist"
      >
        <thead>
          <tr>
            <th>Filter flag</th>
            <th>Client store</th>
          </tr>
        </thead>
        <tbody>
          {filterCatalog.map((row) => {
            const value = snapshot[row.key];
            return (
              <tr key={row.key} data-live-filter={row.key}>
                <td>
                  <code>{row.key}</code>
                </td>
                <td>
                  <span
                    className={`pill ${value ? 'on' : 'off'}`}
                    data-toggly-state={value ? 'on' : 'off'}
                  >
                    {String(value)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return (
    <table
      className="snapshot"
      id="live-snapshot"
      data-testid="live-snapshot-client"
    >
      <thead>
        <tr>
          <th>Key</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {liveSnapshotKeys.map((key) => {
          const value = snapshot[key];
          return (
            <tr key={key} data-live-flag={key}>
              <td>
                <code>{key}</code>
              </td>
              <td>
                <span
                  className={`pill ${value ? 'on' : 'off'}`}
                  data-toggly-state={value ? 'on' : 'off'}
                >
                  {String(value)}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
