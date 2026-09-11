<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title') · PHP Laravel SDK Sample</title>
    <link rel="stylesheet" href="/css/workshop.css">
</head>
<body>
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
        <a class="brand" href="/">TOGGLY <span>/ Laravel workshop</span></a>
        <span class="badge">PHP 8.5 · Laravel 13</span>
    </header>
    <div class="shell">
        <aside class="sidebar">
            <p class="eyebrow">THE WORKSHOP</p>
            <nav aria-label="Workshop sections">
                @foreach ([
                    '/' => '01 / Start here',
                    '/gates' => '02 / Declarative gates',
                    '/api' => '03 / Programmatic API',
                    '/identity' => '04 / Request identity',
                    '/orders' => '05 / Order context',
                    '/filters' => '06 / Filter matrix',
                    '/integrations' => '07 / Laravel surfaces',
                ] as $path => $label)
                    <a href="{{ $path }}" @if (request()->getPathInfo() === $path) aria-current="page" @endif>
                        {{ $label }}
                    </a>
                @endforeach
            </nav>
            <div class="sidebar-note">
                <p class="eyebrow">THIS REQUEST</p>
                <strong>{{ $snapshot['identity'] }}</strong>
                <p>{{ $runtime->context->preset }} preset</p>
                <p>Order: {{ $snapshot['order']['Id'] ?? 'missing' }}</p>
                <a href="/identity">Change context →</a>
            </div>
        </aside>
        <main id="main">
            {{-- Missing configuration is a required section, visible on every page. --}}
            @if ($runtime->offline)
                <div class="notice" role="status">
                    <strong>Offline fixture mode · no app key configured</strong>
                    <p>Native Toggly evaluates local demo definitions. Results below are not live dashboard data.
                        Add your app key to the local <code>.env</code> to connect, then clear the configuration cache.</p>
                </div>
            @else
                <div class="notice connected" role="status">
                    <strong>Live definitions · {{ config('toggly.environment') }}</strong>
                    <p>Each new request refreshes definitions. Reload after changing a flag in Toggly.</p>
                </div>
            @endif
            @if ($snapshot['error'])
                <div class="notice error" role="alert">
                    <strong>Definitions unavailable</strong>
                    <p>{{ $snapshot['error'] }} Check the local configuration and service connection.
                        Unknown results are shown as UNKNOWN.</p>
                </div>
            @endif
            @if (session('message'))
                <p class="notice connected" role="status">{{ session('message') }}</p>
            @endif
            @if ($errors->any())
                <div class="notice error" role="alert">
                    <strong>Please check the controls.</strong>
                    <ul>
                        @foreach ($errors->all() as $message)
                            <li>{{ $message }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif
            <p class="eyebrow">NATIVE SDK / HANDS-ON EXAMPLES</p>
            <h1>@yield('title')</h1>
            @yield('content')
            <footer>
                PHP Laravel SDK Sample · Native core + Laravel adapter 1.0.0<br>
                Definitions checked {{ $snapshot['checkedAt'] }} ·
                <a href="/api/snapshot">Inspect this browser's JSON snapshot</a>
            </footer>
        </main>
    </div>
</body>
</html>
