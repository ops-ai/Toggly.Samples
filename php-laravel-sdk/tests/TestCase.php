<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\TestCase as LaravelTestCase;

abstract class TestCase extends LaravelTestCase
{
    public function createApplication()
    {
        // Laravel's env repository also reads $_SERVER. Override all three
        // sources so a developer's exported live key cannot escape this fixture.
        $environment = [
            'APP_ENV' => 'testing',
            'APP_DEBUG' => 'false',
            'APP_KEY' => 'base64:' . base64_encode(random_bytes(32)),
            'TOGGLY_APP_KEY' => '',
        ];
        foreach ($environment as $key => $value) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }

        $app = require __DIR__ . '/../bootstrap/app.php';
        if ($app->configurationIsCached()) {
            throw new \LogicException('Run php artisan optimize:clear before running offline tests.');
        }
        $app->make(Kernel::class)->bootstrap();

        return $app;
    }
}
