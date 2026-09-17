"""Exercise real WordPress requests through the running Apache/PHP-FPM host.

Use only the disposable local installation with an empty Toggly app key. These
checks send browser cookies and native WordPress nonces, not mocked SDK results.
"""
from concurrent.futures import ThreadPoolExecutor
import http.cookiejar
import json
import os
from pathlib import Path
import re
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('SAMPLE_URL', 'http://localhost:8011').rstrip('/')
if urllib.parse.urlsplit(BASE).hostname not in ['localhost', '127.0.0.1']:
    raise SystemExit('HTTP tests require a disposable loopback host.')


class Browser:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))

    def request(self, path='/', data=None):
        body = urllib.parse.urlencode(data).encode() if data is not None else None
        try:
            response = self.opener.open(BASE + path, data=body, timeout=120)
        except urllib.error.HTTPError as error:
            response = error
        return response.status, response.headers, response.read().decode()

    def snapshot(self):
        status, _, body = self.request('/?snapshot=1')
        assert status == 200
        result = json.loads(body)
        assert result['offline'] is True, 'Tests must never use a live Toggly app key.'
        return result

    def nonce(self):
        status, _, body = self.request('/')
        assert status == 200
        return re.search(r'name="_wpnonce" value="([^"]+)"', body).group(1)

    def change(self, identity='alice', preset='matching', order='ord-vip', scenario='both', nonce=None, section='home'):
        return self.request('/wp-admin/admin-post.php', {
            'action': 'toggly_controls',
            '_wpnonce': nonce if nonce is not None else self.nonce(),
            'identity': identity,
            'preset': preset,
            'order': order,
            'scenario': scenario,
            'section': section,
        })


