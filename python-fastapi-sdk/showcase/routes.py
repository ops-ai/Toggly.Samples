"""Copyable native gates and explicit contextual evaluations, with HTML lessons."""
import asyncio
import secrets
from dataclasses import asdict
from pathlib import Path
import anyio
from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.responses import RedirectResponse
from starlette.templating import Jinja2Templates
from toggly import AsyncTogglyClient, TogglyConfig, TogglyEntityContext, FeatureRequirement
from toggly_fastapi import (
    TogglyDep, ContextDep, FeatureGateDependency, FeatureFlagRouter,
    require_feature, require_features, feature_enabled,
    feature_flag_required, feature_gate_required, feature_switch,
)
from .catalog import ALL_KEYS, FILTERS
from .context import USERS, order

pages = APIRouter()
beta = APIRouter()
feature_beta = FeatureFlagRouter(beta, 'beta-access')
templates = Jinja2Templates(directory=Path(__file__).parent / 'templates')
SECTIONS = [
    ('/', 'Home'), ('/gates/', 'Declarative gates'),
    ('/programmatic/', 'Programmatic API'), ('/identity/', 'Identity'),
    ('/orders/', 'Entity context'), ('/filters/', 'Filters matrix'),
    ('/integrations/', 'FastAPI surfaces'),
]


def render(request, template, *, status_code=200, **values):
    context = getattr(request.state, 'sample_context', None)
    return templates.TemplateResponse(
        request=request, name=template,
        context={
            'sections': SECTIONS,
            'offline': request.app.state.settings['offline'],
            'persona': context.identity or 'anonymous' if context else 'anonymous',
            'demo_context': context.to_dict() if context else {},
            'csrf_token': request.session.get('csrf_token', ''),
            **values,
        },
        status_code=status_code,
    )


async def render_error(request, error):
    return render(request, 'result.html', status_code=error.status_code,
                  title=f'HTTP {error.status_code}', message=str(error.detail))


def result(request, title, **values):
    return render(request, 'result.html', title=title, **values)


async def checked_form(request: Request):
    # Limit bodies before parsing and compare a token from the signed session.
    # SameSite helps, but is not a replacement for checking state-changing forms.
    body = await request.body()
    if len(body) > 16 * 1024:
        raise HTTPException(413, 'Keep demo form bodies below 16 KiB.')
    form = await request.form()
    token = form.get('csrf_token', '')
    expected = request.session.get('csrf_token', '')
    if not isinstance(token, str) or not expected or not secrets.compare_digest(token, expected):
        raise HTTPException(403, 'Invalid CSRF token. Reload the form and try again.')
    return form


def snapshot(request):
    client = request.app.state.client
    context = request.state.sample_context
    # helper.flags is a process-default snapshot. Evaluate each key explicitly
    # here so this page describes the current user, claims, request and Order.
    return {
        'identity': context.identity,
        'shared_identity': client.current_identity,
        'flags': {key: client.is_enabled(key, context=context) for key in ALL_KEYS},
        'orders': {
            name: client.is_enabled('ExpressCheckout', context=context.with_entity(entity))
            for name, entity in [
                ('ord-vip', order(True)), ('ord-standard', order(False)),
                ('missing', None),
                ('wrong-kind', TogglyEntityContext('Unknown', 'x', {'Vip': True})),
            ]
        },
        'submissions': request.session.get('submissions', 0),
    }


@pages.get('/')
async def home(request: Request):
    client = request.app.state.client
    debug = client.get_debug_info()
    # Full debug info includes the app key. Render only this safe status subset.
    return render(request, 'home.html', snapshot=snapshot(request),
                  initialized=client.is_initialized, last_refresh=debug.last_refresh,
                  refresh_error=bool(debug.last_error))


@pages.get('/api/snapshot/')
async def api_snapshot(request: Request, toggly: TogglyDep):
    before = toggly.context.identity
    await asyncio.sleep(0)  # Another request can run without changing our context.
    values = snapshot(request)
    values['native_identity'] = toggly.context.identity
    values['identity_preserved'] = before == toggly.context.identity
    return values


@pages.get('/gates/')
async def gates(request: Request, toggly: TogglyDep):
    # FastAPI has no SDK Jinja extension. Pass the real native helper to Jinja,
    # whose ordinary if/else branches use its boolean results.
    return render(request, 'gates.html', toggly=toggly)


@pages.get('/programmatic/')
async def programmatic(
    request: Request, toggly: TogglyDep,
    dashboard: bool = Depends(feature_enabled('new-dashboard')),
):
    return render(request, 'programmatic.html', dependency=dashboard,
                  native=toggly.is_enabled('new-dashboard'),
                  explicit=request.app.state.client.is_enabled(
                      'new-dashboard', context=request.state.sample_context))


@pages.get('/identity/')
async def identity(request: Request, context: ContextDep):
    return render(request, 'identity.html', native_context=context.to_dict())


@pages.post('/identity/')
async def change_identity(request: Request, form=Depends(checked_form)):
    choice = form.get('persona')
    if choice == 'clear':
        request.session.clear()
    elif choice in USERS:
        request.session['persona'] = choice
    else:
        raise HTTPException(400, 'Choose Alice, Bob or Clear.')
    # A redirect starts a fresh request with the chosen session principal. This
    # never calls set_identity, reconfigures the shared client or downloads flags.
    return RedirectResponse('/identity/', status_code=303)


