<?php

return [
    // Each PHP-FPM request owns its SDK snapshots. No database or cross-user variants.
    'default' => 'array',
    'stores' => [
        'array' => [
            'driver' => 'array',
            'serialize' => false,
        ],
    ],
    'prefix' => 'php-laravel-sample',
];
