@extends('layout')
@section('title', 'Identity belongs to the request')
@section('content')
    <p class="lead">Alice and Bob are demo personas stored in separate browser sessions.
        The session is read before any SDK service is resolved or any gate evaluates.</p>
    @include('partials.controls')
    <section class="card">
        <h2>Context used on this request</h2>
        <pre><code>{{ json_encode($snapshot['context'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) }}</code></pre>
        <p><code>identity</code> drives sticky targeting; <code>userId</code> also supplies native usage identity.
            Groups, claims and request fields are explicit inputs to the core evaluator.</p>
    </section>
    <section class="card">
        <h2>Try two sessions</h2>
        <ol>
            <li>Keep Matching / alice in this browser.</li>
            <li>Open a private window and select Non-matching / bob with the standard order.</li>
            <li>Reload both filter pages: each keeps its own context and targeting result.</li>
        </ol>
        <p>The sample uses ordinary PHP-FPM request lifetimes. The native context provider captures a Request
            in its constructor; do not reuse this container as an Octane or persistent application worker.</p>
        <p>These controls are a teaching aid, not a login system. A real app derives identity and claims
            from its authenticated user and trusted request middleware.</p>
    </section>
@endsection
