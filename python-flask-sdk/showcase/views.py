"""Native Flask surfaces beside explicit core evaluations; read with templates."""
from dataclasses import asdict
from flask import Blueprint, current_app, g, request, session, render_template, redirect, abort
from flask_login import login_user, logout_user
from toggly import TogglyClient, TogglyConfig, TogglyEntityContext, FeatureRequirement
from toggly_flask import (
    get_toggly,
    feature_flag_required,
    feature_gate_required,
    feature_flag_switch,
    feature_variant,
    FeatureFlagBlueprint,
)
from .catalog import ALL_KEYS, FILTERS
from .context import USERS, order

pages = Blueprint('pages', __name__)
beta = Blueprint('beta', __name__)
feature_beta = FeatureFlagBlueprint(beta, 'beta-access')


def result(title, **values):
    return render_template('result.html', title=title, **values)


def snapshot():
    client, context = get_toggly().client, g.sample_context
    # These are per-request decisions from the actual SDK. The process-default
    # flags snapshot would omit this user's claims, request fields and Order.
    return {
        'identity': context.identity,
        'shared_identity': client.current_identity,
        'flags': {
            key: client.is_enabled(key, context=context)
            for key in ALL_KEYS
        },
        'orders': {
            name: client.is_enabled(
                'ExpressCheckout', context=context.with_entity(entity)
            )
            for name, entity in [
                ('ord-vip', order(True)),
                ('ord-standard', order(False)),
                ('missing', None),
                ('wrong-kind', TogglyEntityContext('Unknown', 'x', {'Vip': True})),
            ]
        },
        'native_claims': g.toggly.is_enabled('filter-user-claims'),
        'native_country': g.toggly.is_enabled('filter-country'),
    }


@pages.get('/')
def home():
    client = get_toggly().client
    debug = client.get_debug_info()
    # Raw debug info contains the app key. Only expose this safe status subset.
    return render_template(
        'home.html',
        snapshot=snapshot(),
        initialized=client.is_initialized,
        last_refresh=debug.last_refresh,
        refresh_error=bool(debug.last_error),
        interval=debug.refresh_interval,
    )


@pages.get('/api/snapshot/')
def api_snapshot():
    return snapshot()


@pages.get('/gates/')
def gates():
    # The native helper evaluates the gate now. Jinja receives these booleans;
    # its separate toggly.check examples evaluate through the template helper.
    return render_template(
        'gates.html',
        any_gate=g.toggly.evaluate_gate(['new-dashboard', 'api-v2'], 'any'),
        all_gate=g.toggly.evaluate_gate(['new-dashboard', 'api-v2']),
        negated=g.toggly.evaluate_gate(['new-dashboard', 'api-v2'], negate=True),
    )


@pages.get('/programmatic/')
def programmatic():
    # Both paths call the SDK. Only the explicit context includes the claims
    # and HTTP segment fields composed by this sample's before_request handler.
    return render_template(
        'programmatic.html',
        native=g.toggly.is_enabled('new-dashboard'),
        explicit=get_toggly().is_enabled('new-dashboard', context=g.sample_context),
        api_v2=get_toggly().client.is_enabled('api-v2', context=g.sample_context),
    )


@pages.route('/identity/', methods=['GET', 'POST'])
def identity():
    if request.method == 'POST':
        choice = request.form.get('persona')
        if choice == 'clear':
            logout_user()
            session.clear()
        elif choice in USERS:
            # LOCAL DEMO ONLY: this button is not proof of authentication.
            login_user(USERS[choice])
        else:
            abort(400, 'Choose alice, bob, or clear.')
        # Redirect after changing the session. The next GET resolves its own
        # user/context; no shared SDK identity or definition fetch is changed.
        return redirect('/identity/')
    return render_template('identity.html')


@pages.route('/orders/', methods=['GET', 'POST'])
def orders():
    if request.method == 'POST':
        mode = request.form.get('order')
        if mode not in {'vip', 'standard', 'missing'}:
            abort(400, 'Choose a listed Order.')
        session['order'] = mode
        # A fresh request sets the new entity before the helper caches context.
        # Replacing g.toggly_entity after a helper read would not rebuild it.
        return redirect('/orders/')
    return render_template(
        'orders.html',
        orders=snapshot()['orders'],
        native=g.toggly.is_enabled('ExpressCheckout'),
    )


