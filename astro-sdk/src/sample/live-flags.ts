import { demoKeys, filterKeys } from './catalog.ts';

/**
 * Keys shown in the Home live snapshot and client filter checklist.
 * Same list the SSR getFlags snapshot used to seed — client refresh re-reads
 * the native `$flags` store instead of issuing a second fetch.
 */
export const liveSnapshotKeys = [...demoKeys, ...filterKeys] as const;

export type LiveSnapshot = Record<(typeof liveSnapshotKeys)[number], boolean>;

export function readLiveSnapshot(
  flags: Record<string, unknown>,
): LiveSnapshot {
  return Object.fromEntries(
    liveSnapshotKeys.map((key) => [key, Boolean(flags[key])]),
  ) as LiveSnapshot;
}

/**
 * Subscribe to the published nanostores `$flags` atom.
 * Callback only re-reads the store — it must not call refreshFlags/fetch.
 * Returns the unsubscribe function (call on island destroy).
 */
export function subscribeLiveSnapshot(
  $flags: {
    subscribe: (listener: (flags: Record<string, unknown>) => void) => () => void;
  },
  onSnapshot: (snapshot: LiveSnapshot) => void,
): () => void {
  return $flags.subscribe((flags) => {
    onSnapshot(readLiveSnapshot(flags));
  });
}
