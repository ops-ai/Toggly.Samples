"""Run the built wheel through real two-worker Uvicorn, cookies and HTML forms."""
import os
import re
import secrets
import socket
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path
import httpx

root = Path(__file__).resolve().parents[1]
wheel = max((root / 'dist').glob('*.whl'), key=lambda path: path.stat().st_mtime)
with tempfile.TemporaryDirectory(prefix='toggly-fastapi-wheel-') as directory:
    with zipfile.ZipFile(wheel) as archive:
        archive.extractall(directory)
        files = archive.namelist()
        assert 'showcase/templates/filters.html' in files
        assert 'showcase/static/style.css' in files
        assert 'asgi.py' in files
    with socket.socket() as reserved:
        reserved.bind(('127.0.0.1', 0))
        port = reserved.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    env = {
        **os.environ,
        'TOGGLY_APP_KEY': 'ci-placeholder',
        'SAMPLE_SESSION_SECRET': secrets.token_urlsafe(64),
        'SAMPLE_PRODUCTION': '1', 'SAMPLE_HTTPS': '0',
        'PYTHONPATH': directory,
    }
    with open(Path(directory) / 'uvicorn.log', 'w+') as log:
        host = subprocess.Popen(
            [sys.executable, '-m', 'uvicorn', 'asgi:application', '--host',
             '127.0.0.1', '--port', str(port), '--workers', '2'],
            cwd=directory, env=env, stdout=log, stderr=subprocess.STDOUT,
        )
        try:
            with httpx.Client(base_url=base, follow_redirects=True, timeout=3) as http:
                deadline = time.monotonic() + 20
                while True:
                    try:
                        response = http.get('/')
                        if response.status_code == 200:
                            break
                    except httpx.TransportError:
                        pass
                    assert host.poll() is None, 'Uvicorn exited during startup'
                    assert time.monotonic() < deadline, 'Uvicorn startup timed out'
                    time.sleep(.1)

                def post(path, **values):
                    page = http.get('/')
                    token = re.search(r'name="csrf_token" value="([^"]+)"', page.text).group(1)
                    return http.post(path, data={'csrf_token': token, **values})

                for path in ['/', '/gates/', '/programmatic/', '/identity/', '/orders/', '/filters/', '/integrations/']:
                    response = http.get(path)
                    assert response.status_code == 200, path
                    assert 'Missing TOGGLY_APP_KEY' in response.text
                assert http.get('/static/style.css').status_code == 200
                assert '/beta/welcome/' in http.get('/openapi.json').json()['paths']
                assert http.post('/submit/').status_code == 403
                assert 'Enhanced submission accepted (1)' in post('/submit/').text
                for preset, identity, expected in [('matching', 'alice', True), ('nonmatching', 'bob', False)]:
                    response = post('/filters/', preset=preset)
                    assert response.status_code == 200
                    assert response.text.count('data-key="filter-') == 11
                    # New connections distribute requests across both workers;
                    # their stable shared session secret preserves the persona.
                    for _ in range(8):
                        with httpx.Client(base_url=base, cookies=http.cookies) as other:
                            data = other.get('/api/snapshot/').json()
                            assert len(data['flags']) == 16
                            assert data['identity'] == identity
                            assert data['flags']['ExpressCheckout'] == expected
                            assert data['shared_identity'] is None
                    assert http.get('/native/targeted/').status_code == (200 if expected else 403)
                assert http.get('/native/all/').status_code == 403
                assert http.get('/native/any/').status_code == 200
                assert 'API version 1 fallback' in http.get('/native/switch/').text
                assert http.get('/beta/welcome/').status_code == 200
                assert 'No variant assigned' in post('/variant/').text
                assert 'defaults' in post('/refresh/').text
                assert post('/identity/', persona='clear').status_code == 200
                assert http.get('/api/snapshot/').json()['identity'] is None
        finally:
            host.terminate()
            try:
                host.wait(timeout=15)
            except subprocess.TimeoutExpired:
                host.kill()
                host.wait()
                raise AssertionError('Uvicorn did not shut down gracefully')
            log.seek(0)
            logs = log.read()
            print(logs)
        assert host.returncode == 0, f'Uvicorn exit: {host.returncode}'
        assert logs.count('Application startup complete.') == 2
        assert logs.count('Application shutdown complete.') == 2
        print(f'WHEEL_ASGI_OK workers=2 artifacts={len(files)} flags=16 filters=11 session=true csrf=true')