@pages.route('/filters/', methods=['GET', 'POST'])
def filters():
    if request.method == 'POST':
        preset = request.form.get('preset')
        if preset not in {'matching', 'nonmatching'}:
            abort(400, 'Choose a listed preset.')
        # A preset selects a fixed demo user and Order together. These are
        # application session choices, not edits to downloaded flag definitions.
        login_user(USERS['alice' if preset == 'matching' else 'bob'])
        session['preset'] = preset
        session['order'] = 'vip' if preset == 'matching' else 'standard'
        return redirect('/filters/')
    # Keep both native SDK paths visible. The first gets full application
    # context; the request helper intentionally shows its narrower extraction.
    rows = [
        {
            'key': key,
            'alias': alias,
            'note': note,
            'enabled': get_toggly().is_enabled(key, context=g.sample_context),
            'native': g.toggly.is_enabled(key),
        }
        for key, alias, _, note in FILTERS
    ]
    return render_template('filters.html', rows=rows)


@pages.get('/integrations/')
def integrations():
    return render_template('integrations.html')


@pages.post('/submit/')
@feature_flag_required('enhanced-submit')
def submit():
    # Flask-WTF checks the form's CSRF token first. The native decorator then
    # gates the server action before this reversible session mutation runs.
    session['submissions'] = session.get('submissions', 0) + 1
    return result(f"Enhanced submission accepted ({session['submissions']})")


@pages.get('/native/targeted/')
@feature_flag_required('filter-targeting')
def targeted():
    return result('Native targeted view: alice allowed')


# Route registration stays outermost. The native decorator uses the current
# request context and rejects a disabled gate before the view body executes.
@pages.get('/native/all/')
@feature_gate_required(['new-dashboard', 'api-v2'])
def all_gate():
    return result('Native All gate allowed')


@pages.get('/native/any/')
@feature_gate_required(
    ['new-dashboard', 'api-v2'], requirement=FeatureRequirement.ANY
)
def any_gate():
    return result('Native Any gate allowed')


@pages.get('/native/negate/')
@feature_gate_required(['new-dashboard', 'api-v2'], negate=True)
def negated_gate():
    return result('Native negated All gate allowed')


@pages.get('/native/redirect/')
@feature_flag_required('api-v2', redirect_url='/integrations/')
def redirect_gate():
    return result('API v2 enabled')


@pages.get('/native/fallback/')
@feature_flag_required(
    'api-v2', fallback_view=lambda: result('API v1 fallback view')
)
def fallback_gate():
    return result('API v2 enabled')


@feature_beta.route('/welcome/')
def beta_welcome():
    return result('Native FeatureFlagBlueprint: beta welcome')


# Native view switching chooses either implementation with the same request's
# context. A disabled feature serves the fallback rather than raising an error.
pages.add_url_rule(
    '/native/switch/',
    'switch',
    feature_flag_switch(
        'api-v2',
        enabled_view=lambda: result('API version 2'),
        disabled_view=lambda: result('API version 1'),
    ),
)


@pages.get('/native/variant/')
@feature_variant(
    'new-dashboard',
    default_view=lambda: result('Native variant default: feature OFF'),
    variants={'compact': lambda: result('Native compact variant')},
)
def native_variant():
    # Actual published decorator: get_feature_state metadata does not expose the
    # remote name, so named dispatch is unavailable. Keep the native path visible.
    return result(
        'Enabled; no named native variant',
        message='Use the explicit remote assignment action on Declarative gates. The native decorator cannot read the assigned name from core metadata.',
    )


@pages.post('/refresh/')
def refresh():
    response = get_toggly().client.refresh()
    return result(
        f'Native refresh status: {response.status.value}',
        message='Reload a section for a new evaluation. Error details and app keys are not displayed.',
    )


@pages.post('/variant/')
def variant():
    if current_app.config['OFFLINE']:
        return result('No variant assigned in offline fixture mode')
    context = g.sample_context
    # Only this explicit action fetches remote assignments. Set known context
    # BEFORE init, avoid an anonymous fetch followed by set_identity/refetch.
    # Never register this short-lived client as the process default.
    config = TogglyConfig(
        app_key=current_app.config['TOGGLY_APP_KEY'],
        environment=current_app.config['TOGGLY_ENVIRONMENT'],
        base_url=current_app.config['TOGGLY_BASE_URL'],
        use_signed_definitions=True,
        enable_variants=True,
        identity=context.identity,
        variant_groups=context.groups,
        variant_claims=context.claims,
        disable_background_refresh=True,
        enable_live_updates=False,
        enable_usage_tracking=False,
        register_contexts_on_startup=False,
        connect_timeout=2,
        request_timeout=3,
    )
    # The context manager owns cleanup even if loading or rendering raises.
    # Ordinary page requests continue to use the shared worker client.
    with TogglyClient(config) as client:
        loaded = client.init()
        assigned = client.get_variant('new-dashboard')
        return result(
            'Native remote assignment',
            variant=asdict(assigned) if assigned else None,
            message=f'Load status: {loaded.status.value}. Baseline flags have no experiment assignment.',
        )
