"""Exercise a real two-worker production WSGI host with no live key or service.

All framework data and generated secrets live in a temporary directory/process.
Cookies and CSRF tokens are consumed in memory and never printed.
"""
import http.cookiejar
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import build_opener, HTTPCookieProcessor, Request

ROOT = Path(__file__).resolve().parents[1]

def run():
    with tempfile.TemporaryDirectory(prefix='django-sample-smoke-') as temporary:
        env = {**os.environ, 'TOGGLY_APP_KEY': '', 'DJANGO_SETTINGS_MODULE': 'config.production',
            'DJANGO_SECRET_KEY': secrets.token_urlsafe(64), 'DJANGO_LOCAL_HTTP': '1',
            'DJANGO_DATABASE': str(Path(temporary) / 'smoke.sqlite3')}
        env.pop('SAMPLE_MANAGEMENT', None)
        for command in [['migrate', '--noinput'], ['seed_demo'], ['collectstatic', '--noinput']]:
            subprocess.run([sys.executable, 'manage.py', *command], cwd=ROOT, env=env, check=True, stdout=subprocess.DEVNULL)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        origin = f'http://127.0.0.1:{port}'
        with open(Path(temporary) / 'gunicorn.log', 'w+') as log:
            host = subprocess.Popen([sys.executable, '-m', 'gunicorn', '--config', 'gunicorn.conf.py',
                '--bind', f'127.0.0.1:{port}', 'config.wsgi:application'], cwd=ROOT, env=env, stdout=log, stderr=log)
            try:
                browser = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))
                deadline = time.monotonic() + 15
                while True:
                    try:
                        browser.open(origin, timeout=1).read()
                        break
                    except (URLError, TimeoutError):
                        if host.poll() is not None or time.monotonic() > deadline:
                            log.seek(0)
                            raise AssertionError('Host failed: ' + log.read())
                        time.sleep(.1)
                def get(path):
                    with browser.open(origin + path, timeout=5) as response:
                        return response.read().decode()
                def post(path, values, form_path=None):
                    page = get(form_path or path)
                    token = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', page).group(1)
                    data = urlencode({'csrfmiddlewaretoken': token, **values}).encode()
                    return browser.open(Request(origin + path, data=data, headers={'Referer': origin + (form_path or path)}), timeout=5).read().decode()
                for path in ['/', '/gates/', '/programmatic/', '/identity/', '/orders/', '/filters/', '/integrations/']:
                    assert 'Missing TOGGLY_APP_KEY' in get(path), path
                assert 'color-scheme' in get('/static/showcase/style.css')
                post('/filters/', {'preset': 'matching'})
                payload = json.loads(get('/api/snapshot/'))
                assert payload['identity'] == 'alice' and payload['flags']['filter-user-claims']
                assert 'alice allowed' in get('/native/targeted/')
                post('/orders/', {'order': 'standard'})
                assert not json.loads(get('/api/snapshot/'))['flags']['ExpressCheckout']
                post('/orders/', {'order': 'missing'})
                assert not json.loads(get('/api/snapshot/'))['flags']['ExpressCheckout']
                assert 'Enhanced submission accepted' in post('/submit/', {}, '/programmatic/')
                assert 'Native refresh status' in post('/refresh/', {}, '/')
                assert 'No variant assigned' in post('/variant/', {}, '/gates/')
                post('/filters/', {'preset': 'nonmatching'})
                payload = json.loads(get('/api/snapshot/'))
                assert payload['identity'] == 'bob' and not payload['flags']['filter-user-claims']
                try:
                    get('/native/targeted/')
                    raise AssertionError('Bob was not denied')
                except HTTPError as error:
                    assert error.code == 403
                post('/identity/', {'persona': 'clear'})
                assert json.loads(get('/api/snapshot/'))['identity'] is None
                print('WSGI_SMOKE_OK sections=7 flags=16 matrix=11 workers=2 csrf=true sessions=true static=true')
            finally:
                host.terminate()
                host.wait(timeout=15)
            assert host.returncode == 0, f'Gunicorn exit {host.returncode}'

if __name__ == '__main__':
    run()
