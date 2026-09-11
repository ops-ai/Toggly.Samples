"""Native signed HTTP definitions, app startup, async assignment and ownership."""
import asyncio
import time
import unittest
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch
import httpx
from toggly import TogglyClient, TogglyConfig, AsyncTogglyClient, get_default_client
from toggly.enums import LoadStatus
from showcase import create_app
from tests.definitions_server import DefinitionsServer
from tests.test_native import post


class SignedTransportTests(unittest.TestCase):
    def config(self, server, **kwargs):
        return TogglyConfig(
            app_key='fixture-only', base_url=server.url,
            use_signed_definitions=True, enable_usage_tracking=False,
            enable_metrics=False, enable_live_updates=False,
            register_contexts_on_startup=False, request_timeout=1, **kwargs,
        )

    def test_signed_tamper_error_etag_last_good_recovery(self):
        with DefinitionsServer() as server:
            with TogglyClient(self.config(server, disable_background_refresh=True)) as client:
                self.assertEqual(client.init().status, LoadStatus.FETCHED)
                self.assertTrue(client.is_enabled('new-dashboard'))
                self.assertEqual(client.refresh().status, LoadStatus.CACHED)
                for mode in ['tamper', 'error']:
                    server.change(dashboard=False, mode=mode)
                    self.assertEqual(client.refresh().status, LoadStatus.ERROR)
                    self.assertTrue(client.is_enabled('new-dashboard'))
                server.change(dashboard=False)
                self.assertEqual(client.refresh().status, LoadStatus.FETCHED)
                self.assertFalse(client.is_enabled('new-dashboard'))
                self.assertFalse(client.is_enabled('unknown'))
                self.assertTrue(client.is_enabled('unknown', default=True))
                self.assertTrue(any(path == '/.well-known/jwks' for path, _ in server.calls))
                self.assertTrue(any(etag for _, etag in server.calls))

    def test_background_refresh_and_close_stops_requests(self):
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


class AppTransportTests(unittest.IsolatedAsyncioTestCase):
    def app(self, server):
        return create_app({
            'app_key': 'fixture-only', 'base_url': server.url,
            'refresh_interval': 0, 'secret': 'test-session-only', 'production': True,
        })

    async def test_real_lifespan_no_refetch_initial_async_variants_and_close(self):
        with DefinitionsServer() as server:
            app = self.app(server)
            async with app.router.lifespan_context(app):
                client = app.state.client
                self.assertIs(get_default_client(), client)
                self.assertTrue(client.is_initialized)
                self.assertEqual(server.calls[0][0], '/definitions-signed/fixture-only/Production')
                async with httpx.AsyncClient(
                    transport=httpx.ASGITransport(app=app), base_url='http://sample',
                    follow_redirects=True,
                ) as http:
                    count = len(server.calls)
                    for preset, expected in [('matching', 200), ('nonmatching', 403)]:
                        await post(http, '/filters/', preset=preset)
                        self.assertEqual((await http.get('/native/targeted/')).status_code, expected)
                    self.assertEqual(len(server.calls), count)
                    self.assertIsNone(client.current_identity)
                    await post(http, '/filters/', preset='matching')
                    closed = []
                    original = AsyncTogglyClient.close

                    async def observe_close(observed):
                        closed.append(observed)
                        await original(observed)

                    with patch.object(AsyncTogglyClient, 'close', observe_close):
                        response = await post(http, '/variant/')
                    self.assertEqual(response.status_code, 200, response.text)
                    self.assertIn('compact', response.text)
                    self.assertEqual(len(closed), 1)
                    self.assertIs(get_default_client(), client)
                    variants = [p for p, _ in server.calls if p.startswith('/evaluated-variants-signed/')]
                    self.assertEqual(len(variants), 1)
                    query = parse_qs(urlparse(variants[0]).query)
                    self.assertEqual(query['userId'], ['alice'])
                    self.assertIn('admin', variants[0])
                    server.change(dashboard=False)
                    self.assertIn('fetched', (await post(http, '/refresh/')).text)
                    self.assertIn('Classic dashboard fallback', (await http.get('/gates/')).text)
            self.assertTrue(app.state.closed)

    async def test_worker_shutdown_owns_exactly_one_close(self):
        with DefinitionsServer() as server:
            app = self.app(server)
            life = app.router.lifespan_context(app)
            await life.__aenter__()
            with patch.object(app.state.client, 'close', wraps=app.state.client.close) as close:
                await life.__aexit__(None, None, None)
                self.assertEqual(close.call_count, 1)
            self.assertTrue(app.state.closed)

    async def test_cancelled_async_assignment_closes_without_replacing_worker(self):
        with DefinitionsServer() as server:
            server.variant_delay = .2
            app = self.app(server)
            async with app.router.lifespan_context(app):
                async with httpx.AsyncClient(
                    transport=httpx.ASGITransport(app=app), base_url='http://sample',
                    follow_redirects=True,
                ) as http:
                    await post(http, '/filters/', preset='matching')
                    closed = []
                    original = AsyncTogglyClient.close

                    async def observe_close(client):
                        closed.append(client)
                        await original(client)

                    with patch.object(AsyncTogglyClient, 'close', observe_close):
                        task = asyncio.create_task(post(http, '/variant/'))
                        deadline = time.monotonic() + 3
                        while not server.variant_started.is_set():
                            self.assertLess(time.monotonic(), deadline)
                            await asyncio.sleep(.01)
                        task.cancel()
                        with self.assertRaises(asyncio.CancelledError):
                            await task
                    self.assertEqual(len(closed), 1)
                    self.assertIs(get_default_client(), app.state.client)
                    self.assertFalse(app.state.closed)
                    self.assertEqual((await http.get('/')).status_code, 200)
                    # The SDK offloads urllib I/O to an executor; cancelling the
                    # coroutine does not abort that already-running HTTP call.
                    await asyncio.sleep(.25)

    async def test_initial_failure_defaults_deny_mutation(self):
        with DefinitionsServer() as server:
            server.mode = 'error'
            app = self.app(server)
            async with app.router.lifespan_context(app):
                async with httpx.AsyncClient(
                    transport=httpx.ASGITransport(app=app), base_url='http://sample',
                    follow_redirects=True,
                ) as http:
                    self.assertEqual((await http.get('/')).status_code, 200)
                    self.assertEqual((await post(http, '/submit/')).status_code, 403)
                    data = (await http.get('/api/snapshot/')).json()
                    self.assertEqual(data['submissions'], 0)
                    self.assertTrue(all(value is False for value in data['flags'].values()))


if __name__ == '__main__':
    unittest.main()
