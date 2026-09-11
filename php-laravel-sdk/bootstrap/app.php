<?php

use App\Http\Middleware\PrepareDemoContext;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Middleware;
use Toggly\Laravel\Middleware\FeatureGateAttributeMiddleware;
use Toggly\Laravel\Middleware\FeatureGateMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__ . '/../routes/web.php')
    ->withMiddleware(function (Middleware $middleware): void {
        // Append after the normal web session and CSRF middleware.
        $middleware->web(append: [PrepareDemoContext::class]);
        $middleware->alias([
            'feature' => FeatureGateMiddleware::class,
            'feature.attributes' => FeatureGateAttributeMiddleware::class,
        ]);
    })
    ->withExceptions()
    ->create();
