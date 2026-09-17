<?php
// Installed temporarily by native_acceptance.py. No test endpoint is installed by setup.
use Toggly\FeatureManagement\Config\TogglySettings;
use Toggly\FeatureManagement\Core\FeatureProvider;
use Toggly\FeatureManagement\Core\FeatureStateService;
use Toggly\FeatureManagement\Http\TogglyHttpClient;
use Toggly\WordPress\Http\WordPressHttpClient;
use Toggly\WordPress\Http\WordPressRequestFactory;
use TogglySample\Environment;

if (!Environment::offline()) {
    return;
}
$testRoot = dirname(__DIR__, 2);

if (defined('DOING_CRON') && DOING_CRON) {
    $GLOBALS['sample_cron_events'] = [];
    add_action('toggly_refresh_features', static function (): void {
        $runtime = $GLOBALS['toggly_sample'];
        $GLOBALS['sample_cron_events'][] = 'refresh';
        $GLOBALS['sample_cron_enabled'] = $runtime->enabled('new-dashboard');
        $GLOBALS['sample_cron_disabled'] = $runtime->enabled('not-a-feature');
    }, 20);
    add_action('toggly_send_stats', static function (): void {
        $GLOBALS['sample_cron_events'][] = 'stats';
    }, 20);
    register_shutdown_function(static function () use ($testRoot): void {
        $runtime = $GLOBALS['toggly_sample'];
        file_put_contents($testRoot . '/.runtime/native-cron-results.json', json_encode([
            'sapi' => PHP_SAPI,
            'script' => basename($_SERVER['SCRIPT_FILENAME']),
            'events' => $GLOBALS['sample_cron_events'],
            'enabled' => $GLOBALS['sample_cron_enabled'] ?? null,
            'disabled' => $GLOBALS['sample_cron_disabled'] ?? null,
            'refreshCount' => did_action('toggly_refresh_features'),
            'statsCount' => did_action('toggly_send_stats'),
            'lockReleased' => get_transient('doing_cron') === false,
            'refresh' => wp_get_scheduled_event('toggly_refresh_features'),
            'stats' => wp_get_scheduled_event('toggly_send_stats'),
            'transport' => $runtime->offlineTransport->requests,
            'error' => error_get_last(),
        ], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
    });
}

add_action('template_redirect', static function () use ($testRoot): void {
    $operation = $_GET['native_test'] ?? null;
    if (!is_string($operation)) {
        return;
    }
    $runtime = $GLOBALS['toggly_sample'];
    if ($operation === 'prepare_cron') {
        wp_clear_scheduled_hook('toggly_refresh_features');
        wp_clear_scheduled_hook('toggly_send_stats');
        delete_transient('doing_cron');
        @unlink($testRoot . '/.runtime/native-cron-results.json');
        $first = wp_schedule_event(time() - 20, 'toggly_refresh_interval', 'toggly_refresh_features', [], true);
        $second = wp_schedule_event(time() - 10, 'toggly_send_interval', 'toggly_send_stats', [], true);
        wp_send_json(['scheduled' => $first === true && $second === true]);
    }
    if ($operation === 'cron_status') {
        $path = $testRoot . '/.runtime/native-cron-results.json';
        if (!is_file($path)) {
            wp_send_json(['pending' => true], 202);
        }
        wp_send_json(json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR));
    }
    if ($operation !== 'signed') {
        wp_send_json(['error' => 'Unknown fixture operation'], 400);
    }

    $settings = new TogglySettings(array_merge(Environment::settings(), ['enable_live_updates' => false]));
    $http = new TogglyHttpClient(new WordPressHttpClient(), new WordPressRequestFactory(), $settings->getBaseUrl());
    $provider = new FeatureProvider($settings, $http, new FeatureStateService());
    $provider->refreshFeatures();
    $first = $provider->getFeatureDefinition('new-dashboard');
    $validLoaded = $provider->getDebugInfo()['loaded'];
    $variantSettings = new TogglySettings(array_merge(Environment::settings(), [
        'enable_live_updates' => false,
        'enable_variants' => true,
        'identity' => 'alice',
    ]));
    $variantProvider = new FeatureProvider($variantSettings, $http, new FeatureStateService());
    $variantProvider->refreshFeatures();
    $originalVariant = $variantProvider->getVariant('new-dashboard');

    // Verify authentic fixture bytes first, then corrupt a signature without changing
    // the key or SDK verifier. A rejected update must preserve the loaded definition.
    $corrupt = static function ($response, array $arguments, string $url) {
        if (str_contains($url, '/definitions-signed/') || str_contains($url, '/evaluated-variants-signed/')) {
            $body = json_decode($response['body'], true, 512, JSON_THROW_ON_ERROR);
            $signature = base64_decode($body['signature']);
            $signature[10] = chr(ord($signature[10]) ^ 1);
            $body['signature'] = base64_encode($signature);
            if (str_contains($url, '/evaluated-variants-signed/')) {
                $body['defs']['new-dashboard']['variant'] = 'untrusted-change';
            }
            $response['body'] = json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        }
        return $response;
    };
    add_filter('pre_http_request', $corrupt, 20, 3);
    $provider->refreshFeatures();
    $invalidSignatureRejected = $provider->getDebugInfo()['last_error'] !== null;
    $variantProvider->refreshFeatures();
    $variantRejected = $variantProvider->getVariant('new-dashboard') === $originalVariant;
    $variantProvider->shutdown();
    $kept = $provider->getFeatureDefinition('new-dashboard') === $first;
    remove_filter('pre_http_request', $corrupt, 20);

    $malformed = static function ($response, array $arguments, string $url) {
        if (str_contains($url, '/definitions-signed/')) {
            $response['body'] = 'not JSON';
        }
        return $response;
    };
    add_filter('pre_http_request', $malformed, 20, 3);
    $provider->refreshFeatures();
    $malformedKept = $provider->getFeatureDefinition('new-dashboard') === $first;
    remove_filter('pre_http_request', $malformed, 20);
    $provider->shutdown();
    wp_send_json([
        'sapi' => PHP_SAPI,
        'nativePhp85' => PHP_MAJOR_VERSION === 8 && PHP_MINOR_VERSION === 5,
        'nativeExecutionBudget120' => (int) ini_get('max_execution_time') === 120,
        'validSignatureLoaded' => $validLoaded,
        'variantValidSignatureLoaded' => ($originalVariant['name'] ?? null) === 'compact',
        'variantInvalidSignatureRejected' => $variantRejected,
        'invalidSignatureRejected' => $invalidSignatureRejected,
        'lastKnownGoodRetained' => $kept,
        'malformedUpdateRetained' => $malformedKept,
        'websocketStopped' => !$provider->getDebugInfo()['websocket_running'],
        'nativeShortcodeMissingName' => do_shortcode('[toggly_feature]hidden[/toggly_feature]') === '',
        'nativeHelperNamespaced' => function_exists('Toggly\\WordPress\\toggly_is_enabled') && !function_exists('toggly_is_enabled'),
    ]);
}, 0);
