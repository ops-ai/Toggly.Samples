"""Exercise the installed SDK through Django's real request stack."""
from concurrent.futures import ThreadPoolExecutor
from django.test import Client, TransactionTestCase
from toggly_django.utils import get_client


class NativeShowcaseTests(TransactionTestCase):
    def setUp(self):
        from showcase.models import User
        for name, staff in [('alice', True), ('bob', False)]:
            User.objects.create_user(username=name, is_staff=staff, password=None)

    def persona(self, name):
        browser = Client()
        self.assertEqual(browser.post('/identity/', {'persona': name}).status_code, 302)
        self.assertEqual(browser.post('/filters/', {'preset': 'matching' if name == 'alice' else 'nonmatching'}).status_code, 302)
        return browser

    def test_all_sections_and_native_gates(self):
        browser = self.persona('alice')
        for path in ['/', '/gates/', '/programmatic/', '/identity/', '/orders/', '/filters/', '/integrations/']:
            response = browser.get(path)
            self.assertEqual(response.status_code, 200, path)
            self.assertContains(response, 'Missing TOGGLY_APP_KEY')
            self.assertNotContains(response, browser.session.session_key)
        self.assertContains(browser.get('/gates/'), 'Native block: ON')
        self.assertContains(browser.get('/gates/'), 'Any gate: ON')
        self.assertContains(browser.get('/gates/'), 'Context processor (ExpressCheckout): ON')
        self.assertContains(browser.get('/gates/'), 'All gate: OFF')
        self.assertEqual(browser.get('/native/targeted/').status_code, 200)
        self.assertEqual(self.persona('bob').get('/native/targeted/').status_code, 403)
        self.assertEqual(browser.get('/native/all/').status_code, 403)
        self.assertEqual(browser.get('/native/any/').status_code, 200)
        self.assertEqual(browser.get('/native/negated/').status_code, 200)
        self.assertEqual(browser.get('/native/redirect/').status_code, 302)
        self.assertContains(browser.get('/native/switch/'), 'API version 1')
        self.assertEqual(browser.post('/submit/').status_code, 200)
        self.assertEqual(browser.get('/submit/').status_code, 405)

    def test_matrix_presets_and_native_extraction_boundary(self):
        for name in ['alice', 'bob']:
            payload = self.persona(name).get('/api/snapshot/').json()
            flags = payload['flags']
            self.assertEqual(len(flags), 16)
            for key in ['filter-targeting', 'filter-user-claims', 'filter-country', 'filter-browser-family', 'filter-browser-language', 'filter-os', 'filter-context-property']:
                self.assertEqual(flags[key], name == 'alice', key)
            self.assertTrue(flags['filter-always-on'])
            self.assertTrue(flags['filter-time-window'])
            self.assertFalse(flags['filter-device-type'])  # Native Macintosh classifier gap.
            self.assertFalse(payload['native_claims'])
            self.assertFalse(payload['native_country'])
            self.assertEqual(payload['orders'], {'ord-vip': True, 'ord-standard': False, 'missing': False, 'wrong-kind': True})
            self.assertEqual(payload['identity'], name)
            self.assertIsNone(payload['shared_identity'])

    def test_concurrent_sessions_order_and_cleanup(self):
        alice, bob = self.persona('alice'), self.persona('bob')
        def evaluate(i):
            source = alice if i % 2 == 0 else bob
            browser = Client()
            browser.cookies = source.cookies.copy()
            response = browser.get('/api/snapshot/').json()
            return i, response
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(evaluate, range(48)))
        for i, row in results:
            self.assertEqual(row['identity'], 'alice' if i % 2 == 0 else 'bob')
            self.assertEqual(row['flags']['ExpressCheckout'], i % 2 == 0)
            self.assertEqual(row['orders']['ord-vip'], True)
            self.assertEqual(row['orders']['ord-standard'], False)
        self.assertEqual(alice.post('/identity/', {'persona': 'clear'}).status_code, 302)
        self.assertIsNone(alice.get('/api/snapshot/').json()['identity'])
        self.assertEqual(bob.get('/api/snapshot/').json()['identity'], 'bob')
        self.assertIsNone(get_client().current_identity)

    def test_csrf_is_enforced(self):
        browser = Client(enforce_csrf_checks=True)
        self.assertEqual(browser.post('/identity/', {'persona': 'alice'}).status_code, 403)

    def test_native_denied_action_and_template_fallback(self):
        from toggly_django.utils import configure_toggly
        from toggly import TogglyClient, TogglyConfig
        from toggly.providers import DefinitionsSnapshot, MemorySnapshotProvider
        from toggly.models import FeatureFilter
        from showcase.offline import definitions
        original = get_client()
        rows = definitions()
        for definition in rows:
            if definition.feature_key in {'enhanced-submit', 'new-dashboard'}:
                definition.filters = [FeatureFilter('AlwaysOff')]
        provider = MemorySnapshotProvider()
        provider.save_definitions(DefinitionsSnapshot(definitions=rows))
        replacement = TogglyClient(TogglyConfig(snapshot_provider=provider,
            disable_background_refresh=True, enable_live_updates=False, enable_usage_tracking=False))
        replacement.init()
        configure_toggly(client=replacement)
        try:
            browser = self.persona('alice')
            self.assertContains(browser.get('/gates/'), 'Native block: OFF')
            self.assertContains(browser.get('/gates/'), 'Context processor (ExpressCheckout): ON')
            self.assertEqual(browser.post('/submit/').status_code, 403)
            self.assertNotIn('submissions', browser.session)
            # Snapshot is evaluated now, not retained from a previous page render.
            self.assertFalse(browser.get('/api/snapshot/').json()['flags']['new-dashboard'])
        finally:
            configure_toggly(client=original)
            replacement.close()

    def test_exception_does_not_leave_request_identity_or_order(self):
        from django.test import override_settings
        alice, bob = self.persona('alice'), self.persona('bob')
        with override_settings(ROOT_URLCONF='tests.error_urls'):
            alice.raise_request_exception = False
            self.assertEqual(alice.get('/test-error/').status_code, 500)
            payload = bob.get('/api/snapshot/').json()
            self.assertEqual(payload['identity'], 'bob')
            self.assertFalse(payload['flags']['ExpressCheckout'])
            self.assertIsNone(get_client().current_identity)

    def test_variant_action_uses_native_client_with_current_persona_and_closes(self):
        from django.test import override_settings
        from unittest.mock import patch
        from urllib.parse import parse_qs, urlparse
        from toggly import TogglyClient
        from tests.definitions_server import DefinitionsServer
        browser = self.persona('alice')
        original_close = TogglyClient.close
        with DefinitionsServer() as server, override_settings(OFFLINE=False, APP_KEY='fixture-only',
            TOGGLY={'ENVIRONMENT': 'Production', 'BASE_URL': server.url}):
            with patch.object(TogglyClient, 'close', autospec=True, side_effect=original_close) as closed:
                self.assertContains(browser.post('/variant/'), 'compact')
                self.assertEqual(closed.call_count, 1)
            query = parse_qs(urlparse(server.calls[0][0]).query)
            self.assertEqual(query['userId'], ['alice'])
            self.assertIn('admin', server.calls[0][0])
            self.assertEqual(len(server.calls), 1)
            self.assertIsNone(get_client().current_identity)
