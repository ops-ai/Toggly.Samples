"""Compose application context before any native request helper evaluation."""
from django.conf import settings
from toggly import TogglyEntityContext
from toggly.context import HttpRequestMapper
from toggly_django.utils import get_context_from_request

CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'

def order(vip):
    key = 'ord-vip' if vip else 'ord-standard'
    return TogglyEntityContext(kind='Order', key=key, attributes={'Id': key, 'Vip': vip, 'Total': 125.0})

class DemoContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    def __call__(self, request):
        preset = request.session.get('preset', 'matching')
        matching = preset == 'matching'
        entity_mode = request.session.get('order', 'vip' if matching else 'standard')
        request.toggly_entity = None if entity_mode == 'missing' else order(entity_mode == 'vip')
        # Native extraction sees the authenticated Django user and the entity.
        # It does not map claims or HTTP segment fields. Build an explicit copy
        # for the matrix/programmatic calls without touching any SDK private cache.
        context = get_context_from_request(request)
        claims = {'role': 'admin' if request.user.is_staff else 'user'} if request.user.is_authenticated else {}
        headers = {'User-Agent': CHROME if matching else FIREFOX,
                   'Accept-Language': 'en-US,en;q=0.9' if matching else 'fr-FR,fr;q=0.9',
                   'cf-ipcountry': 'US' if matching else 'CA'}
        request.sample_context = HttpRequestMapper.merge_into(headers, context.with_claims(claims))
        request.demo_preset = preset
        # No global identity, thread-local, or ContextVar is written. The request
        # owns these values; error handling discards them with the request too.
        response = self.get_response(request)
        response['Cache-Control'] = 'private, no-store'
        return response

def showcase_context(request):
    # Native traits include the authentication session key. Keep it internal;
    # the teaching display must never print a usable session credential.
    display = request.sample_context.to_dict()
    display['traits'] = {key: value for key, value in display['traits'].items() if key != 'session_id'}
    return {'offline': settings.OFFLINE, 'demo_context': display,
            'persona': request.sample_context.identity or 'anonymous',
            'preset': request.demo_preset}
