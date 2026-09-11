"""Application composition around the actual native Toggly AppConfig."""
import atexit
from threading import Lock
from django.apps import AppConfig, apps
from django.conf import settings
from toggly_django.utils import configure_toggly

_owned_client = None
_close_lock = Lock()

def close_client():
    """Close only this worker's owned client; safe for manage.py and worker_exit."""
    global _owned_client
    with _close_lock:
        client, _owned_client = _owned_client, None
    if client is not None:
        client.close()

class ShowcaseConfig(AppConfig):
    name = 'showcase'
    def ready(self):
        global _owned_client
        if settings.MANAGEMENT:
            return
        # The preceding *native* AppConfig has already initialized its client.
        client = apps.get_app_config('toggly_django').client
        if settings.OFFLINE:
            # Replace only the absent-key client with supported deterministic
            # snapshot configuration. Live mode keeps the native client intact.
            if client is not None:
                client.close()
            from .offline import create_offline_client
            client = configure_toggly(client=create_offline_client())
        _owned_client = client
        atexit.register(close_client)
