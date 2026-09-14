import { query } from '@solidjs/router';
export const getFlags = query(async (matching: boolean) => {
  'use server';
  // SolidStart extracts this function to a server endpoint. The Node entrypoint
  // appears only inside the server module, never in the browser import graph.
  const { loadFlags } = await import('./flags.server');
  return loadFlags(matching);
}, 'showcase-flags');
