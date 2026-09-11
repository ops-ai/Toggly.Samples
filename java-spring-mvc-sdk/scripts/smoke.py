#!/usr/bin/env python3
"""Start the packaged app, test real HTTP setup pages and denial, then terminate it."""
from pathlib import Path
import os
import subprocess
import time
import urllib.error
import urllib.request

root = Path(__file__).resolve().parent.parent
java = str(Path(os.environ['JAVA_HOME']) / 'bin/java') if os.environ.get('JAVA_HOME') else 'java'
env = dict(os.environ, TOGGLY_APP_KEY='')
with (root / 'target' / 'smoke.log').open('w') as log:
    process = subprocess.Popen([java, '-jar', 'target/java-spring-mvc-sdk.jar'], cwd=root, env=env, stdout=log, stderr=log)
    try:
        for attempt in range(100):
            if process.poll() is not None:
                raise RuntimeError('Packaged process exited before startup')
            try:
                urllib.request.urlopen('http://localhost:8088/', timeout=1).close()
                break
            except (OSError, urllib.error.URLError):
                time.sleep(0.1)
        else:
            raise RuntimeError('Packaged process did not start')
        for path in ['/', '/gates', '/programmatic', '/identity', '/orders', '/filters', '/mvc', '/configuration']:
            with urllib.request.urlopen('http://localhost:8088' + path) as response:
                assert response.status == 200
                assert 'Missing TOGGLY_APP_KEY' in response.read().decode()
        for path in ['/gated/feature', '/gated/negate', '/gated/all', '/gated/any', '/gated/beta', '/native/argument']:
            try:
                urllib.request.urlopen('http://localhost:8088' + path)
                raise AssertionError('Unconfigured protected/native route unexpectedly allowed: ' + path)
            except urllib.error.HTTPError as error:
                assert error.code == 503
        print('Packaged smoke: eight pages rendered, five gates and native resolver denied')
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
            raise RuntimeError('Packaged app failed graceful shutdown')
