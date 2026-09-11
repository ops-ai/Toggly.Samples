<?php

return [
    // SDK errors can contain request URLs. Keep this workshop from logging app keys.
    'default' => 'null',
    'channels' => [
        'null' => [
            'driver' => 'monolog',
            'handler' => Monolog\Handler\NullHandler::class,
        ],
    ],
];
