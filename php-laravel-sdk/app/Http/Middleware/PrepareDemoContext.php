<?php

namespace App\Http\Middleware;

use App\Support\DemoContext;
use App\Support\DemoUser;
use App\Support\TogglyRuntime;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class PrepareDemoContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $context = DemoContext::fromRequest($request);
        app()->instance(DemoContext::class, $context);
        $request->setUserResolver(fn () => new DemoUser($context));

        // Resolve SDK services only after this request's identity exists. The native
        // adapter captures Request in a singleton; PHP-FPM discards it at request end.
        $runtime = app(TogglyRuntime::class);
        try {
            $runtime->initialize();
            $response = $next($request);
            return $response->header('Cache-Control', 'private, no-store');
        } finally {
            $runtime->close();
        }
    }
}
