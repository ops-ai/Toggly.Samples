"""Start this sample's native host, run acceptance checks, and close owned processes."""
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / 'tests/.results'
RESULTS.mkdir(exist_ok=True)
# No inherited CI placeholder or local app key can turn acceptance into a live run.
if os.environ.get('TOGGLY_APP_KEY', ''):
    raise SystemExit('Unset TOGGLY_APP_KEY before offline native acceptance.')
environment = dict(
    os.environ,
    TOGGLY_APP_KEY='',
    TOGGLY_SIGNED_DEFINITIONS='true',
    SAMPLE_URL='http://localhost:8011',
)
with (RESULTS / 'host.log').open('w') as log:
    host = subprocess.Popen([sys.executable, str(ROOT / 'bin/serve.py')], env=environment, stdout=log, stderr=subprocess.STDOUT)
    try:
        deadline = time.monotonic() + 15
        while True:
            if host.poll() is not None:
                raise RuntimeError('Native host exited before startup. See tests/.results/host.log.')
            try:
                with urllib.request.urlopen('http://localhost:8011/', timeout=2) as response:
                    if response.status == 200:
                        break
            except (urllib.error.URLError, TimeoutError):
                pass
            if time.monotonic() > deadline:
                raise RuntimeError('Native host startup deadline exceeded.')
            time.sleep(0.1)
        for script in ['http_acceptance.py', 'native_acceptance.py']:
            with (RESULTS / (script + '.log')).open('w') as result:
                subprocess.run([sys.executable, str(ROOT / 'tests' / script)], env=environment, stdout=result, stderr=subprocess.STDOUT, check=True)
    finally:
        host.terminate()
        try:
            host.wait(timeout=15)
        except subprocess.TimeoutExpired:
            host.kill()
            host.wait()
        marker = ROOT / '.runtime/fpm.socket-path'
        leftover = marker.read_text().strip() if marker.exists() else ''
        if leftover and Path(leftover).exists():
            raise RuntimeError('Owned FPM socket was not cleaned up.')
        if (ROOT / '.runtime/fpm.sock').exists():
            raise RuntimeError('Owned FPM socket was not cleaned up.')
print('Native HTTP acceptance finished; owned host processes and socket are closed.')
