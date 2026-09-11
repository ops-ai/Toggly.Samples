"""Native gates plus explicit context; read gates.html beside these views."""
from dataclasses import asdict
from django.conf import settings
from django.contrib.auth import login, logout
from django.http import JsonResponse, HttpResponseBadRequest
from django.shortcuts import render, redirect
from django.views.decorators.http import require_POST, require_http_methods
from toggly import FeatureRequirement, TogglyClient, TogglyConfig, TogglyEntityContext
from toggly_django.decorators import feature_flag_required, feature_gate_required
from toggly_django.utils import get_client, is_feature_enabled
from .catalog import ALL_KEYS, FILTERS
from .context import order
from .models import User


def snapshot(request):
    client, context = get_client(), request.sample_context
    # Native feature_flags is a process-default snapshot. Evaluate each key with
    # this request's full context instead; never serialize raw SDK debug info/keys.
    return {'identity': context.identity, 'shared_identity': client.current_identity,
        'flags': {key: client.is_enabled(key, context=context) for key in ALL_KEYS},
        'orders': {name: client.is_enabled('ExpressCheckout', context=context.with_entity(entity))
            for name, entity in [('ord-vip', order(True)), ('ord-standard', order(False)),
                ('missing', None), ('wrong-kind', TogglyEntityContext('Unknown', 'x', {'Vip': True}))]},
        'native_claims': request.toggly.is_enabled('filter-user-claims'),
        'native_country': request.toggly.is_enabled('filter-country')}


def home(request):
    client = get_client()
    debug = client.get_debug_info()
    return render(request, 'showcase/home.html', {'snapshot': snapshot(request),
        'initialized': client.is_initialized, 'last_refresh': debug.last_refresh,
        'refresh_error': bool(debug.last_error), 'interval': debug.refresh_interval})


def gates(request):
    return render(request, 'showcase/gates.html', {'variant': get_client().get_variant('new-dashboard')})


def programmatic(request):
    return render(request, 'showcase/programmatic.html', {
        'native': request.toggly.is_enabled('new-dashboard'),
        'explicit': is_feature_enabled('new-dashboard', context=request.sample_context),
        'api_v2': get_client().is_enabled('api-v2', context=request.sample_context)})


def api_snapshot(request):
    return JsonResponse(snapshot(request))


@require_http_methods(['GET', 'POST'])
def identity(request):
    if request.method == 'POST':
        choice = request.POST.get('persona')
        if choice == 'clear':
            logout(request)  # Flush old session including Order/preset.
        elif choice in {'alice', 'bob'}:
            user = User.objects.filter(pk=choice).first()
            if user is None:
                return HttpResponseBadRequest('Run python manage.py migrate and python manage.py seed_demo first.')
            # LOCAL DEMO ONLY: this selector is intentionally not authentication.
            login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        else:
            return HttpResponseBadRequest('Choose alice, bob, or clear.')
        return redirect('identity')
    return render(request, 'showcase/identity.html')


@require_http_methods(['GET', 'POST'])
def orders(request):
    if request.method == 'POST':
        mode = request.POST.get('order')
        if mode not in {'vip', 'standard', 'missing'}:
            return HttpResponseBadRequest('Choose a listed Order.')
        request.session['order'] = mode
        return redirect('orders')
    return render(request, 'showcase/orders.html', {'orders': snapshot(request)['orders'],
        'native': request.toggly.is_enabled('ExpressCheckout')})


@require_http_methods(['GET', 'POST'])
def filters(request):
    if request.method == 'POST':
        preset = request.POST.get('preset')
        if preset not in {'matching', 'nonmatching'}:
            return HttpResponseBadRequest('Choose a listed preset.')
        # Preset claims come from the fixed local user record, not arbitrary claims input.
        user = User.objects.filter(pk='alice' if preset == 'matching' else 'bob').first()
        if user is None:
            return HttpResponseBadRequest('Run python manage.py seed_demo first.')
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        request.session['preset'] = preset
        request.session['order'] = 'vip' if preset == 'matching' else 'standard'
        return redirect('filters')
    client = get_client()
    rows = [{'key': key, 'alias': alias, 'note': note,
        'enabled': client.is_enabled(key, context=request.sample_context),
        'native': request.toggly.is_enabled(key)} for key, alias, _, note in FILTERS]
    return render(request, 'showcase/filters.html', {'rows': rows})


def integrations(request):
    return render(request, 'showcase/integrations.html')


def result(request, title='Native view allowed'):
    return render(request, 'showcase/result.html', {'title': title})


@require_POST
@feature_flag_required('enhanced-submit')
def submit(request):
    # Server gate precedes the reversible session mutation. CSRF stays enabled.
    request.session['submissions'] = request.session.get('submissions', 0) + 1
    return result(request, f"Enhanced submission accepted ({request.session['submissions']})")


@feature_flag_required('filter-targeting')
def targeted(request):
    return result(request, 'Native targeted view: alice allowed')


@feature_gate_required(['new-dashboard', 'api-v2'])
def all_gate(request):
    return result(request, 'Native All gate allowed')


@feature_gate_required(['new-dashboard', 'api-v2'], requirement=FeatureRequirement.ANY)
def any_gate(request):
    return result(request, 'Native Any gate allowed')


@feature_gate_required(['new-dashboard', 'api-v2'], negate=True)
def negated_gate(request):
    return result(request, 'Native negated All gate allowed')


@feature_flag_required('api-v2', redirect_url='/integrations/')
def redirect_gate(request):
    return result(request, 'API v2 enabled')


@feature_flag_required('beta-access')
def beta(request):
    return result(request, 'Beta access allowed')


def api_v1(request):
    return result(request, 'API version 1')


def api_v2(request):
    return result(request, 'API version 2')


@require_POST
def refresh(request):
    response = get_client().refresh()
    # Error messages may include URLs or keys. Show status only.
    return result(request, f'Native refresh status: {response.status.value}; reload a page for current results')


@require_POST
def variant(request):
    if settings.OFFLINE:
        return result(request, 'No variant assigned in the offline definition fixture')
    context = request.sample_context
    # ONLY this explicit action needs an identity-specific remote variants client.
    # Known context is present before its first signed fetch; ordinary page requests
    # share local definitions and never update global identity. Always close it.
    config = TogglyConfig(app_key=settings.APP_KEY, environment=settings.TOGGLY['ENVIRONMENT'],
        base_url=settings.TOGGLY['BASE_URL'], enable_variants=True,
        identity=context.identity, variant_groups=context.groups, variant_claims=context.claims,
        disable_background_refresh=True, enable_live_updates=False,
        enable_usage_tracking=False, register_contexts_on_startup=False,
        connect_timeout=2, request_timeout=3)
    with TogglyClient(config) as client:
        client.init()
        assigned = client.get_variant('new-dashboard')
        return render(request, 'showcase/result.html', {'title': 'Native remote variant',
            'variant': asdict(assigned) if assigned else None})
