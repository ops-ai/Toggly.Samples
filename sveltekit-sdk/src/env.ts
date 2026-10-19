import { defineEnvVars } from '@sveltejs/kit/env';

const emptyKey = (input: string | undefined) => input ?? '';
const environmentName = (input: string | undefined) => input?.trim() || 'Production';

// Empty app keys keep keyless offline teaching mode working without extra guards.
export const variables = defineEnvVars({
  TOGGLY_APP_KEY: { schema: emptyKey },
  TOGGLY_ENVIRONMENT: { schema: environmentName },
  PUBLIC_TOGGLY_APP_KEY: { public: true, schema: emptyKey },
  PUBLIC_TOGGLY_ENVIRONMENT: { public: true, schema: environmentName },
  PUBLIC_TOGGLY_ENABLE_TELEMETRY: { public: true, schema: emptyKey },
});
