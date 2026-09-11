"""Actual native lifespan, ASGI requests and session isolation; no fake evaluator."""
import asyncio
import re
import unittest
from unittest.mock import patch
import httpx
from fastapi import Request
from toggly_fastapi import TogglyDep
from toggly_fastapi.middleware import get_current_toggly
from showcase import create_app
from showcase.catalog import ALL_KEYS


def token(response):
    return re.search(r'name="csrf_token" value="([^"]+)"', response.text).group(1)


async def post(http, path, **values):
    csrf = token(await http.get('/'))
    return await http.post(path, data={'csrf_token': csrf, **values})


class NativeTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.app = create_app({'app_key': '', 'secret': 'test-session-only', 'production': True})
        self.life = self.app.router.lifespan_context(self.app)
        await self.life.__aenter__()
        self.http = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app), base_url='http://sample',
            follow_redirects=True,
        )

    async def asyncTearDown(self):
        await self.http.aclose()
        await self.life.__aexit__(None, None, None)
        self.assertTrue(self.app.state.closed)
        self.assertIsNone(get_current_toggly())

    async def test_sections_and_exact_native_gates(self):
        for path in ['/', '/gates/', '/programmatic/', '/identity/', '/orders/', '/filters/', '/integrations/']:
            response = await self.http.get(path)
            self.assertEqual(response.status_code, 200, path)
            self.assertIn('Missing TOGGLY_APP_KEY', response.text)
            self.assertEqual(response.headers['cache-control'], 'private, no-store')
        response = await self.http.get('/gates/')
        self.assertIn('New dashboard panel', response.text)
        self.assertIn('Any: <strong>True', response.text)
        self.assertIn('All: <strong>False', response.text)
        self.assertIn('Negated All: <strong>True', response.text)
        for path, status, text in [
            ('/native/all/', 403, 'HTTP 403'),
            ('/native/any/', 200, 'Native Any gate allowed'),
            ('/native/negate/', 200, 'Native negated All gate allowed'),
            ('/native/fallback/', 200, 'API version 1 fallback'),
            ('/native/switch/', 200, 'API version 1 fallback'),
            ('/native/optional/', 200, 'FeatureGateDependency'),
            ('/beta/welcome/', 200, 'Native FeatureFlagRouter'),
            ('/native/targeted/', 403, 'HTTP 403'),
        ]:
            response = await self.http.get(path)
            self.assertEqual(response.status_code, status, path)
            self.assertIn(text, response.text)
        self.assertIn('No variant assigned', (await post(self.http, '/variant/')).text)

    async def test_presets_matrix_and_entity_copy(self):
        for preset, identity, expected in [('matching', 'alice', True), ('nonmatching', 'bob', False)]:
            response = await post(self.http, '/filters/', preset=preset)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.text.count('data-key="filter-'), 11)
            data = (await self.http.get('/api/snapshot/')).json()
            self.assertEqual(set(data['flags']), set(ALL_KEYS))
            self.assertEqual(data['identity'], identity)
            self.assertEqual(data['native_identity'], identity)
            self.assertTrue(data['identity_preserved'])
            self.assertIsNone(data['shared_identity'])
            for key in ['filter-targeting', 'filter-user-claims', 'filter-country',
                        'filter-browser-family', 'filter-browser-language', 'filter-os',
                        'filter-context-property', 'ExpressCheckout']:
                self.assertEqual(data['flags'][key], expected, key)
            self.assertTrue(data['flags']['filter-always-on'])
            self.assertTrue(data['flags']['filter-time-window'])
            self.assertFalse(data['flags']['filter-device-type'])
            self.assertEqual(data['orders'], {
                'ord-vip': True, 'ord-standard': False, 'missing': False, 'wrong-kind': True,
            })
            # Both rows remain actual SDK calls, including the documented lack
            # of structured claims/request in the native helper's extraction.
            claims = re.search(r'data-key="filter-user-claims"(.*?)</tr>', response.text, re.S).group(1)
            self.assertIn('<td class="off">OFF</td>', claims)
            targeted = await self.http.get('/native/targeted/')
            self.assertEqual(targeted.status_code, 200 if expected else 403)

    async def test_identity_clear_and_selected_order_before_helper(self):
        await post(self.http, '/identity/', persona='alice')
        for mode, expected in [('vip', True), ('standard', False), ('missing', False)]:
            response = await post(self.http, '/orders/', order=mode)
            self.assertIn(f'Native helper for selected Order: {expected}', response.text)
        await post(self.http, '/identity/', persona='clear')
        data = (await self.http.get('/api/snapshot/')).json()
        self.assertIsNone(data['identity'])
        self.assertIsNone(data['shared_identity'])
        self.assertEqual((await self.http.get('/native/targeted/')).status_code, 403)

    async def test_csrf_reversible_action_and_input_validation(self):
        response = await self.http.get('/')
        cookie = response.headers.get('set-cookie', '').lower()
        self.assertIn('httponly', cookie)
        self.assertIn('samesite=lax', cookie)
        self.assertEqual((await self.http.get('/submit/')).status_code, 405)
        self.assertEqual((await self.http.post('/submit/')).status_code, 403)
        self.assertIn('Enhanced submission accepted (1)', (await post(self.http, '/submit/')).text)
        self.assertEqual((await post(self.http, '/identity/', persona='mallory')).status_code, 400)
        self.assertEqual((await post(self.http, '/filters/', preset='other')).status_code, 400)
        self.assertEqual((await post(self.http, '/orders/', order='other')).status_code, 400)
        data = (await self.http.get('/api/snapshot/')).json()
        self.assertEqual(data['submissions'], 1)

    async def test_concurrent_sessions_across_async_boundary(self):
        async def scenario(index):
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=self.app), base_url='http://sample',
                follow_redirects=True,
            ) as http:
                expected = index % 2 == 0
                identity = 'alice' if expected else 'bob'
                await post(http, '/filters/', preset='matching' if expected else 'nonmatching')
                for _ in range(3):
                    data = (await http.get('/api/snapshot/')).json()
                    self.assertEqual(data['identity'], identity)
                    self.assertEqual(data['native_identity'], identity)
                    self.assertTrue(data['identity_preserved'])
                    self.assertEqual(data['flags']['ExpressCheckout'], expected)
                    self.assertEqual(data['flags']['filter-targeting'], expected)
                    self.assertEqual(data['orders']['ord-vip'], True)
                    self.assertEqual(data['orders']['ord-standard'], False)
                    self.assertIsNone(data['shared_identity'])
                self.assertIsNone(get_current_toggly())
        await asyncio.gather(*(scenario(i) for i in range(24)))

    async def test_native_context_reset_after_exception_and_cancellation(self):
        entered = asyncio.Event()
        seen = []

        @self.app.get('/test-error')
        async def error(toggly: TogglyDep):
            self.assertIs(get_current_toggly(), toggly)
            raise RuntimeError('controlled endpoint error')

        @self.app.get('/test-cancel')
        async def cancelled(toggly: TogglyDep):
            self.assertIs(get_current_toggly(), toggly)
            entered.set()
            await asyncio.Event().wait()

        with self.assertRaisesRegex(RuntimeError, 'controlled endpoint error'):
            await self.http.get('/test-error')
        self.assertIsNone(get_current_toggly())

        async def request_then_observe():
            try:
                await self.http.get('/test-cancel')
            finally:
                seen.append(get_current_toggly())

        task = asyncio.create_task(request_then_observe())
        await entered.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual(seen, [None])
        self.assertEqual((await self.http.get('/')).status_code, 200)
        self.assertFalse(self.app.state.closed)

    async def test_openapi_native_schema_and_static_assets(self):
        response = await self.http.get('/openapi.json')
        schema = response.json()
        self.assertIn('/beta/welcome/', schema['paths'])
        self.assertNotIn('parameters', schema['paths']['/native/switch/']['get'])
        self.assertEqual((await self.http.get('/docs')).status_code, 200)
        self.assertEqual((await self.http.get('/static/style.css')).status_code, 200)
        self.assertEqual((await self.http.get('/not-a-route')).status_code, 404)


if __name__ == '__main__':
    unittest.main()
