"""Actual SDK HTTP/ES256 transport and extension startup, separate from live proof."""
import re
import time
import unittest
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch
from toggly import TogglyClient, TogglyConfig, get_default_client
from toggly.enums import LoadStatus
from showcase import create_app, close_client
from tests.definitions_server import DefinitionsServer

class TransportTests(unittest.TestCase):
    def config(self, server, **kwargs):
        return TogglyConfig(app_key='fixture-only', base_url=server.url,
            use_signed_definitions=True, enable_usage_tracking=False,
            enable_live_updates=False, register_contexts_on_startup=False,
            request_timeout=1, **kwargs)
    def test_signed_refresh_tamper_last_good_and_recovery(self):
        with DefinitionsServer() as server, TogglyClient(self.config(server,disable_background_refresh=True)) as client:
            self.assertEqual(client.init().status,LoadStatus.FETCHED)
            self.assertTrue(client.is_enabled('new-dashboard'))
            self.assertEqual(client.refresh().status,LoadStatus.CACHED)
            server.change(dashboard=False,mode='tamper')
            self.assertEqual(client.refresh().status,LoadStatus.ERROR)
            self.assertTrue(client.is_enabled('new-dashboard'))
            server.change(dashboard=False,mode='error')
            self.assertEqual(client.refresh().status,LoadStatus.ERROR)
            self.assertTrue(client.is_enabled('new-dashboard'))
            server.change(dashboard=False)
            self.assertEqual(client.refresh().status,LoadStatus.FETCHED)
            self.assertFalse(client.is_enabled('new-dashboard'))
            self.assertFalse(client.is_enabled('unknown-key'))
            self.assertTrue(client.is_enabled('unknown-key',default=True))
            self.assertTrue(any(path=='/.well-known/jwks' for path,_ in server.calls))
            self.assertTrue(any(etag for _,etag in server.calls))
    def test_background_refresh_and_close(self):
        with DefinitionsServer() as server:
            client=TogglyClient(self.config(server,refresh_interval=.05))
            try:
                client.init();server.change(dashboard=False)
                deadline=time.monotonic()+3
                while client.is_enabled('new-dashboard') and time.monotonic()<deadline:time.sleep(.02)
                self.assertFalse(client.is_enabled('new-dashboard'))
            finally:client.close()
            count=len(server.calls);time.sleep(.15)
            self.assertEqual(len(server.calls),count)
    def test_automatic_extension_context_no_refetch_and_remote_action(self):
        with DefinitionsServer() as server:
            app=create_app({'TESTING':True,'SECRET_KEY':'test-only', 'TOGGLY_APP_KEY':'fixture-only',
                'TOGGLY_BASE_URL':server.url,'TOGGLY_REFRESH_INTERVAL':0})
            client=app.extensions['toggly'].client
            self.assertIs(client,get_default_client())
            self.assertTrue(client.is_initialized)
            self.assertEqual(server.calls[0][0],'/definitions-signed/fixture-only/Production')
            try:
                http=app.test_client()
                def post(path,values):
                    token=re.search(r'name="csrf_token" value="([^"]+)"',http.get('/').text).group(1)
                    return http.post(path,data={**values,'csrf_token':token})
                count=len(server.calls)
                post('/filters/',{'preset':'matching'})
                self.assertEqual(http.get('/native/targeted/').status_code,200)
                self.assertTrue(http.get('/api/snapshot/').json['flags']['ExpressCheckout'])
                post('/filters/',{'preset':'nonmatching'})
                self.assertEqual(http.get('/native/targeted/').status_code,403)
                self.assertFalse(http.get('/api/snapshot/').json['flags']['ExpressCheckout'])
                self.assertEqual(len(server.calls),count)
                self.assertIsNone(client.current_identity)
                post('/filters/',{'preset':'matching'})
                # Wrap close only to observe ownership; SDK networking/evaluation
                # remains native. Assignment parsing is not signing-verifier proof.
                closed=[]
                original=TogglyClient.close
                def close(observed):
                    closed.append(observed);original(observed)
                with patch.object(TogglyClient,'close',close):
                    response=post('/variant/',{})
                self.assertEqual(response.status_code,200)
                self.assertIn('compact',response.text)
                self.assertEqual(len(closed),1);self.assertIsNot(closed[0],client)
                self.assertIs(get_default_client(),client)
                variants=[path for path,_ in server.calls if path.startswith('/evaluated-variants-signed/')]
                self.assertEqual(len(variants),1)
                query=parse_qs(urlparse(variants[0]).query)
                self.assertEqual(query['userId'],['alice']);self.assertIn('admin',variants[0])
                server.change(dashboard=False)
                self.assertIn('fetched',post('/refresh/',{}).text)
                self.assertIn('Classic dashboard fallback',http.get('/gates/').text)
                self.assertIn('Native variant default: feature OFF',http.get('/native/variant/').text)
            finally:
                with patch.object(client,'close',wraps=client.close) as close:
                    close_client(app);close_client(app)
                    self.assertEqual(close.call_count,1)
    def test_automatic_extension_offline_defaults_and_denied_mutation(self):
        # Toggly(app) itself supports defaults without a key. Test that constructor
        # independently of the sample's richer snapshot fixture branch.
        from flask import Flask
        from toggly_flask import Toggly, feature_flag_required
        app=Flask(__name__)
        from flask_login import LoginManager
        login=LoginManager(app)
        login.user_loader(lambda identity:None)
        app.config.update(TOGGLY_FEATURE_DEFAULTS={'enhanced-submit':False},
            TOGGLY_DISABLE_BACKGROUND_REFRESH=True,TOGGLY_ENABLE_USAGE_TRACKING=False)
        extension=Toggly(app)
        calls=[]
        @app.post('/action')
        @feature_flag_required('enhanced-submit')
        def action():calls.append('changed');return 'changed'
        try:
            self.assertTrue(extension.client.is_initialized)
            self.assertEqual(app.test_client().post('/action').status_code,403)
            self.assertEqual(calls,[])
        finally:extension.client.close()

if __name__=='__main__':unittest.main()
