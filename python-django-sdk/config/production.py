"""Production configuration; use HTTPS in a deployed environment."""
from .settings import *  # noqa: F403
from django.core.exceptions import ImproperlyConfigured

if not os.getenv('DJANGO_SECRET_KEY'):
    raise ImproperlyConfigured('DJANGO_SECRET_KEY must be supplied for production')
DEBUG = False
# Explicit local HTTP smoke option. Never enable this behind a public origin.
LOCAL_HTTP = os.getenv('DJANGO_LOCAL_HTTP') == '1'
SESSION_COOKIE_SECURE = not LOCAL_HTTP
CSRF_COOKIE_SECURE = not LOCAL_HTTP
SECURE_SSL_REDIRECT = not LOCAL_HTTP
SECURE_HSTS_SECONDS = 31536000 if not LOCAL_HTTP else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
