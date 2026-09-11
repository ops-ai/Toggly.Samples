<?php

namespace Tests\Feature;

use App\Support\FlagCatalog;
use GuzzleHttp\Psr7\HttpFactory;
use GuzzleHttp\Psr7\Response;
use Tests\Support\FixtureTransport;
use Tests\Support\SignedFixture;
use Tests\TestCase;
use Toggly\FeatureManagement\Config\TogglySettings;
use Toggly\FeatureManagement\Core\FeatureManager;
use Toggly\FeatureManagement\Core\FeatureProvider;
use Toggly\FeatureManagement\Core\FeatureStateService;
use Toggly\FeatureManagement\Core\UsageStatsProvider;
use Toggly\FeatureManagement\Http\TogglyHttpClient;
use Toggly\Laravel\Storage\LaravelCacheSnapshotProvider;

final class NativeProviderTest extends TestCase
{
    public function test_platform_signed_definitions_and_native_cache_restore(): void
    {
        $fixture = new SignedFixture();
        $transport = new FixtureTransport([
            $fixture->response(FlagCatalog::definitions('all')),
        ], $fixture->jwks);
        [$provider, $manager, $usage, $settings, $http, $cache] = $this->native($transport, true);

        try {
            $provider->refreshFeatures(true);
            $this->assertTrue($provider->getDebugInfo()['loaded']);
            $this->assertTrue($manager->isEnabled('new-dashboard', ['identity' => 'alice']));
            $snapshot = $cache->getFeaturesSnapshot();
            $this->assertSame($fixture->kid, $snapshot['keyId']);
            $this->assertNotEmpty($snapshot['signedDefsJson']);

            // Restore through the real Laravel cache adapter and native signature
            // verification. The array cache belongs to this application request.
            $restored = new FeatureProvider($settings, $http, new FeatureStateService(), $cache);
            $this->assertTrue($restored->getDebugInfo()['loaded']);
            $this->assertCount(16, $restored->getAllFeatureDefinitions());
            $restored->shutdown();
        } finally {
            $provider->shutdown();
            $usage->flush();
        }
    }

    public function test_native_refresh_rejects_tampering_and_retains_last_verified_definition(): void
    {
        $fixture = new SignedFixture();
        $transport = new FixtureTransport([
            $fixture->response(FlagCatalog::definitions('all')),
            $fixture->response(FlagCatalog::definitions('all'), tamper: true),
        ], $fixture->jwks);
        [$provider, $manager, $usage] = $this->native($transport, true);

        try {
            $provider->refreshFeatures(true);
            $provider->refreshFeatures(true);

            $this->assertNotNull($provider->getDebugInfo()['last_error']);
            $this->assertTrue($manager->isEnabled('new-dashboard'));
        } finally {
            $provider->shutdown();
            $usage->flush();
        }
    }

    public function test_signed_mode_rejects_an_unsigned_definition_envelope(): void
    {
        $body = json_encode([
            'defs' => FlagCatalog::definitions('all'),
            'signature' => '',
            'kid' => '',
            'timestamp' => time(),
        ]);
        $transport = new FixtureTransport([new Response(200, [], $body)]);
        [$provider, , $usage] = $this->native($transport, true);

        try {
            $provider->refreshFeatures(true);
            $this->assertFalse($provider->getDebugInfo()['loaded']);
            $this->assertSame(0, $provider->getDebugInfo()['definitions_count']);
            $this->assertNotNull($provider->getDebugInfo()['last_error']);
        } finally {
            $provider->shutdown();
            $usage->flush();
        }
    }

