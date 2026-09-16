"""Optional live soak: skip without a real key; wait refresh + flush + slack."""
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEY = os.environ.get('TOGGLY_APP_KEY', '').strip()


def main() -> int:
    if not KEY or KEY == 'ci-placeholder':
        print('soak skipped: no live TOGGLY_APP_KEY')
        return 0
    refresh = float(os.environ.get('TOGGLY_REFRESH_INTERVAL', '5'))
    # toggly-flask 0.3.1 does not forward usage_flush_interval; SDK default is 60s.
    flush = 60.0
    wait = refresh + flush + 10
    env = {**os.environ, 'TOGGLY_REFRESH_INTERVAL': str(refresh), 'PORT': os.environ.get('PORT', '0')}
    proc = subprocess.Popen(
        [sys.executable, '-m', 'flask', '--app', 'wsgi:app', 'run', '--host', '127.0.0.1', '--port', env['PORT']],
        cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        time.sleep(wait)
        print(f'soak complete: waited {wait:.0f}s (refresh {refresh}s + flush {flush}s + slack 10s)')
        return 0
    finally:
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == '__main__':
    raise SystemExit(main())
