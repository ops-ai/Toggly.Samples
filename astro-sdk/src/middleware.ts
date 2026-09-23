import { defineMiddleware } from 'astro:middleware';
import { createTogglyMiddleware } from '@ops-ai/astro-feature-flags-toggly/integration';
import { createTogglyOptions, createTogglyRequestContext } from './toggly-config';

/**
 * Request-scoped Toggly middleware.
 *
 * createTogglyMiddleware builds a fresh server client per request, refreshes
 * flags, attaches it to Astro.locals.toggly, and closes it when the response
 * finishes. Spreading identity/claims from the URL keeps targeting local to
 * this request — never call a process-wide setIdentity from here.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const runtimeEnvironment = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;

  const requestContext = createTogglyRequestContext(context.url);
  const middleware = createTogglyMiddleware({
    ...createTogglyOptions(
      import.meta.env.TOGGLY_APP_KEY,
      import.meta.env.TOGGLY_ENVIRONMENT ?? 'Production',
      runtimeEnvironment?.TOGGLY_BETA_ACCESS_DEFAULT !== 'false',
      import.meta.env.TOGGLY_DEFINITIONS_BASE_URI,
      import.meta.env.TOGGLY_METRICS_BASE_URL,
    ),
    identity: requestContext.identity,
    claims: requestContext.claims,
  });

  return middleware(context, async () => {
    // Package-unique surface: combine the x-feature manifest with a hard
    // server gate. The Markdown page still contributes beta-access to
    // toggly-page-features.json; middleware returns 404 when the flag is off.
    if (
      context.url.pathname === '/beta/' ||
      context.url.pathname === '/beta'
    ) {
      const allowed = await context.locals.toggly.getFlag('beta-access');
      if (!allowed) {
        return new Response('Beta access is disabled.', { status: 404 });
      }
    }

    const response = await next();
    response.headers.set('x-toggly-middleware', 'applied');
    response.headers.set(
      'x-toggly-identity',
      requestContext.identity ?? 'anonymous',
    );
    return response;
  });
});
