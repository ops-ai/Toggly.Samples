"""Prepare a request before the native helper caches its first context read."""
import secrets
from dataclasses import dataclass
from starlette.requests import Request
from toggly import HttpRequestMapper, TogglyEntityContext
from toggly_fastapi import get_context_from_request

CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'


@dataclass(frozen=True)
class DemoUser:
    id: str
    roles: tuple[str, ...]


USERS = {
    'alice': DemoUser('alice', ('admin',)),
    'bob': DemoUser('bob', ('user',)),
}


def order(vip):
    key = 'ord-vip' if vip else 'ord-standard'
    return TogglyEntityContext('Order', key, {
        'Id': key, 'Vip': vip, 'Total': 125.0,
    })


class DemoContextMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return
        request = Request(scope)
        # These fixed demo identities come from this signed session. Replace the
        # buttons with verified authentication in your application; a feature
        # flag is a release decision, not permission to impersonate another user.
        request.state.user = USERS.get(request.session.get('persona'))
        matching = request.session.get('preset', 'matching') == 'matching'
        mode = request.session.get('order', 'vip' if matching else 'standard')
        request.state.toggly_entity = None if mode == 'missing' else order(mode == 'vip')
        request.session.setdefault('csrf_token', secrets.token_urlsafe(32))

        base = get_context_from_request(request)
        user = request.state.user
        claims = {'role': user.roles[0]} if user else {}
        headers = {
            'User-Agent': CHROME if matching else FIREFOX,
            'Accept-Language': 'en-US,en;q=0.9' if matching else 'fr-FR,fr;q=0.9',
            'cf-ipcountry': 'US' if matching else 'CA',
        }
        # Native extraction has identity/groups/traits/Order, but no structured
        # claims/request segments. The explicit matrix context adds those here.
        # These are simulated preset headers, not the visitor's measured device.
        request.state.sample_context = HttpRequestMapper.merge_into(
            headers, base.with_claims(claims)
        )

        async def private_response(message):
            if message['type'] == 'http.response.start':
                message.setdefault('headers', []).append(
                    (b'cache-control', b'private, no-store')
                )
            await send(message)

        await self.app(scope, receive, private_response)
