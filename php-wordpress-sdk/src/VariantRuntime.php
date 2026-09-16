<?php

namespace TogglySample;

use Toggly\FeatureManagement\Config\TogglySettings;
use Toggly\FeatureManagement\Core\FeatureProvider;
use Toggly\FeatureManagement\Core\FeatureStateService;
use Toggly\FeatureManagement\Http\TogglyHttpClient;
use Toggly\WordPress\Http\WordPressHttpClient;
use Toggly\WordPress\Http\WordPressRequestFactory;

final class VariantRuntime
{
    private FeatureProvider $provider;
    public array $errors = [];

    public function __construct(RequestContext $context)
    {
        $settings = new TogglySettings(array_merge(Environment::settings(), [
            'enable_variants' => true,
            'identity' => $context->identity,
            'enable_live_updates' => false,
            'on_error' => function (string $message): void {
                $this->errors[] = $message;
            },
        ]));
        // The plugin has no variant accessor. This is a separate, public core API demo.
        // A fresh provider knows its request identity before the very first HTTP fetch.
        $http = new TogglyHttpClient(
            new WordPressHttpClient(),
            new WordPressRequestFactory(),
            $settings->getBaseUrl()
        );
        $this->provider = new FeatureProvider($settings, $http, new FeatureStateService());
        $this->provider->refreshFeatures();
    }

    public function variant(): ?array
    {
        return $this->provider->getVariant('new-dashboard');
    }

    public function close(): void
    {
        $this->provider->shutdown();
    }
}
