"""Published SDK transport/lifecycle checks and actual native AppConfig startup."""
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from unittest import TestCase
from toggly import TogglyClient, TogglyConfig, EvaluationContext
from toggly.enums import LoadStatus
from tests.definitions_server import DefinitionsServer

ROOT = Path(__file__).resolve().parents[1]

class TransportTests(TestCase):
    def config(self, server, **kwargs):
        return TogglyConfig(app_key='fixture-only', base_url=server.url,
            use_signed_definitions=True, enable_usage_tracking=False,
            enable_live_updates=False, register_contexts_on_startup=False,
            request_timeout=1, **kwargs)

    def test_signed_refresh_tamper_last_good_and_recovery(self):
        with DefinitionsServer() as server, TogglyClient(self.config(server, disable_background_refresh=True)) as client:
            self.assertEqual(client.init().status, LoadStatus.FETCHED)
            self.assertTrue(client.is_enabled('new-dashboard'))
            self.assertEqual(client.refresh().status, LoadStatus.CACHED)
            server.change(dashboard=False, mode='tamper')
            self.assertEqual(client.refresh().status, LoadStatus.ERROR)
            self.assertTrue(client.is_enabled('new-dashboard'))
            server.change(dashboard=False, mode='error')
            self.assertEqual(client.refresh().status, LoadStatus.ERROR)
            self.assertTrue(client.is_enabled('new-dashboard'))
            server.change(dashboard=False)
            self.assertEqual(client.refresh().status, LoadStatus.FETCHED)
            self.assertFalse(client.is_enabled('new-dashboard'))
            self.assertFalse(client.is_enabled('unknown-key'))
            self.assertTrue(client.is_enabled('unknown-key', default=True))
            self.assertTrue(any(path == '/.well-known/jwks' for path, _ in server.calls))
            self.assertTrue(any(etag for _, etag in server.calls))

    def test_background_refresh_and_close_stop_network_activity(self):
        with DefinitionsServer() as server:
            client = TogglyClient(self.config(server, refresh_interval=.05))
            try:
                client.init()
                server.change(dashboard=False)
                deadline = time.monotonic() + 3
                while client.is_enabled('new-dashboard') and time.monotonic() < deadline:
                    time.sleep(.02)
                self.assertFalse(client.is_enabled('new-dashboard'))
            finally:
                client.close()
            count = len(server.calls)
            time.sleep(.15)
            self.assertEqual(len(server.calls), count)

    def test_native_appconfig_startup_and_management_no_network(self):
        with DefinitionsServer() as server:
            env = {**os.environ, 'DJANGO_SETTINGS_MODULE': 'config.settings',
                   'TOGGLY_APP_KEY': 'fixture-only', 'TOGGLY_BASE_URL': server.url,
                   'TOGGLY_REFRESH_INTERVAL': '0'}
            env.pop('SAMPLE_MANAGEMENT', None)
            code = '''import django; django.setup()
from django.apps import apps
from toggly_django.utils import get_client
from showcase.apps import close_client
native = apps.get_app_config('toggly_django').client
assert native is get_client()
assert native.is_initialized and native.is_enabled('new-dashboard')
close_client(); close_client()
print('NATIVE_APPCONFIG_OK')'''
            run = subprocess.run([sys.executable, '-c', code], cwd=ROOT, env=env, capture_output=True, text=True, timeout=15)
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertIn('NATIVE_APPCONFIG_OK', run.stdout)
            self.assertEqual(server.calls[0][0], '/definitions-signed/fixture-only/Production')
            count = len(server.calls)
            for command in [['check'], ['makemigrations', '--check', '--dry-run']]:
                run = subprocess.run([sys.executable, 'manage.py', *command], cwd=ROOT, env=env, capture_output=True, text=True, timeout=15)
                self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(len(server.calls), count)

    def test_variant_context_exists_on_first_request(self):
        # Endpoint/name/config consumption proof, separate from signed-definition
        # verification. Do not infer variant cryptographic verification from this.
        with DefinitionsServer() as server, TogglyClient(self.config(server,
            enable_variants=True, identity='alice', variant_groups=['premium'],
            variant_claims={'role': 'admin'}, disable_background_refresh=True)) as client:
            client.init()
            self.assertEqual(client.get_variant('new-dashboard').name, 'compact')
            query = parse_qs(urlparse(server.calls[0][0]).query)
            self.assertEqual(query['userId'], ['alice'])
            self.assertIn('premium', server.calls[0][0])
            self.assertIn('admin', server.calls[0][0])
