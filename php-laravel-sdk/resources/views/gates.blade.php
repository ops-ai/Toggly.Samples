@extends('layout')
@section('title', 'Declarative gates')
@section('content')
    <p class="lead">These cards execute the published Laravel Blade directives and component.
        Switch the offline scenario to compare one, both or neither baseline flag.</p>
    <p>Native Blade builds <code>userId</code>, <code>user_id</code>, groups and IP from the demo guard.
        Claims and request filter fields use the explicit API on the <a href="/filters">matrix</a>.</p>
    @if ($snapshot['loaded'])
        <div class="grid">
            <section class="card">
                <h2>Feature + fallback</h2>
                {{-- This is a native directive, not a conditional on our snapshot. --}}
                @feature('new-dashboard')
                    <p data-gate="dashboard-on" class="result">New dashboard enabled</p>
                @else
                    <p data-gate="dashboard-off" class="result">Classic dashboard fallback</p>
                @endfeature
                <pre><code>@verbatim@feature('new-dashboard')
    &lt;p&gt;New dashboard enabled&lt;/p&gt;
@else
    &lt;p&gt;Classic dashboard fallback&lt;/p&gt;
@endfeature@endverbatim</code></pre>
            </section>
            <section class="card">
                <h2>Negate</h2>
                @unlessfeature('api-v2')
                    <p data-gate="negate" class="result">Legacy API remains available</p>
                @endunlessfeature
                <pre><code>@verbatim@unlessfeature('api-v2')
    &lt;p&gt;Legacy API remains available&lt;/p&gt;
@endunlessfeature@endverbatim</code></pre>
            </section>
            <section class="card">
                <h2>Any / All</h2>
                @feature(['new-dashboard', 'api-v2'], 'any')
                    <p data-gate="any">ANY: at least one flag is on</p>
                @endfeature
                @feature(['new-dashboard', 'api-v2'], 'all')
                    <p data-gate="all">ALL: both flags are on</p>
                @endfeature
                <pre><code>@verbatim@feature(['new-dashboard', 'api-v2'], 'all')
    &lt;p&gt;Both flags are on&lt;/p&gt;
@endfeature@endverbatim</code></pre>
            </section>
            <section class="card">
                <h2>Native component</h2>
                <x-feature name="new-dashboard,api-v2" requirement="all">
                    <p data-gate="component">Component: both flags are on</p>
                </x-feature>
                <pre><code>&lt;x-feature name="new-dashboard,api-v2" requirement="all"&gt;
    &lt;p&gt;Both flags are on&lt;/p&gt;
&lt;/x-feature&gt;</code></pre>
            </section>
        </div>
    @else
        <p class="card">Native demos wait until definitions load. No successful gate result is claimed.</p>
    @endif
    <section class="card">
        <h2>Variant name + value</h2>
        <p>The SDK supplies <code>getVariant()</code>; ordinary Blade compares its name.
            Laravel has no native variant directive. A separate provider owns this identity before its first fetch.</p>
        @if (($snapshot['variant']['name'] ?? null) === 'compact')
            <p data-gate="variant-compact" class="result">Compact layout selected</p>
        @elseif (($snapshot['variant']['name'] ?? null) === 'classic')
            <p data-gate="variant-classic" class="result">Classic layout selected</p>
        @else
            <p data-gate="variant-fallback">No demonstrated layout assignment; use the default layout.</p>
        @endif
        <pre><code>{{ json_encode($snapshot['variant'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) }}</code></pre>
        <p>Offline assignments demonstrate parsing only. In live mode, enable
            <code>TOGGLY_ENABLE_VARIANTS=true</code> and configure named variants separately in your application.
            This request sends <code>userId</code> only for assignment, not claims, groups or Order.</p>
    </section>
@endsection
