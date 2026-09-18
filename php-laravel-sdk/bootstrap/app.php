<?php

use App\Http\Middleware\PrepareDemoContext;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Middleware;
use Toggly\Laravel\Middleware\FeatureGateAttributeMiddleware;
use Toggly\Laravel\Middleware\FeatureGateMiddleware;

$basePath = dirname(__DIR__);
$testing = getenv('APP_ENV') === 'testing'
    || (isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'testing');
if (!$testing && is_readable($basePath . '/.env.local')) {
    // Overlay after process env / .env. Tests force APP_ENV=testing first so a
    // developer .env.local cannot escape the offline fixture.
    Dotenv\Dotenv::createMutable($basePath, '.env.local')->safeLoad();
}

return Application::configure(basePath: $basePath)
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
