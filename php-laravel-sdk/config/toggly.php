<?php

return [
    'app_key' => env('TOGGLY_APP_KEY', ''),
    'environment' => env('TOGGLY_ENVIRONMENT', 'Production'),
    'base_url' => env('TOGGLY_BASE_URL', 'https://definitions.toggly.io/'),
    'use_signed_definitions' => (bool) env('TOGGLY_USE_SIGNED_DEFINITIONS', true),
    'enable_variants' => false,
    'sample_variants' => (bool) env('TOGGLY_ENABLE_VARIANTS', false),
    'allowed_key_ids' => null,
    'enable_live_updates' => false,
    'undefined_enabled_on_development' => false,
    'snapshot_provider' => 'cache',
    'cache' => [
        'store' => 'array',
        'prefix' => 'toggly-sample',
    ],
];
