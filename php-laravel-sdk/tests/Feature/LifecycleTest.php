<?php

namespace Tests\Feature;

use App\Support\OfflineTransport;
use App\Support\TogglyRuntime;
use GuzzleHttp\Psr7\Response;
use Psr\Http\Client\ClientInterface;
use Tests\Support\FixtureTransport;
use Tests\TestCase;
use Toggly\FeatureManagement\Contracts\FeatureStateServiceInterface;
use Toggly\FeatureManagement\Core\MetricsService;
use Toggly\FeatureManagement\Core\UsageStatsProvider;

final class LifecycleTest extends TestCase
{
    public function test_blade_native_gates_and_variant_comparison_cover_three_scenarios(): void
    {
        $expectations = [
            'mixed' => ['dashboard-on', 'negate', 'any', 'variant-compact'],
            'all' => ['dashboard-on', 'any', 'all', 'component', 'variant-compact'],
            'off' => ['dashboard-off', 'negate', 'variant-compact'],
        ];
        $allMarkers = ['dashboard-on', 'dashboard-off', 'negate', 'any', 'all', 'component'];

        foreach ($expectations as $scenario => $visible) {
            $this->refreshApplication();
            $this->withSession(['demo.scenario' => $scenario]);
            $page = $this->get('/gates')->assertOk();

            foreach ($allMarkers as $marker) {
                $needle = 'data-gate="' . $marker . '"';
                if (in_array($marker, $visible, true)) {
                    $page->assertSee($needle, false);
                } else {
                    $page->assertDontSee($needle, false);
                }
            }
            $page->assertSee('data-gate="variant-compact"', false);
        }
    }

    public function test_every_shared_filter_result_is_native_for_both_presets(): void
    {
        foreach (['matching', 'non-matching'] as $preset) {
            $this->refreshApplication();
            $this->withSession(['demo.preset' => $preset]);
            $json = $this->getJson('/api/snapshot')->assertOk()->json();
            $matching = $preset === 'matching';

            foreach (['targeting', 'user-claims', 'country', 'browser-family', 'browser-language', 'os'] as $filter) {
                $this->assertSame($matching, $json['flags']['filter-' . $filter], $filter);
            }
            foreach (['always-on', 'time-window'] as $filter) {
                $this->assertTrue($json['flags']['filter-' . $filter]);
            }
            foreach (['device-type', 'context-property'] as $filter) {
                $this->assertFalse($json['flags']['filter-' . $filter]);
            }
            $this->assertIsBool($json['flags']['filter-percentage']);
            $this->assertTrue($json['facadeEnabled']);
            $this->assertFalse($json['unknownFlag']);
        }
    }

    public function test_session_control_is_csrf_protected_outside_unit_testing_bypass(): void
    {
        // Laravel skips CSRF only for the testing environment. Exercise the real
        // middleware with production mode and an absent token.
        $this->app->instance('env', 'production');
        $this->post('/controls', [
            'preset' => 'non-matching',
            'order' => 'standard',
            'scenario' => 'mixed',
        ])->assertStatus(419);
    }

    public function test_valid_control_changes_only_the_next_request_session_values(): void
    {
        $this->post('/controls', [
            'preset' => 'non-matching',
            'order' => 'standard',
            'scenario' => 'all',
        ])->assertRedirect('/identity');

        $this->assertSame('non-matching', session('demo.preset'));
        $this->assertSame('standard', session('demo.order'));
        $this->assertSame('all', session('demo.scenario'));
    }

    public function test_native_events_and_usage_are_released_after_rendering(): void
    {
        $this->get('/gates')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $runtime = app(TogglyRuntime::class);
        $count = $runtime->definitionChanges;
        $this->assertGreaterThan(0, $count);

        app(FeatureStateServiceInterface::class)->notifyDefinitionsChanged();
        $this->assertSame($count, $runtime->definitionChanges);
        $this->assertNull(app(UsageStatsProvider::class)->peekPayload());
        $this->assertNotEmpty(app(OfflineTransport::class)->telemetry);
    }

    public function test_denied_route_still_flushes_request_usage(): void
    {
        $this->withSession(['demo.preset' => 'non-matching']);
        $this->get('/native/beta')->assertNotFound();
        $this->assertNull(app(UsageStatsProvider::class)->peekPayload());
        $this->assertNotEmpty(app(OfflineTransport::class)->telemetry);
    }

    public function test_metric_action_uses_native_counter_and_clears_its_buffer(): void
    {
        $this->post('/actions/metric')->assertRedirect('/integrations');
        $this->assertNull(app(MetricsService::class)->peekPayload());
        $payloads = app(OfflineTransport::class)->telemetry;
        $this->assertStringContainsString('sample-clicks', json_encode($payloads));
    }

    public function test_invalid_definitions_show_unknown_without_leaking_configuration(): void
    {
        config(['toggly.app_key' => 'fixture-private-config']);
        $transport = new FixtureTransport([new Response(200, [], 'not-json')]);
        $this->app->instance(ClientInterface::class, $transport);

        $page = $this->get('/gates')->assertOk();
        $page->assertSee('Definitions unavailable');
        $page->assertDontSee('fixture-private-config');
        $page->assertDontSee('data-gate="dashboard-on"', false);
    }

    public function test_unsigned_definition_response_is_not_presented_as_success(): void
    {
        config(['toggly.app_key' => 'fixture-private-config']);
        $transport = new FixtureTransport([new Response(200, [], '{"defs":[]}')]);
        $this->app->instance(ClientInterface::class, $transport);

        $this->get('/')
            ->assertOk()
            ->assertSee('Definitions unavailable')
            ->assertSee('UNKNOWN')
            ->assertDontSee('fixture-private-config');
    }

    public function test_native_redirects_and_all_attribute_allowance(): void
    {
        $this->withSession(['demo.preset' => 'non-matching']);
        $this->get('/native/redirect')->assertRedirect('/gates');

        $this->refreshApplication();
        $this->get('/native/attribute-redirect')->assertRedirect('/gates');

        $this->refreshApplication();
        $this->withSession(['demo.scenario' => 'all']);
        $this->get('/native/all')->assertOk();
    }
}