class NativeWordPressTests(unittest.TestCase):
    def setUp(self):
        self.browser = Browser()

    def test_initial_signed_snapshot_and_keyless_transport(self):
        result = self.browser.snapshot()
        self.assertEqual(len(result['flags']), 16)
        self.assertTrue(result['flags']['new-dashboard'])
        self.assertEqual(result['variant']['name'], 'compact')
        self.assertEqual(result['variant']['configurationValue']['layout'], 'compact')
        paths = [request['path'] for request in result['transport']]
        self.assertIn('/definitions-signed//Production', paths)
        self.assertIn('/.well-known/jwks', paths)
        self.assertIn('/evaluated-variants-signed//Production', paths)
        self.assertTrue(all(request['method'] == 'GET' for request in result['transport']))

    def test_all_eight_sections_and_css(self):
        for section in ['home', 'gates', 'programmatic', 'identity', 'orders', 'filters', 'wordpress', 'variants']:
            status, headers, body = self.browser.request('/?section=' + section)
            self.assertEqual(status, 200, section)
            self.assertIn('id="missing-key"', body)
            self.assertIn('id="main"', body)
            self.assertIn('no-cache', headers.get('Cache-Control', ''))
        status, headers, css = self.browser.request('/sample-assets/style.css')
        self.assertEqual(status, 200)
        self.assertIn('text/css', headers.get('Content-Type', ''))
        self.assertIn('@media', css)

    def test_four_gate_combinations_and_denied_api(self):
        for scenario, dashboard, api in [('both', True, True), ('dashboard', True, False), ('api', False, True), ('neither', False, False)]:
            status, _, body = self.browser.change(scenario=scenario, section='gates')
            self.assertEqual(status, 200)
            self.assertIn('data-all="' + str(dashboard and api).lower() + '"', body)
            self.assertIn('data-any="' + str(dashboard or api).lower() + '"', body)
            result = self.browser.snapshot()
            self.assertEqual(result['flags']['new-dashboard'], dashboard)
            self.assertEqual(result['flags']['api-v2'], api)
            self.assertEqual(self.browser.request('/sample-api')[0], 200 if api else 403)
            self.assertEqual(result['variant'] is not None, dashboard)

    def test_native_shortcodes_use_each_browser_identity(self):
        alice = self.browser
        bob = Browser()
        bob.change(identity='bob', preset='non-matching', order='ord-standard')
        for _ in range(6):
            self.assertIn('The native shortcode admitted Alice.', alice.request('/?section=gates')[2])
            self.assertNotIn('The native shortcode admitted Alice.', bob.request('/?section=gates')[2])

    def test_both_exact_filter_presets(self):
        for preset, identity, order, matching in [('matching', 'alice', 'ord-vip', True), ('non-matching', 'bob', 'ord-standard', False)]:
            self.browser.change(identity=identity, preset=preset, order=order)
            data = self.browser.snapshot()
            flags = data['flags']
            for key in ['always-on', 'time-window']:
                self.assertTrue(flags['filter-' + key])
            for key in ['targeting', 'user-claims', 'country', 'browser-family', 'browser-language', 'os']:
                self.assertEqual(flags['filter-' + key], matching, key)
            for key in ['device-type', 'context-property']:
                self.assertFalse(flags['filter-' + key], key)
            self.assertEqual(data['context']['request']['country'], 'US' if matching else 'CA')
            self.assertEqual(data['context']['claims']['role'], 'admin' if matching else 'user')
            self.assertEqual(flags['filter-percentage'], self.browser.snapshot()['flags']['filter-percentage'])
            html = self.browser.request('/?section=filters')[2]
            self.assertEqual(len(re.findall('data-filter="', html)), 11)

    def test_all_order_context_cases_keep_native_gap(self):
        for order in ['ord-vip', 'ord-standard', 'missing']:
            self.browser.change(order=order)
            data = self.browser.snapshot()
            self.assertFalse(data['flags']['ExpressCheckout'])
            self.assertFalse(data['flags']['filter-context-property'])
            self.assertEqual('context' in data['context'], order != 'missing')

    def test_concurrent_browser_context_and_variant_isolation(self):
        alice = self.browser
        bob = Browser()
        alice.change()
        bob.change(identity='bob', preset='non-matching', order='ord-standard')
        def read(index):
            browser = alice if index % 2 == 0 else bob
            result = browser.snapshot()
            return index, result
        with ThreadPoolExecutor(max_workers=4) as executor:
            for index, result in executor.map(read, range(24)):
                matching = index % 2 == 0
                self.assertEqual(result['context']['identity'], 'alice' if matching else 'bob')
                self.assertEqual(result['context']['context']['Vip'], matching)
                self.assertEqual(result['flags']['filter-targeting'], matching)
                self.assertEqual(result['variant']['name'], 'compact' if matching else 'classic')

    def test_nonce_cannot_cross_browser_sessions(self):
        alice_nonce = self.browser.nonce()
        bob = Browser()
        bob.nonce()
        self.assertEqual(bob.change(identity='bob', nonce=alice_nonce)[0], 403)
        self.assertEqual(bob.snapshot()['context']['identity'], 'alice')
        self.assertEqual(bob.change(identity='bob')[0], 200)
        self.assertEqual(bob.snapshot()['context']['identity'], 'bob')

    def test_bad_controls_and_invalid_section_fail_closed(self):
        self.assertEqual(self.browser.change(nonce='bad')[0], 403)
        self.assertEqual(self.browser.change(identity='mallory')[0], 400)
        self.assertEqual(self.browser.change(section='../config')[0], 400)
        self.assertEqual(self.browser.request('/?section=missing')[0], 404)
        self.assertEqual(self.browser.request('/wp-config.php')[0], 403)

    def test_invalid_definitions_and_next_request_recovery(self):
        nonce = self.browser.nonce()
        started = time.monotonic()
        status, _, page = self.browser.change(scenario='invalid-json', nonce=nonce)
        first_load_seconds = time.monotonic() - started
        self.assertEqual(status, 200)
        self.assertIn('id="main"', page)
        started = time.monotonic()
        self.assertFalse(any(self.browser.snapshot()['flags'].values()))
        snapshot_seconds = time.monotonic() - started
        started = time.monotonic()
        self.browser.change(scenario='both', nonce=nonce)
        self.assertTrue(self.browser.snapshot()['flags']['new-dashboard'])
        recovery_seconds = time.monotonic() - started
        results = ROOT / 'tests/.results'
        results.mkdir(exist_ok=True)
        (results / 'failure-recovery.json').write_text(json.dumps({
            'malformedFirstLoadSeconds': round(first_load_seconds, 3),
            'malformedSnapshotSeconds': round(snapshot_seconds, 3),
            'nextRequestRecoverySeconds': round(recovery_seconds, 3),
            'httpStatus': status,
            'nativeUnloadedFlagsAllFalse': True,
            'recoveredDashboard': True,
        }, indent=2) + '\n')

    def test_native_wordpress_settings_and_admin_capability(self):
        login = (ROOT / '.runtime/admin-login.txt').read_text().splitlines()
        credentials = dict(line.split(': ', 1) for line in login)
        status, _, page = self.browser.request('/?section=wordpress')
        self.assertEqual(status, 200)
        self.assertNotRegex(page, r"id=['\"]wp-admin-bar-toggly['\"]")
        self.browser.request('/wp-login.php')
        status, _, _ = self.browser.request('/wp-login.php', {
            'log': credentials['Username'],
            'pwd': credentials['Password'],
            'wp-submit': 'Log In',
            'redirect_to': BASE + '/wp-admin/options-general.php?page=toggly',
            'testcookie': '1',
        })
        self.assertEqual(status, 200)
        status, _, settings = self.browser.request('/wp-admin/options-general.php?page=toggly')
        self.assertEqual(status, 200)
        self.assertIn('Toggly Settings', settings)
        self.assertIn('toggly_settings[app_key]', settings)
        self.assertRegex(self.browser.request('/')[2], r"id=['\"]wp-admin-bar-toggly['\"]")


if __name__ == '__main__':
    unittest.main(verbosity=2)
