@extends('layout')
@section('title', 'Programmatic API')
@section('content')
    <p class="lead">Inject the native manager for an explicit per-evaluation context.
        The facade resolves the same manager from Laravel's container.</p>
    <section class="card">
        <h2>Evaluate with complete request context</h2>
        <pre><code>use Toggly\FeatureManagement\Core\FeatureManager;
use Toggly\Laravel\Facades\Toggly;

// DemoContext is built after this request's session is available.
$context = $demoContext-&gt;evaluation();
$enabled = $manager-&gt;isEnabled('new-dashboard', $context);
$sameDecision = Toggly::isEnabled('new-dashboard', $context);</code></pre>
        <dl class="facts">
            <dt>Injected manager</dt><dd>@include('partials.status', ['enabled' => $snapshot['flags']['new-dashboard']])</dd>
            <dt>Native facade</dt><dd>@include('partials.status', ['enabled' => $snapshot['facadeEnabled']])</dd>
            <dt>Unknown key default</dt><dd>@include('partials.status', ['enabled' => $snapshot['unknownFlag']])</dd>
        </dl>
        <p>The published call is <code>isEnabled(key, context)</code>. Missing definitions return false after a successful load.</p>
        <a href="/api/snapshot">Open the sanitized JSON endpoint →</a>
    </section>
    <section class="card">
        <h2>A server-gated action</h2>
        <p><code>enhanced-submit</code> is checked by native route middleware on every POST.
            Hiding a button alone would not protect a route. This demo gate is separate from real authentication and authorization.</p>
        <form method="post" action="/actions/enhanced">
            @csrf
            <button type="submit">Try enhanced submission</button>
        </form>
        <p>With the offline OFF scenario, expect HTTP 404; otherwise the sample redirects here with confirmation.</p>
        <pre><code>Route::post('/actions/enhanced', [ControlsController::class, 'enhanced'])
    -&gt;middleware('feature:enhanced-submit');</code></pre>
    </section>
@endsection
