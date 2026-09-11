"""Flask application factory: configure once, evaluate once per request context."""
import atexit
import os
import secrets
from threading import Lock
from flask import Flask, render_template
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from toggly import set_default_client
from toggly_flask import Toggly
from .catalog import ALL_KEYS
from .context import prepare_context, template_context, USERS
from .offline import create_offline_client


def close_client(app):
    """The worker owns its client. Never close it from Flask request teardown."""
    with app.extensions['sample_close_lock']:
        if not app.extensions.get('sample_closed'):
            app.extensions['toggly'].client.close()
            app.extensions['sample_closed'] = True


def create_app(overrides=None, *, client=None):
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=os.getenv('FLASK_SECRET_KEY'),
        SAMPLE_PRODUCTION=os.getenv('SAMPLE_PRODUCTION') == '1',
        SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Lax',
        SESSION_COOKIE_SECURE=os.getenv('SAMPLE_HTTPS') == '1',
        MAX_CONTENT_LENGTH=16 * 1024,
        TOGGLY_APP_KEY=os.getenv('TOGGLY_APP_KEY', ''),
        TOGGLY_ENVIRONMENT=os.getenv('TOGGLY_ENVIRONMENT', 'Production'),
        TOGGLY_BASE_URL=os.getenv('TOGGLY_BASE_URL', 'https://definitions.toggly.io'),
        TOGGLY_REFRESH_INTERVAL=float(os.getenv('TOGGLY_REFRESH_INTERVAL', '30')),
        TOGGLY_USE_SIGNED_DEFINITIONS=True,
        TOGGLY_CONNECT_TIMEOUT=2, TOGGLY_REQUEST_TIMEOUT=3,
        TOGGLY_FEATURE_DEFAULTS={key: False for key in ALL_KEYS},
        TOGGLY_ENABLE_USAGE_TRACKING=False,
    )
    if overrides:
        app.config.update(overrides)
    if not app.config['SECRET_KEY']:
        if app.config['SAMPLE_PRODUCTION']:
            raise ValueError('Set FLASK_SECRET_KEY to a locally generated stable secret.')
        # Development only. A new process invalidates old demo session cookies.
        app.config['SECRET_KEY'] = secrets.token_urlsafe(64)
    app.config['OFFLINE'] = not app.config['TOGGLY_APP_KEY'] or app.config['TOGGLY_APP_KEY'] == 'ci-placeholder'
    app.config['TOGGLY_DISABLE_BACKGROUND_REFRESH'] = app.config['TOGGLY_REFRESH_INTERVAL'] <= 0

    # When Flask-Login is installed, the adapter reads current_user; configure
    # LoginManager even if your current request is anonymous.
    login = LoginManager(app)
    login.user_loader(lambda identity: USERS.get(identity))
    CSRFProtect(app)  # Keep protection on demo mutations and manual refresh too.

    # g.toggly_entity must exist before the native helper's first cached read.
    # Flask-Login resolves the signed session's fixed user lazily here.
    app.before_request(prepare_context)
    if client is None and app.config['OFFLINE']:
        client = create_offline_client()
    if client is not None:
        # Supplied-client integration requires this public registration because
        # native decorators use the core default client. It happens ONCE at
        # startup, never when a user selects a persona or an Order.
        set_default_client(client)
        Toggly(app, client=client)
    else:
        # The real extension reads config, initializes and registers the client.
        # Server-local definitions do not need a future request's identity.
        Toggly(app)
    app.extensions['sample_close_lock'] = Lock()
    app.extensions['sample_closed'] = False
    atexit.register(close_client, app)
    app.context_processor(template_context)

    from .views import pages, beta
    app.register_blueprint(pages)
    app.register_blueprint(beta, url_prefix='/beta')
    for status in (400, 403, 404, 405, 413):
        app.register_error_handler(status, lambda error: (
            render_template('result.html', title=f'HTTP {error.code}', message=error.description), error.code))

    @app.after_request
    def private_response(response):
        # A rendered decision belongs to this user and Order, not a shared CDN.
        response.headers['Cache-Control'] = 'private, no-store'
        return response

    @app.cli.command('check-config')
    def check_config():
        """Validate host shape without printing keys or session credentials."""
        assert not app.debug
        assert app.config['SESSION_COOKIE_HTTPONLY']
        assert app.config['SESSION_COOKIE_SAMESITE'] == 'Lax'
        assert app.extensions['toggly'].client.is_initialized
        print('CONFIG_OK debug=False csrf=True initialized=True')
    return app