    public function test_native_refresh_updates_definitions_and_releases_callbacks(): void
    {
        $transport = new FixtureTransport([
            new Response(200, [], json_encode(FlagCatalog::definitions('all'))),
            new Response(200, [], json_encode(FlagCatalog::definitions('off'))),
        ]);
        [$provider, $manager, $usage] = $this->native($transport, false);
        $state = $provider->getFeatureStateService();
        $onCount = 0;
        $offCount = 0;
        $onId = $state->whenFeatureTurnsOn('new-dashboard', function () use (&$onCount): void {
            $onCount++;
        });
        $offId = $state->whenFeatureTurnsOff('new-dashboard', function () use (&$offCount): void {
            $offCount++;
        });

        try {
            $provider->refreshFeatures(true);
            $this->assertTrue($manager->isEnabled('new-dashboard'));
            $provider->refreshFeatures(true);
            $this->assertFalse($manager->isEnabled('new-dashboard'));
            $this->assertSame(1, $onCount);
            $this->assertSame(1, $offCount);
            $this->assertTrue($state->unregisterFeatureStateChange('new-dashboard', $onId));
            $this->assertTrue($state->unregisterFeatureStateChange('new-dashboard', $offId));
            $state->updateFeatureState('new-dashboard', true);
            $this->assertSame(1, $onCount);
        } finally {
            $provider->shutdown();
            $usage->flush();
        }
    }

    public function test_sticky_percentage_does_not_mutate_the_other_identity(): void
    {
        $transport = new FixtureTransport([
            new Response(200, [], json_encode(FlagCatalog::definitions('mixed'))),
        ]);
        [$provider, $manager, $usage] = $this->native($transport, false);

        try {
            $provider->refreshFeatures(true);
            $alice = $manager->isEnabled('filter-percentage', ['identity' => 'alice']);
            for ($index = 0; $index < 10; $index++) {
                $manager->isEnabled('filter-percentage', ['identity' => 'bob']);
                $this->assertSame($alice, $manager->isEnabled('filter-percentage', ['identity' => 'alice']));
            }
        } finally {
            $provider->shutdown();
            $usage->flush();
        }
    }

    public function test_variants_use_only_initial_identity_and_keep_provider_state_separate(): void
    {
        $providers = [];
        foreach (['alice' => 'compact', 'bob' => 'classic'] as $identity => $name) {
            $payload = [
                'defs' => [
                    'new-dashboard' => [
                        'enabled' => true,
                        'variant' => $name,
                        'configurationValue' => ['heading' => $identity],
                    ],
                ],
            ];
            $transport = new FixtureTransport([new Response(200, [], json_encode($payload))]);
            [$provider, $manager, $usage] = $this->native($transport, false, $identity);
            $providers[] = [$provider, $manager, $usage];
            $provider->refreshFeatures(true);

            parse_str($transport->requests[0]->getUri()->getQuery(), $query);
            $this->assertSame(['userId' => $identity], $query);
            $this->assertSame($name, $manager->getVariant('new-dashboard')['name']);
            $this->assertSame(['heading' => $identity], $manager->getVariantValue('new-dashboard'));
            $this->assertNull($manager->getVariant('unknown-variant'));
        }

        try {
            $this->assertSame('compact', $providers[0][1]->getVariant('new-dashboard')['name']);
            $this->assertSame('classic', $providers[1][1]->getVariant('new-dashboard')['name']);
        } finally {
            foreach ($providers as [$provider, , $usage]) {
                $provider->shutdown();
                $usage->flush();
            }
        }
    }

    private function native(FixtureTransport $transport, bool $signed, ?string $identity = null): array
    {
        $settings = new TogglySettings([
            'app_key' => 'offline-fixture',
            'base_url' => 'https://fixture.invalid/',
            'environment' => 'Production',
            'use_signed_definitions' => $signed,
            'enable_live_updates' => false,
            'enable_variants' => $identity !== null,
            'identity' => $identity,
            'undefined_enabled_on_development' => false,
        ]);
        $http = new TogglyHttpClient($transport, new HttpFactory(), $settings->getBaseUrl());
        $cache = new LaravelCacheSnapshotProvider(
            cache: app('cache'),
            store: 'array',
            prefix: 'test-' . bin2hex(random_bytes(8)),
        );
        $provider = new FeatureProvider($settings, $http, new FeatureStateService(), $cache);
        $usage = new UsageStatsProvider($settings, $http);
        $manager = new FeatureManager($provider, $usage, $provider);

        return [$provider, $manager, $usage, $settings, $http, $cache];
    }
}
