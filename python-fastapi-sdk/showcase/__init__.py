"""FastAPI factory and worker-owned client lifecycle. Read this file first."""
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
import anyio
from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware
from starlette.staticfiles import StaticFiles
from toggly import TogglyClient, TogglyConfig
from toggly_fastapi import configure_toggly, TogglyASGIMiddleware
from .catalog import ALL_KEYS
from .context import DemoContextMiddleware
from .offline import create_offline_client


def create_app(overrides=None):
    settings = {
        'app_key': os.getenv('TOGGLY_APP_KEY', ''),
        'environment': os.getenv('TOGGLY_ENVIRONMENT', 'Production'),
        'base_url': os.getenv('TOGGLY_BASE_URL', 'https://definitions.toggly.io'),
        'refresh_interval': float(os.getenv('TOGGLY_REFRESH_INTERVAL', '30')),
        'secret': os.getenv('SAMPLE_SESSION_SECRET', ''),
        'production': os.getenv('SAMPLE_PRODUCTION') == '1',
        'https': os.getenv('SAMPLE_HTTPS') == '1',
    }
    settings.update(overrides or {})
    if not settings['secret']:
        if settings['production']:
            raise ValueError('Set SAMPLE_SESSION_SECRET to a locally generated stable secret.')
        settings['secret'] = secrets.token_urlsafe(64)
    settings['offline'] = settings['app_key'] in ('', 'ci-placeholder')

    def initialize():
        if settings['offline']:
            client = create_offline_client()
        else:
            client = TogglyClient(TogglyConfig(
                app_key=settings['app_key'],
                environment=settings['environment'],
                base_url=settings['base_url'],
                feature_defaults={key: False for key in ALL_KEYS},
                use_signed_definitions=True,
                refresh_interval=settings['refresh_interval'],
                disable_background_refresh=settings['refresh_interval'] <= 0,
                enable_live_updates=False,
                enable_usage_tracking=False,
                enable_metrics=False,
                register_contexts_on_startup=False,
                connect_timeout=2,
                request_timeout=3,
            ))
            try:
                client.init()
            except BaseException:
                client.close()
                raise
        # The native adapter stores one application-wide reference. Register
        # exactly once per worker; never replace it from a request's identity.
        configure_toggly(client=client)
        return client

    @asynccontextmanager
    async def lifespan(app):
        # Startup HTTP and synchronous close/refresh run in a worker thread.
        # Ordinary helper checks are local, synchronous calls, NOT awaitables.
        app.state.client = await anyio.to_thread.run_sync(initialize)
        app.state.closed = False
        try:
            yield
        finally:
            # Wait for cleanup even if the lifespan task is being cancelled.
            # Request completion must never close this shared worker client.
            with anyio.CancelScope(shield=True):
                await anyio.to_thread.run_sync(app.state.client.close)
            app.state.closed = True

    app = FastAPI(title='Toggly FastAPI SDK Workshop', lifespan=lifespan)
    app.state.settings = settings
    from .routes import pages, beta, render_error
    app.include_router(pages)
    app.include_router(beta, prefix='/beta')
    app.mount('/static', StaticFiles(directory=Path(__file__).parent / 'static'), name='static')
    from starlette.exceptions import HTTPException
    app.add_exception_handler(HTTPException, render_error)
    # add_middleware wraps from last to first: session -> demo context -> native
    # Toggly -> endpoint. The user and Order therefore exist before any gate.
    app.add_middleware(TogglyASGIMiddleware)
    app.add_middleware(DemoContextMiddleware)
    app.add_middleware(
        SessionMiddleware, secret_key=settings['secret'], session_cookie='toggly_demo',
        same_site='lax', https_only=settings['https'], max_age=3600,
    )
    return app
