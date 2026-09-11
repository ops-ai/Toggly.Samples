@extends('layout')
@section('title', 'An Order is separate from its user')
@section('content')
    <p class="lead">Keep entity identity and user identity distinct, including when an entity is missing.</p>
    <section class="card">
        <h2>Express Checkout</h2>
        <p>User: <strong>{{ $snapshot['identity'] }}</strong> · Order: <strong>{{ $snapshot['order']['Id'] ?? 'missing' }}</strong></p>
        <pre><code>{{ json_encode($snapshot['order'], JSON_PRETTY_PRINT) }}</code></pre>
        <p><code>ExpressCheckout</code> @include('partials.status', ['enabled' => $snapshot['flags']['ExpressCheckout']])</p>
        <p class="notice">Published PHP does not support ContextProperty or an Order entity evaluation API.
            The shared <code>Order.Vip = true</code> definition stays intact and evaluates OFF for VIP,
            ordinary and missing orders. There is no custom replacement evaluator in this sample.</p>
        <p>The <code>Order</code> object above is displayed separately and is not converted into user claims
            or sent as a variant assignment identity.</p>
        <a class="button" href="/identity">Try VIP, standard and missing orders →</a>
    </section>
@endsection
