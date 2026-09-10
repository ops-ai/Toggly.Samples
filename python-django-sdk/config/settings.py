"""Start here: settings consumed by Django and the native Toggly AppConfig."""
import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')
DEBUG = os.getenv('DJANGO_DEBUG', '1') == '1'
# Development-only ephemeral fallback. Set the stable local secret in .env so
# sessions survive restarts. Production settings below require a supplied secret.
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY') or secrets.token_urlsafe(64)
ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
INSTALLED_APPS = [
    'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions',
    'django.contrib.staticfiles', 'toggly_django.apps.TogglyConfig',
    'showcase.apps.ShowcaseConfig',
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # User and Order must exist before the native helper first reads its context.
    'showcase.context.DemoContextMiddleware',
    'toggly_django.middleware.TogglyMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'APP_DIRS': True, 'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'toggly_django.context_processors.toggly_context',
        'showcase.context.showcase_context',
    ]}}]
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3',
                         'NAME': os.getenv('DJANGO_DATABASE', str(BASE_DIR / 'db.sqlite3'))}}
AUTH_USER_MODEL = 'showcase.User'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
USE_TZ = True
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
APP_KEY = os.getenv('TOGGLY_APP_KEY', '').strip()
OFFLINE = not APP_KEY
MANAGEMENT = os.getenv('SAMPLE_MANAGEMENT') == '1'
TOGGLY = {} if MANAGEMENT else {
    'APP_KEY': APP_KEY or None,
    'ENVIRONMENT': os.getenv('TOGGLY_ENVIRONMENT', 'Production'),
    'BASE_URL': os.getenv('TOGGLY_BASE_URL', 'https://definitions.toggly.io'),
    'USE_SIGNED_DEFINITIONS': True,
    'ENABLE_VARIANTS': False,  # Shared client evaluates local definitions per request.
    'FEATURE_DEFAULTS': {},  # An absent flag defaults OFF.
    'REFRESH_INTERVAL': float(os.getenv('TOGGLY_REFRESH_INTERVAL', '30')),
    'DISABLE_BACKGROUND_REFRESH': OFFLINE,
    'ENABLE_USAGE_TRACKING': False,
    'CONNECT_TIMEOUT': 2.0,
    'REQUEST_TIMEOUT': 3.0,
}
