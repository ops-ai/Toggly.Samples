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
JAR = ROOT / 'target' / 'java-spring-webflux-sdk.jar'


def main() -> int:
    if not KEY or KEY == 'ci-placeholder':
        print('soak skipped: no live TOGGLY_APP_KEY')
        return 0
    if not JAR.exists():
        print('soak skipped: package the sample first (mvn -DskipTests package)')
        return 0
    refresh = float(os.environ.get('TOGGLY_REFRESH_INTERVAL', '5'))
    flush = float(os.environ.get('TOGGLY_USAGE_FLUSH_INTERVAL', '5'))
    wait = refresh + flush + 10
    java = str(Path(os.environ['JAVA_HOME']) / 'bin/java') if os.environ.get('JAVA_HOME') else 'java'
    env = {
        **os.environ,
        'TOGGLY_REFRESH_INTERVAL': str(int(refresh)),
        'TOGGLY_USAGE_FLUSH_INTERVAL': str(int(flush)),
    }
    proc = subprocess.Popen([java, '-jar', str(JAR)], cwd=ROOT, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
