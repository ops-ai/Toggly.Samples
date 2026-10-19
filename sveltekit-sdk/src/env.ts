import { defineEnvVars } from '@sveltejs/kit/env';

// Empty-string fallbacks keep keyless offline teaching mode working without extra guards.
export const variables = defineEnvVars({
  TOGGLY_APP_KEY: { schema: (input) => input ?? '' },
  TOGGLY_ENVIRONMENT: { schema: (input) => input ?? '' },
  PUBLIC_TOGGLY_APP_KEY: { public: true, schema: (input) => input ?? '' },
  PUBLIC_TOGGLY_ENVIRONMENT: { public: true, schema: (input) => input ?? '' },
  PUBLIC_TOGGLY_ENABLE_TELEMETRY: { public: true, schema: (input) => input ?? '' },
});
