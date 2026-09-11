@extends('layout')
@section('title', 'Your first flag, end to end')
@section('content')
    <p class="lead">Follow one request from a feature definition to a Blade gate.
        Then explore identity, filters and the parts that belong to Laravel.</p>
    <section class="card accent">
        <p class="eyebrow">START WITH NEW-DASHBOARD</p>
        <h2>Change a flag. See the decision.</h2>
        <ol>
            <li>Open <a href="/gates">Declarative gates</a> and find the dashboard card.</li>
            <li>In offline mode, use <a href="/identity">Request identity</a> to select All baseline flags OFF, then apply.</li>
            <li>Return to the gates: the dashboard disappears and its fallback appears.</li>
            <li>For live mode, switch <code>new-dashboard</code> in your dedicated Toggly app instead and reload.</li>
        </ol>
        <a class="button" href="/gates">Try the first gate →</a>
    </section>
    <section>
        <h2>Choose a trail</h2>
        <div class="grid">
            <a class="card trail" href="/api">
                <span class="eyebrow">EVALUATE</span>
                <h3>Programmatic API</h3>
                <p>Inject FeatureManager, use the facade, and submit a gated action.</p>
            </a>
            <a class="card trail" href="/identity">
                <span class="eyebrow">PERSONALIZE</span>
                <h3>Request identity</h3>
                <p>Two browser sessions, separate users, explicit claims and request fields.</p>
            </a>
            <a class="card trail" href="/filters">
                <span class="eyebrow">COMPARE</span>
                <h3>Eleven filters</h3>
                <p>Exact shared presets, native results and visible support limits.</p>
            </a>
            <a class="card trail" href="/integrations">
                <span class="eyebrow">INTEGRATE</span>
                <h3>Laravel surfaces</h3>
                <p>Middleware, attributes, snapshots, events and telemetry ownership.</p>
            </a>
        </div>
    </section>
    <section class="card">
        <h2>Flag checklist &amp; current snapshot</h2>
        <p>All sixteen shared keys use the current request. The Order example is under <a href="/orders">Order context</a>.</p>
        <div class="table-scroll">
            <table>
                <caption>{{ $runtime->offline ? 'Local native fixture results' : 'Live native evaluation results' }}</caption>
                <thead>
                    <tr>
                        <th scope="col">Flag key</th>
                        <th scope="col">Result</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($snapshot['flags'] as $key => $enabled)
                        <tr>
                            <th scope="row"><code>{{ $key }}</code></th>
                            <td>@include('partials.status', ['enabled' => $enabled])</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </section>
@endsection
