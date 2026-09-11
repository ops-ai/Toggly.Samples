<?php

namespace Tests\Feature;

use Tests\TestCase;

class ShowcaseTest extends TestCase
{
    public function test_missing_key_boots_native_showcase_with_visible_offline_mode(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertSee('Offline fixture mode')
            ->assertSee('PHP Laravel SDK Sample');
    }

    public function test_all_sections_render_without_a_key(): void
    {
        foreach (['/', '/gates', '/api', '/identity', '/orders', '/filters', '/integrations'] as $path) {
            // PHP-FPM rebuilds the container per request; match that supported host lifetime.
            $this->refreshApplication();
            $this->get($path)->assertOk();
        }
    }

    public function test_matching_preset_uses_native_filters_and_preserves_known_gaps(): void
    {
        $json = $this->getJson('/api/snapshot')->assertOk()->json();

        $this->assertSame('alice', $json['identity']);
        $this->assertCount(16, $json['flags']);
        $this->assertTrue($json['flags']['filter-targeting']);
        $this->assertTrue($json['flags']['filter-user-claims']);
        $this->assertTrue($json['flags']['filter-os']);
        $this->assertFalse($json['flags']['filter-device-type']);
        $this->assertFalse($json['flags']['filter-context-property']);
        $this->assertFalse($json['flags']['ExpressCheckout']);
        $this->assertArrayNotHasKey('app_key', $json);
    }

    public function test_non_matching_request_keeps_its_own_identity_and_order(): void
    {
        $this->withSession(['demo.preset' => 'non-matching', 'demo.order' => 'standard']);
        $json = $this->getJson('/api/snapshot')->assertOk()->json();

        $this->assertSame('bob', $json['identity']);
        $this->assertSame('ord-standard', $json['order']['Id']);
        $this->assertFalse($json['flags']['filter-targeting']);
        $this->assertFalse($json['flags']['filter-user-claims']);
        $this->assertFalse($json['flags']['filter-country']);
        $this->assertTrue($json['flags']['filter-always-on']);
        $this->assertTrue($json['flags']['filter-time-window']);
    }

    public function test_native_route_gate_allows_alice(): void
    {
        $this->get('/native/beta')->assertOk()->assertSee('Native beta route');
    }

    public function test_native_route_gate_denies_bob(): void
    {
        $this->withSession(['demo.preset' => 'non-matching']);
        $this->get('/native/beta')->assertNotFound();
    }

    public function test_attribute_gate_denies_all_requirement_when_api_v2_is_off(): void
    {
        $this->get('/native/all')->assertStatus(403);
    }

    public function test_attribute_any_and_usage_execute_native_middleware(): void
    {
        $this->get('/native/any')->assertOk()->assertSee('Native Any attribute');
    }

    public function test_offline_off_scenario_denies_enhanced_post(): void
    {
        $this->withSession(['demo.scenario' => 'off']);
        $this->post('/actions/enhanced')->assertNotFound();
    }

    public function test_enhanced_post_is_server_gated(): void
    {
        $this->post('/actions/enhanced')->assertRedirect('/api');
        $this->assertSame('Enhanced submission accepted by the native route gate.', session('message'));
    }

    public function test_controls_validate_preset_and_order_instead_of_accepting_arbitrary_claims(): void
    {
        $this->postJson('/controls', ['preset' => 'admin-backdoor', 'order' => 'other'])
            ->assertUnprocessable();
    }

    public function test_missing_order_is_explicit_and_does_not_become_a_user_identity(): void
    {
        $this->withSession(['demo.order' => 'missing']);
        $json = $this->getJson('/api/snapshot')->assertOk()->json();

        $this->assertSame('alice', $json['identity']);
        $this->assertNull($json['order']);
        $this->assertFalse($json['flags']['ExpressCheckout']);
    }

    public function test_variants_are_parsed_for_the_initial_request_identity(): void
    {
        $this->withSession(['demo.preset' => 'non-matching']);
        $json = $this->getJson('/api/snapshot')->assertOk()->json();

        $this->assertSame('classic', $json['variant']['name']);
        $this->assertSame('bob', $json['variant']['configurationValue']['fixtureIdentity']);
    }
}
