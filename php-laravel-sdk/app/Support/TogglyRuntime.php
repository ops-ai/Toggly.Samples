<?php

namespace App\Support;

use GuzzleHttp\Psr7\HttpFactory;
use Psr\Http\Client\ClientInterface;
use Toggly\FeatureManagement\Config\TogglySettings;
use Toggly\FeatureManagement\Contracts\FeatureStateServiceInterface;
use Toggly\FeatureManagement\Core\FeatureManager;
use Toggly\FeatureManagement\Core\FeatureProvider;
use Toggly\FeatureManagement\Core\FeatureStateService;
use Toggly\FeatureManagement\Core\MetricsService;
use Toggly\FeatureManagement\Core\UsageStatsProvider;
use Toggly\FeatureManagement\Http\TogglyHttpClient;
use Toggly\Laravel\Facades\Toggly;

final class TogglyRuntime
{
    public bool $offline;
    public int $definitionChanges = 0;
    private ?FeatureProvider $provider = null;
    private FeatureManager $manager;
    private ?FeatureProvider $variantProvider = null;
    private ?FeatureManager $variantManager = null;
    private ?string $subscription = null;
    private bool $refreshFailed = false;

    public function __construct(public readonly DemoContext $context)
    {
        $this->offline = trim((string) config('toggly.app_key')) === '';
    }

    public function initialize(): void
    {
        if ($this->offline) {
            // Offline fixtures demonstrate parsing, not signature authenticity.
            config(['toggly.use_signed_definitions' => false]);
        }

        $state = app(FeatureStateServiceInterface::class);
        $this->subscription = $state->whenDefinitionsChange(function (): void {
            $this->definitionChanges++;
        });
        $this->provider = app(FeatureProvider::class);
        $this->manager = app(FeatureManager::class);

        // The SDK does not start a timer or fetch on isEnabled(). Load first, so
        // sixteen snapshot evaluations do not each wait on an uninitialized provider.
        try {
            $this->provider->refreshFeatures(true);
        } catch (\Throwable) {
            // A malformed signed envelope can raise a PHP Error in the native
            // parser. Preserve UNKNOWN and a safe banner; never accept its data.
            $this->refreshFailed = true;
        }

        if ($this->offline || config('toggly.sample_variants')) {
            $this->initializeVariants();
        }
    }

    private function initializeVariants(): void
    {
        $settings = new TogglySettings([
            'app_key' => config('toggly.app_key'),
            'environment' => config('toggly.environment'),
            'base_url' => config('toggly.base_url'),
            'enable_variants' => true,
            'use_signed_definitions' => config('toggly.use_signed_definitions'),
            'identity' => $this->context->identity,
            'enable_live_updates' => false,
        ]);
        $http = new TogglyHttpClient(
            app(ClientInterface::class),
            new HttpFactory(),
            $settings->getBaseUrl(),
        );

        // Variant assignments and ETags belong to this identity from first fetch.
        // No shared identity mutation or cross-request variant snapshot is involved.
        $this->variantProvider = new FeatureProvider($settings, $http, new FeatureStateService());
        $this->variantManager = new FeatureManager(
            $this->variantProvider,
            app(UsageStatsProvider::class),
            $this->variantProvider,
        );
        try {
            $this->variantProvider->refreshFeatures(true);
        } catch (\Throwable) {
            $this->refreshFailed = true;
        }
    }

    public function snapshot(): array
    {
        $status = $this->provider->getDebugInfo();
        $flags = [];
        foreach (FlagCatalog::keys() as $key) {
            // A failed initial load is unknown, not a fabricated successful OFF check.
            $flags[$key] = $status['loaded']
                ? $this->manager->isEnabled($key, $this->context->evaluation())
                : null;
        }

        return [
            'mode' => $this->offline ? 'offline' : 'live',
            'identity' => $this->context->identity,
            'order' => $this->context->order,
            'context' => $this->context->evaluation(),
            'flags' => $flags,
            'facadeEnabled' => $status['loaded']
                ? Toggly::isEnabled('new-dashboard', $this->context->evaluation())
                : null,
            'unknownFlag' => $status['loaded']
                ? $this->manager->isEnabled('sample-unknown-key', $this->context->evaluation())
                : null,
            'variant' => $this->variantManager?->getVariant('new-dashboard'),
            'variantValue' => $this->variantManager?->getVariantValue('new-dashboard'),
            'loaded' => $status['loaded'],
            'definitionChanges' => $this->definitionChanges,
            'error' => $this->refreshFailed || !$status['loaded'] || $status['last_error'] !== null
                ? 'Definitions could not be loaded or verified.'
                : null,
            'checkedAt' => gmdate(DATE_ATOM),
        ];
    }

    public function close(): void
    {
        if ($this->subscription !== null) {
            app(FeatureStateServiceInterface::class)->unregisterDefinitionsChange($this->subscription);
            $this->subscription = null;
        }
        $this->provider?->shutdown();
        $this->variantProvider?->shutdown();

        // Flush within the request while its demo user still exists. Successful
        // flush empties the native buffers before their best-effort destructors run.
        if (app()->resolved(UsageStatsProvider::class)) {
            app(UsageStatsProvider::class)->flush();
        }
        if (app()->resolved(MetricsService::class)) {
            app(MetricsService::class)->flush();
        }
    }
}
