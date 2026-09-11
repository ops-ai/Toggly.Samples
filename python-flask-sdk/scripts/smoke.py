"""Production WSGI check using the built wheel in an isolated temporary directory.

The host receives a generated process-only session secret and no real app key.
Cookies, CSRF, templates, forms and static files cross real localhost HTTP.
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
import urllib.error
import urllib.parse
import urllib.request
import zipfile

ROOT=Path(__file__).resolve().parents[1]
wheels=list((ROOT/'dist').glob('*.whl'))
assert len(wheels)==1, 'Run python -m build --wheel first; keep exactly one sample wheel.'
with tempfile.TemporaryDirectory(prefix='flask-showcase-smoke-') as work:
    # Extract the sample wheel only; published dependency imports still use the
    # active locked environment. No source checkout is on the host's PYTHONPATH.
    with zipfile.ZipFile(wheels[0]) as wheel:wheel.extractall(work)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    env={**os.environ,'TOGGLY_APP_KEY':'ci-placeholder','FLASK_SECRET_KEY':secrets.token_urlsafe(64),
        'SAMPLE_PRODUCTION':'1','SAMPLE_HTTPS':'0','PYTHONPATH':work}
    log_path=Path(work)/'gunicorn.log'
    with log_path.open('w+') as log:
        host=subprocess.Popen([sys.executable,'-m','gunicorn','--config',str(ROOT/'gunicorn.conf.py'),
            '--bind',f'127.0.0.1:{port}','wsgi:application'],cwd=work,env=env,stdout=log,stderr=log)
        base=f'http://127.0.0.1:{port}'
        browser=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        def request(path,data=None):
            req=urllib.request.Request(base+path,data=urllib.parse.urlencode(data).encode() if data is not None else None)
            try:
                with browser.open(req,timeout=3) as response:return response.status,response.read().decode(),response.headers
            except urllib.error.HTTPError as error:return error.code,error.read().decode(),error.headers
        def post(path,data):
            token=re.search(r'name="csrf_token" value="([^"]+)"',request('/')[1]).group(1)
            return request(path,{**data,'csrf_token':token})
        try:
            deadline=time.monotonic()+15
            while True:
                if host.poll() is not None:raise AssertionError('Gunicorn exited during startup')
                try:
                    if request('/')[0]==200:break
                except (OSError,urllib.error.URLError):pass
                if time.monotonic()>deadline:raise AssertionError('Gunicorn startup timeout')
                time.sleep(.1)
            for path in ['/','/gates/','/identity/','/orders/','/filters/','/programmatic/','/integrations/']:
                status,body,headers=request(path)
                assert status==200 and 'Missing TOGGLY_APP_KEY' in body,path
                assert headers['Cache-Control']=='private, no-store'
            assert request('/static/style.css')[0]==200
            assert request('/submit/',{})[0]==400
            assert request('/submit/')[0]==405
            assert 'Enhanced submission accepted (1)' in post('/submit/',{})[1]
            for preset,identity,vip in [('matching','alice',True),('nonmatching','bob',False)]:
                assert post('/filters/',{'preset':preset})[0]==200
                for _ in range(12):
                    data=json.loads(request('/api/snapshot/')[1])
                    assert len(data['flags'])==16 and data['identity']==identity
                    assert data['flags']['ExpressCheckout']==vip
                    assert data['shared_identity'] is None
                assert request('/native/targeted/')[0]==(200 if vip else 403)
            assert request('/native/all/')[0]==403
            assert request('/native/any/')[0]==200
            assert request('/native/negate/')[0]==200
            assert request('/beta/welcome/')[0]==200
            assert 'API version 1' in request('/native/switch/')[1]
            assert 'No variant assigned' in post('/variant/',{})[1]
            assert post('/identity/',{'persona':'clear'})[0]==200
            assert json.loads(request('/api/snapshot/')[1])['identity'] is None
            print('SMOKE_OK packaged wheel; two-worker WSGI; cookies/CSRF/forms/static; 16 flags; identity/order; native gates')
        finally:
            host.terminate()
            try:host.wait(timeout=10)
            except subprocess.TimeoutExpired:host.kill();host.wait(timeout=3)
            log.flush();log.seek(0);output=log.read()
            print(output)
            assert host.returncode==0,f'Gunicorn exited {host.returncode}'
