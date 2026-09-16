#!/usr/bin/env python3
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
    refresh = float(os.environ.get('TOGGLY_REFRESH_INTERVAL', '30'))
    flush = float(os.environ.get('TOGGLY_USAGE_FLUSH_INTERVAL', '60'))
    wait = refresh + flush + 10
    env = {**os.environ, 'ASPNETCORE_ENVIRONMENT': 'Development'}
    proc = subprocess.Popen(
        ['dotnet', 'run', '--project', 'BlazorSample', '--no-launch-profile',
         '--urls', 'http://127.0.0.1:0'],
        cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        time.sleep(wait)
        print(f'soak complete: waited {wait:.0f}s (refresh {refresh}s + flush {flush}s + slack 10s)')
        return 0
    finally:
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == '__main__':
    raise SystemExit(main())
