"""Real Flask routing, Jinja, cookies and CSRF; no replacement evaluator."""
from concurrent.futures import ThreadPoolExecutor
import re
import unittest
from flask import g, has_request_context
from toggly import get_default_client
from showcase import create_app, close_client

class NativeTests(unittest.TestCase):
    def setUp(self):
        self.app=create_app({'TESTING':True,'TOGGLY_APP_KEY':'','SECRET_KEY':'test-only-session-signing-value'})
        self.http=self.app.test_client()
    def tearDown(self): close_client(self.app)
    def token(self,http=None):
        return re.search(r'name="csrf_token" value="([^"]+)"',(http or self.http).get('/').text).group(1)
    def post(self,path,values,http=None):
        http=http or self.http
        return http.post(path,data={**values,'csrf_token':self.token(http)})
    def test_sections_templates_native_gates(self):
        for path in ['/','/gates/','/programmatic/','/identity/','/orders/','/filters/','/integrations/']:
            response=self.http.get(path)
            self.assertEqual(response.status_code,200,path)
            self.assertIn('Missing TOGGLY_APP_KEY',response.text)
            self.assertEqual(response.headers['Cache-Control'],'private, no-store')
        html=self.http.get('/gates/').text
        for label in ['Native dashboard ON','Native api-v2 disabled','Any gate ON','All gate OFF','Negated All ON']: self.assertIn(label,html)
        for path,status in [('/native/any/',200),('/native/all/',403),('/native/negate/',200),('/native/redirect/',302),('/native/fallback/',200),('/beta/welcome/',200),('/native/variant/',200)]:self.assertEqual(self.http.get(path).status_code,status,path)
        self.assertIn('API version 1',self.http.get('/native/switch/').text)
        self.assertIn('Enabled; no named native variant',self.http.get('/native/variant/').text)
    def test_csrf_and_enhanced_submission(self):
        self.assertEqual(self.http.get('/submit/').status_code,405)
        self.assertEqual(self.http.post('/submit/').status_code,400)
        self.assertIn('Enhanced submission accepted (1)',self.post('/submit/',{}).text)
        with self.http.session_transaction() as session:self.assertEqual(session['submissions'],1)
    def test_identity_and_orders(self):
        self.assertEqual(self.http.get('/native/targeted/').status_code,403)
        self.post('/identity/',{'persona':'alice'})
        self.assertEqual(self.http.get('/native/targeted/').status_code,200)
        data=self.http.get('/api/snapshot/').json
        self.assertEqual(data['identity'],'alice');self.assertIsNone(data['shared_identity'])
        self.assertEqual(data['orders'],{'ord-vip':True,'ord-standard':False,'missing':False,'wrong-kind':True})
        for choice,expected in [('vip',True),('standard',False),('missing',False)]:
            self.post('/orders/',{'order':choice})
            self.assertEqual(self.http.get('/api/snapshot/').json['flags']['ExpressCheckout'],expected)
        self.post('/identity/',{'persona':'clear'})
        self.assertIsNone(self.http.get('/api/snapshot/').json['identity'])
        self.assertEqual(self.http.get('/native/targeted/').status_code,403)
    def test_matrix(self):
        for preset,match in [('matching',True),('nonmatching',False)]:
            self.post('/filters/',{'preset':preset})
            data=self.http.get('/api/snapshot/').json;flags=data['flags'];self.assertEqual(len(flags),16)
            for key in ['filter-targeting','filter-user-claims','filter-country','filter-browser-family','filter-browser-language','filter-os','filter-context-property']:self.assertEqual(flags[key],match,(preset,key))
            self.assertTrue(flags['filter-always-on']);self.assertTrue(flags['filter-time-window']);self.assertFalse(flags['filter-device-type'])
            self.assertFalse(data['native_claims']);self.assertFalse(data['native_country'])
            self.assertEqual(flags['filter-percentage'],self.http.get('/api/snapshot/').json['flags']['filter-percentage'])
    def test_concurrency_error_cleanup(self):
        @self.app.route('/test/error/')
        def error():
            self.assertIsNotNone(g.toggly.context)
            raise ValueError('controlled request failure')
        def visit(index):
            with self.app.test_client() as http:
                match=index%2==0
                self.post('/filters/',{'preset':'matching' if match else 'nonmatching'},http)
                for _ in range(8):
                    data=http.get('/api/snapshot/').json
                    self.assertEqual(data['identity'],'alice' if match else 'bob')
                    self.assertEqual(data['flags']['ExpressCheckout'],match)
                    self.assertEqual(http.get('/native/targeted/').status_code,200 if match else 403)
                with self.assertRaises(ValueError):http.get('/test/error/')
            self.assertFalse(has_request_context())
        with ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(visit,range(6)))
        self.assertIsNone(get_default_client().current_identity)
        self.assertIsNone(self.http.get('/api/snapshot/').json['identity'])
    def test_production_secret(self):
        with self.assertRaisesRegex(ValueError,'FLASK_SECRET_KEY'):create_app({'SAMPLE_PRODUCTION':True,'SECRET_KEY':'','TOGGLY_APP_KEY':''})

if __name__=='__main__':unittest.main()
