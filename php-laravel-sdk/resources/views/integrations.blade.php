@extends('layout')
@section('title', 'What Laravel adds')
@section('content')
    <p class="lead">Use the published service provider, native route and attribute middleware,
        and Laravel's cache adapter without replacing the SDK evaluation path.</p>
    <div class="grid">
        <section class="card">
            <h2>Route middleware</h2>
            <p><code>beta-access</code> targets alice in the mixed offline scenario.</p>
            <ul>
                <li><a href="/native/beta">Native beta route</a> — ON permits; OFF returns 404.</li>
                <li><a href="/native/redirect">Native redirect route</a> — OFF redirects to gates.</li>
            </ul>
            <pre><code>-&gt;middleware('feature:beta-access')
-&gt;middleware('feature:beta-access,/gates')</code></pre>
        </section>
        <section class="card">
            <h2>Controller attributes</h2>
            <ul>
                <li><a href="/native/all">All requirement</a> — needs dashboard and API v2; OFF is 403.</li>
                <li><a href="/native/any">Any + FeatureUsage</a> — one flag is enough.</li>
                <li><a href="/native/attribute-redirect">Attribute redirect</a> — API v2 OFF returns to gates.</li>
            </ul>
            <pre><code>#[FeatureGate(['new-dashboard', 'api-v2'],
    requirement: 'All', statusCode: 403)]
#[FeatureUsage('new-dashboard')]</code></pre>
            <p>Attributes execute only on routes using <code>feature.attributes</code>.</p>
        </section>
        <section class="card">
            <h2>Refresh, snapshots &amp; events</h2>
            <p>The provider explicitly refreshes before evaluation. The native Laravel cache snapshot
                uses the array store, scoped to this PHP request. Reload to fetch new definitions.</p>
            <p>Definition-change callbacks this request: <strong>{{ $snapshot['definitionChanges'] }}</strong>.</p>
            <pre><code>$state = app(FeatureStateServiceInterface::class);
$id = $state-&gt;whenDefinitionsChange($callback);
$provider-&gt;refreshFeatures(true);
// Release the exact registration at request end.
$state-&gt;unregisterDefinitionsChange($id);
$provider-&gt;shutdown();</code></pre>
        </section>
        <section class="card">
            <h2>Usage &amp; metrics</h2>
            <p>Native evaluation records checks and usage. The native context provider deduplicates
                feature access within a request. Metrics and usage flush while that request's user exists.</p>
            <form method="post" action="/actions/metric">
                @csrf
                <button type="submit">Record sample-clicks</button>
            </form>
            <pre><code>$metrics-&gt;incrementCounter('sample-clicks', 1);
$usage-&gt;flush();
$metrics-&gt;flush();</code></pre>
            <p>Offline telemetry stays in the fixture transport. This button does not claim dashboard delivery.</p>
        </section>
    </div>
    <section class="card">
        <h2>Lifecycle and trust boundaries</h2>
        <p>Live definition mode verifies signed definitions by default. The test suite generates temporary signing keys
            and proves native acceptance, tamper rejection and unsigned-definition rejection.</p>
        <p>Variant fixtures separately demonstrate assignment parsing and initial identity ownership.
            This sample makes no equivalent authenticity claim for variants.</p>
        <p>Live updates are disabled: no timer or background refresh is implied. Native providers shut down in
            a <code>finally</code> block; no request identity survives ordinary PHP-FPM request teardown.</p>
    </section>
@endsection