@pages.get('/orders/')
async def orders(request: Request, toggly: TogglyDep):
    return render(request, 'orders.html', orders=snapshot(request)['orders'],
                  native=toggly.is_enabled('ExpressCheckout'))


@pages.post('/orders/')
async def change_order(request: Request, form=Depends(checked_form)):
    mode = form.get('order')
    if mode not in {'vip', 'standard', 'missing'}:
        raise HTTPException(400, 'Choose a listed Order.')
    request.session['order'] = mode
    return RedirectResponse('/orders/', status_code=303)


@pages.get('/filters/')
async def filters(request: Request, toggly: TogglyDep):
    rows = []
    for key, alias, _, note in FILTERS:
        rows.append({
            'key': key, 'alias': alias, 'note': note,
            'enabled': request.app.state.client.is_enabled(
                key, context=request.state.sample_context),
            'native': toggly.is_enabled(key),
        })
    return render(request, 'filters.html', rows=rows)


@pages.post('/filters/')
async def change_preset(request: Request, form=Depends(checked_form)):
    preset = form.get('preset')
    if preset not in {'matching', 'nonmatching'}:
        raise HTTPException(400, 'Choose a listed preset.')
    request.session['preset'] = preset
    request.session['persona'] = 'alice' if preset == 'matching' else 'bob'
    request.session['order'] = 'vip' if preset == 'matching' else 'standard'
    return RedirectResponse('/filters/', status_code=303)


@pages.get('/integrations/')
async def integrations(request: Request):
    return render(request, 'integrations.html')


@pages.post('/submit/', dependencies=[Depends(checked_form), Depends(require_feature('enhanced-submit'))])
async def submit(request: Request):
    # Native gate runs before this reversible demo mutation. CSRF remains on.
    # A disabled action returns 403 even when invoked without visiting its page.
    request.session['submissions'] = request.session.get('submissions', 0) + 1
    return result(request, f"Enhanced submission accepted ({request.session['submissions']})")


@pages.get('/native/targeted/', dependencies=[Depends(require_feature('filter-targeting'))])
async def targeted(request: Request):
    return result(request, 'Native require_feature: Alice allowed')


@pages.get('/native/all/', dependencies=[Depends(require_features(['new-dashboard', 'api-v2']))])
async def all_gate(request: Request):
    return result(request, 'Native All gate allowed')


@pages.get('/native/any/', dependencies=[Depends(require_features(
    ['new-dashboard', 'api-v2'], requirement=FeatureRequirement.ANY,
))])
async def any_gate(request: Request):
    return result(request, 'Native Any gate allowed')


@pages.get('/native/negate/')
@feature_gate_required(['new-dashboard', 'api-v2'], negate=True)
async def negate_gate(request: Request):
    return result(request, 'Native negated All gate allowed')


async def old_api(request: Request):
    return result(request, 'API version 1 fallback')


@pages.get('/native/fallback/')
@feature_flag_required('api-v2', fallback=old_api)
async def fallback_gate(request: Request):
    return result(request, 'API version 2')


async def new_api(request: Request):
    return result(request, 'API version 2')


native_switch = feature_switch('api-v2', new_api, old_api)


@pages.get('/native/switch/')
async def switch(request: Request):
    # The SDK's returned callable uses *args/**kwargs, not a FastAPI signature.
    # This typed route supplies Request explicitly while the SDK chooses a view.
    return await native_switch(request=request)


@pages.get('/native/optional/')
async def optional(request: Request, states: dict = Depends(FeatureGateDependency(
    required=['new-dashboard'], optional=['api-v2', 'enhanced-submit'],
))):
    return result(request, 'FeatureGateDependency', states=states)


@feature_beta.get('/welcome/')
async def beta_welcome(request: Request):
    # FeatureFlagRouter wraps this actual endpoint in the native decorator.
    return result(request, 'Native FeatureFlagRouter: beta welcome')


@pages.post('/refresh/', dependencies=[Depends(checked_form)])
async def refresh(request: Request):
    loaded = await anyio.to_thread.run_sync(request.app.state.client.refresh)
    return result(request, f'Native refresh status: {loaded.status.value}',
                  message='Reload a page for a new decision; each worker refreshes independently.')


@pages.post('/variant/', dependencies=[Depends(checked_form)])
async def variant(request: Request):
    settings = request.app.state.settings
    if settings['offline']:
        return result(request, 'No variant assigned in offline fixture mode')
    context = request.state.sample_context
    # Only this explicit action fetches remote assignments. Known identity,
    # groups and claims go into INITIAL config, avoiding anonymous init/refetch.
    # Do not register this async client with the synchronous FastAPI helpers.
    client = AsyncTogglyClient(TogglyConfig(
        app_key=settings['app_key'], environment=settings['environment'],
        base_url=settings['base_url'], use_signed_definitions=True,
        enable_variants=True, identity=context.identity,
        variant_groups=context.groups, variant_claims=context.claims,
        disable_background_refresh=True, enable_live_updates=False,
        enable_usage_tracking=False, enable_metrics=False,
        register_contexts_on_startup=False, connect_timeout=2, request_timeout=3,
    ))
    try:
        loaded = await client.init()
        assigned = await client.get_variant('new-dashboard')  # Async API, cached data.
        return result(request, 'Native async remote assignment',
                      variant=asdict(assigned) if assigned else None,
                      message=f'Load status: {loaded.status.value}; baseline flags have no experiment assignment.')
    finally:
        with anyio.CancelScope(shield=True):
            await client.close()
