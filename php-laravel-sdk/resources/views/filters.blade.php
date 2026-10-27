@extends('layout')
@section('title', 'Eleven filters, one explicit context')
@section('content')
    <p class="lead">The matrix executes native FeatureManager evaluations against all shared filter definitions.
        Select a persona, then return here to compare.</p>
    <p><a class="button" href="/identity">Change preset →</a></p>
    <div class="card table-scroll">
        <table>
            <caption>
                {{ $runtime->context->preset }} · {{ $snapshot['identity'] }} ·
                {{ $runtime->offline ? 'local fixture definitions' : 'live definitions' }}
            </caption>
            <thead>
                <tr>
                    <th scope="col">Filter / key</th>
                    <th scope="col">Result</th>
                    <th scope="col">How to read it</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($catalog as $row)
                    <tr data-filter="{{ $row['key'] }}">
                        <th scope="row">{{ $row['title'] }}<br><code>{{ $row['key'] }}</code></th>
                        <td>@include('partials.status', ['enabled' => $snapshot['flags'][$row['key']]])</td>
                        <td>{{ $row['note'] }}
                            @unless ($row['supported'])
                                <strong class="gap">Shared preset support gap</strong>
                            @endunless
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    <section class="card">
        <h2>Read the result before changing the rule</h2>
        <p>AlwaysOn and the open 2020–2099 TimeWindow remain ON for both personas.
            Percentage is sticky per identity; Matching does not guarantee a 50% rollout match.</p>
        <p>The exact Macintosh DeviceType preset remains OFF because the native PHP parser calls this desktop device Other.
            OperatingSystem = Mac works independently. ContextProperty remains unsupported.</p>
        <details>
            <summary>Inspect the explicit request fields</summary>
            <pre><code>{{ json_encode($snapshot['context'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) }}</code></pre>
        </details>
    </section>
    @unless ($runtime->offline)
        <script>
            (() => {
                const rows = document.querySelectorAll('tr[data-filter]');
                if (!rows.length) return;
                const apply = (flags) => {
                    for (const row of rows) {
                        const key = row.getAttribute('data-filter');
                        const enabled = flags?.[key];
                        const cell = row.querySelector('.flag-state');
                        if (!cell || enabled === undefined) continue;
                        const on = enabled === true;
                        cell.classList.toggle('on', on);
                        cell.classList.toggle('off', !on);
                        cell.textContent = on ? 'ON' : 'OFF';
                        cell.setAttribute('data-toggly-state', on ? 'on' : 'off');
                    }
                };
                const poll = () =>
                    fetch('/api/snapshot', { cache: 'no-store', credentials: 'same-origin' })
                        .then((r) => (r.ok ? r.json() : null))
                        .then((body) => body?.flags && apply(body.flags))
                        .catch(() => {});
                setInterval(poll, 2000);
            })();
        </script>
    @endunless
@endsection
