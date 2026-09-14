import type { APIEvent } from '@solidjs/start/server';
import { requestScope } from '../../lib/flags.server';
export async function POST(event: APIEvent) {
  const body = await event.request.json();
  const scope = await requestScope(body.matching === true, event.request);
  try {
    // A server gate protects this code path even if the browser button is bypassed.
    // It is a rollout guard; real applications still authenticate and authorize users.
    await scope.requireFeature('enhanced-submit');
    return Response.json({ message: 'Enhanced submit branch ran on the server.' });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  } finally {
    scope.dispose();
  }
}
