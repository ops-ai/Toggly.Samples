import 'reflect-metadata';
import { Controller, Get, Header, Inject, Module, Req, UseGuards } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  TogglyModule,
  TogglyService,
  TogglyProvider,
  FeatureFlag,
  FeatureFlagGuard,
  FeatureEnabled,
  type Hook,
} from '@ops-ai/toggly-nestjs';
import { inputs, keys, filters } from './catalog.js';
import { page } from './view.js';
export interface SampleOptions {
  appKey?: string;
  environment?: string;
  fixtureUrl?: string;
  hooks?: Hook[];
}

export async function createApp({
  appKey = '',
  environment = 'Production',
  fixtureUrl,
  hooks = [],
}: SampleOptions = {}) {
  const offline = Boolean(fixtureUrl);
  const configured = Boolean(appKey && appKey !== 'ci-placeholder');
  @Controller()
  class Showcase {
    constructor(
      @Inject(TogglyService) private readonly toggly: TogglyService,
      @Inject(TogglyProvider) private readonly provider: TogglyProvider,
    ) {}
    private source() {
      const state = this.provider.state;
      if (offline) return 'Offline fixture — real package evaluation, no live Toggly connection';
      if (!configured) return 'Missing app key — defaults only; no network';
      if (state.error)
        return `${state.definitions.size ? 'Cached' : 'Unavailable'} — definition refresh failed`;
      return 'Live definitions — signature verified';
    }
    // Each flag evaluation receives both the request's context and this Order.
    // Keys and entity kind/property names are case-sensitive contracts with Toggly.
    private async evaluate(req: any) {
      return Object.fromEntries(
        await Promise.all(
          keys.map(async (key) => [
            key,
            await this.toggly.isFeatureOn(key, { entity: inputs(req).order }),
          ]),
        ),
      );
    }
    @Get('api/evaluate')
    @Header('Cache-Control', 'no-store')
    async evaluated(@Req() req: any) {
      return {
        source: this.source(),
        context: await this.toggly.context(),
        order: inputs(req).order,
        flags: await this.evaluate(req),
      };
    }
    @Get('api/override')
    @Header('Cache-Control', 'no-store')
    async override() {
      // The override affects one call; bob's ambient context remains bob afterward.
      return {
        ambientBefore: await this.toggly.isFeatureOn('filter-targeting'),
        override: await this.toggly.isFeatureOn('filter-targeting', {
          context: { identity: 'alice' },
        }),
        ambientAfter: await this.toggly.isFeatureOn('filter-targeting'),
        identity: (await this.toggly.context()).identity,
      };
    }
    @Get('api/features')
    @Header('Cache-Control', 'no-store')
    // This diagnostic snapshot uses initialization context; personalized decisions use /api/evaluate.
    features() {
      return { source: this.source(), sharedSnapshot: this.provider.state.features };
    }
    @Get('api/health')
    @Header('Cache-Control', 'no-store')
    // Initialized includes fallback startup, so report degraded state independently.
    health() {
      return {
        initialized: this.provider.state.initialized,
        degraded: Boolean(this.provider.state.error),
        lastRefresh: this.provider.state.lastRefresh,
        source: this.source(),
      };
    }
    // These are rollout guards. Add authentication and authorization independently.
    @Get('gates/enabled') @UseGuards(FeatureFlagGuard) @FeatureFlag('new-dashboard') enabled() {
      return { result: 'dashboard v2' };
    }
    @Get('gates/negate')
    @UseGuards(FeatureFlagGuard)
    @FeatureFlag('api-v2', { negate: true })
    negate() {
      return { result: 'legacy API' };
    }
    @Get('gates/all') @UseGuards(FeatureFlagGuard) @FeatureFlag(['new-dashboard', 'api-v2']) all() {
      return { result: 'all' };
    }
    @Get('gates/any')
    @UseGuards(FeatureFlagGuard)
    @FeatureFlag(['new-dashboard', 'api-v2'], { requirement: 'any' })
    any() {
      return { result: 'any' };
    }
    @Get('gates/beta')
    @UseGuards(FeatureFlagGuard)
    @FeatureFlag('beta-access', { disabledStatus: 403 })
    beta() {
      return { result: 'beta' };
    }
    @Get('unique/parameter') parameter(@FeatureEnabled('enhanced-submit') enabled: boolean) {
      return { enhancedSubmit: enabled };
    }
    @Get([
      '',
      'home',
      'declarative',
      'programmatic',
      'identity',
      'entity',
      'filters',
      'unique',
      'configuration',
    ])
    @Header('Content-Type', 'text/html; charset=utf-8')
    @Header('Cache-Control', 'no-store')
    async index(@Req() req: any) {
      return page({
        section: req.path.slice(1) || 'home',
        source: this.source(),
        context: await this.toggly.context(),
        order: inputs(req).order,
        flags: await this.evaluate(req),
        filters,
        query: new URLSearchParams(req.query).toString(),
      });
    }
  }
  @Module({
    imports: [
      TogglyModule.forRoot<any>({
        // No fake live credentials: fixture marker is sent only to the loopback server.
        appKey: offline ? 'offline-fixture' : configured ? appKey : undefined,
        environment,
        baseUrl: fixtureUrl,
        verifySignatures: !offline,
        enableStreaming: configured && !offline,
        refreshInterval:
          configured && !offline ? Number(process.env.TOGGLY_REFRESH_INTERVAL_MS || 180000) : 0,
        timeout: 3000,
        registerContextsOnStartup: false,
        hooks,
        enableUsageTracking: configured && !offline,
        enableMetrics: configured && !offline,
        usageFlushInterval:
          configured && !offline ? Number(process.env.TOGGLY_USAGE_FLUSH_INTERVAL_MS || 60000) : 0,
        contextFactory(req) {
          // Demo controls are explicitly untrusted. Production applications read their
          // authenticated principal and trusted proxy metadata instead of query fields.
          const input = inputs(req);
          return {
            identity: input.identity,
            groups: input.role === 'admin' ? ['staff'] : [],
            claims: { role: input.role },
            request: {
              country: input.preset?.country ?? req.get('cf-ipcountry'),
              acceptLanguage: input.preset?.language ?? req.get('accept-language'),
              userAgent: input.preset?.agent ?? req.get('user-agent'),
            },
          };
        },
      }),
    ],
    controllers: [Showcase],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, { logger: false });
  // Core resources belong to the singleton provider; close flushes telemetry and
  // releases refresh timers/socket. Request-scoped providers have no shutdown hook.
  app.enableShutdownHooks();
  await app.init();
  return app;
}
