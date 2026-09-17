"""Install temporary native-package probes, exercise them over HTTP, then remove them."""
import json
from pathlib import Path
import time
from http_acceptance import Browser, ROOT

loader = ROOT / '.runtime/wordpress/wp-content/mu-plugins/zz-native-tests.php'
fixture = ROOT / 'tests/fixtures/native.php'
results = ROOT / 'tests/.results'
results.mkdir(exist_ok=True)
if loader.exists():
    raise SystemExit('Refusing to overwrite an existing test loader.')
# JSON's string form is a valid PHP quoted path on these supported host platforms.
loader.write_text('<?php\nrequire ' + json.dumps(str(fixture)) + ';\n')
try:
    browser = Browser()
    status, _, body = browser.request('/?native_test=signed')
    assert status == 200
    signed = json.loads(body)
    assert signed['sapi'] == 'fpm-fcgi'
    assert all(value is True for key, value in signed.items() if key != 'sapi'), signed
    (results / 'signed.json').write_text(json.dumps(signed, indent=2) + '\n')
    status, _, body = browser.request('/?native_test=prepare_cron')
    assert status == 200 and json.loads(body)['scheduled'] is True
    assert browser.request('/wp-cron.php')[0] == 200
    deadline = time.monotonic() + 15
    while True:
        status, _, body = browser.request('/?native_test=cron_status')
        if status != 202:
            break
        if time.monotonic() >= deadline:
            raise AssertionError('Native cron did not finish before the bounded deadline.')
        time.sleep(0.1)
    cron = json.loads(body)
    assert cron['sapi'] == 'fpm-fcgi' and cron['script'] == 'wp-cron.php'
    assert cron['events'] == ['refresh', 'stats']
    assert cron['enabled'] is True and cron['disabled'] is False
    assert cron['refreshCount'] == 1 and cron['statsCount'] == 1
    assert cron['lockReleased'] is True
    assert cron['refresh']['interval'] == 300 and cron['stats']['interval'] == 60
    posts = [entry for entry in cron['transport'] if entry['path'] == '/api/usage/stats']
    assert len(posts) == 1 and posts[0]['bodyBytes'] == 0
    assert cron['error'] is None, cron['error']
    (results / 'cron.json').write_text(json.dumps(cron, indent=2) + '\n')
    print('Native signed definitions/variants, rejection/LKG, lifecycle and actual wp-cron.php checks passed.')
    print('Observed native usage POST body is empty; successful telemetry delivery is not claimed.')
finally:
    loader.unlink(missing_ok=True)
    (ROOT / '.runtime/native-cron-results.json').unlink(missing_ok=True)
