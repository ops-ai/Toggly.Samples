"""Fixed demo principals and explicit user/entity/request context composition."""
from dataclasses import dataclass
from flask import g, session
from flask_login import UserMixin, current_user
from toggly import HttpRequestMapper, TogglyEntityContext
from toggly_flask import get_context_from_request

CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'

@dataclass
class DemoUser(UserMixin):
    id: str
    is_admin: bool
    @property
    def roles(self): return ['admin'] if self.is_admin else ['user']

USERS = {'alice': DemoUser('alice', True), 'bob': DemoUser('bob', False)}

def order(vip):
    key = 'ord-vip' if vip else 'ord-standard'
    return TogglyEntityContext('Order', key, {'Id': key, 'Vip': vip, 'Total': 125.0})

def prepare_context():
    matching = session.get('preset', 'matching') == 'matching'
    mode = session.get('order', 'vip' if matching else 'standard')
    g.toggly_entity = None if mode == 'missing' else order(mode == 'vip')
    context = get_context_from_request()
    claims = {'role': 'admin' if current_user.is_admin else 'user'} if current_user.is_authenticated else {}
    headers = {'User-Agent': CHROME if matching else FIREFOX,
        'Accept-Language': 'en-US,en;q=0.9' if matching else 'fr-FR,fr;q=0.9',
        'cf-ipcountry': 'US' if matching else 'CA'}
    # Native extraction gives identity/groups/traits/Order, not structured
    # claims or request segments. Compose a copy for the matrix. These headers
    # are SIMULATED preset inputs, not claims about the visiting browser.
    g.sample_context = HttpRequestMapper.merge_into(headers, context.with_claims(claims))
    g.demo_preset = 'matching' if matching else 'nonmatching'

def template_context():
    # CSRF/error responses can render before our before_request handler ran.
    context = getattr(g, 'sample_context', None)
    return {'persona': context.identity if context and context.identity else 'anonymous',
        'preset': getattr(g, 'demo_preset', 'matching'),
        'demo_context': context.to_dict() if context else {}}
