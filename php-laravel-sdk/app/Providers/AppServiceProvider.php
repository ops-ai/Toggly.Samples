<?php

namespace App\Providers;

use App\Support\DemoContext;
use App\Support\DemoUser;
use App\Support\OfflineTransport;
use App\Support\TogglyRuntime;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\HttpFactory;
use Illuminate\Auth\RequestGuard;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\ServiceProvider;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestFactoryInterface;

final class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(RequestFactoryInterface::class, HttpFactory::class);
        $this->app->singleton(ClientInterface::class, function ($app): ClientInterface {
            // Empty and CI-placeholder keys stay on the local transport for the
            // entire lifecycle, including destructor telemetry. Real keys use Guzzle.
            if (TogglyRuntime::isOfflineKey(config('toggly.app_key'))) {
                return $app->make(OfflineTransport::class);
            }

            return new Client(['connect_timeout' => 3, 'timeout' => 5]);
        });
        $this->app->singleton(OfflineTransport::class);
        $this->app->singleton(TogglyRuntime::class);
    }

    public function boot(): void
    {
        Auth::extend('demo', function ($app): RequestGuard {
            return new RequestGuard(
                fn () => new DemoUser($app->make(DemoContext::class)),
                $app['request'],
            );
        });
    }
}
