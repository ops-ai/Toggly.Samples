<?php

return [
    // A bounded teaching guard supplies personas, not real authentication.
    'defaults' => [
        'guard' => 'demo',
    ],
    'guards' => [
        'demo' => [
            'driver' => 'demo',
        ],
    ],
];
