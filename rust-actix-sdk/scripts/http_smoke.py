#!/usr/bin/env python3
"""Run the real release host with eight isolated private-cookie sessions.

A fresh session key exists only in process memory. All Toggly traffic uses the
sample's signed loopback fixture; no real key or external service is needed.
"""
import argparse
import concurrent.futures
import http.cookiejar
import json
import os
from pathlib import Path
import re
import signal
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SECTIONS = (
    "home",
    "declarative",
    "programmatic",
    "identity",
    "orders",
    "filters",
    "surfaces",
    "setup",
)
MATCHING_ON = (
    "filter-targeting",
    "filter-user-claims",
    "filter-country",
    "filter-browser-family",
    "filter-browser-language",
    "filter-os",
    "filter-context-property",
    "ExpressCheckout",
)


def run(output: Path):
    output.mkdir(parents=True, exist_ok=True)
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    env = os.environ.copy()
    env.update(
        TOGGLY_APP_KEY="",
        TOGGLY_ENVIRONMENT="Production",
        ACTIX_PORT=str(port),
        NO_PROXY="127.0.0.1,localhost",
        no_proxy="127.0.0.1,localhost",
    )
    with (output / "production-http.log").open("w") as log:
        process = subprocess.Popen(
            [str(ROOT / "target/release/rust-actix-sdk-sample")],
            cwd=ROOT, env=env, stdout=log, stderr=log,
        )
        try:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            for _ in range(150):
                if process.poll() is not None:
                    raise RuntimeError("Actix exited before startup")
                try:
                    with opener.open(base + "/", timeout=2) as response:
                        assert b"Missing app key" in response.read()
                    break
                except OSError:
                    time.sleep(0.1)
            else:
                raise RuntimeError("Actix startup timeout")

            for slug in SECTIONS:
                with opener.open(base + f"/{slug}", timeout=5) as response:
                    body = response.read()
                    assert response.status == 200, slug
                    assert b"Missing app key" in body, slug

            cookies = http.cookiejar.CookieJar()
            session = urllib.request.build_opener(
                urllib.request.HTTPCookieProcessor(cookies),
                urllib.request.ProxyHandler({}),
            )
            with session.open(base + "/identity", timeout=5) as response:
                html = response.read().decode()
            csrf = re.search(r'name="csrf" value="([^"]+)"', html).group(1)

            def post(fields):
                fields = dict(fields)
                fields.update(csrf=csrf, destination="filters")
                request = urllib.request.Request(
                    base + "/session",
                    data=urllib.parse.urlencode(fields).encode(),
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                with session.open(request, timeout=5) as response:
                    assert response.status == 200

            post({"action": "matching"})
            with session.open(base + "/api/snapshot", timeout=5) as response:
                matching = json.load(response)
            decisions = {row["key"]: row for row in matching["decisions"]}
            assert matching["persona"]["identity"] == "alice"
            assert matching["persona"]["order"] == "ord-vip"
            for key in MATCHING_ON:
                assert decisions[key]["enabled"], key
                assert not decisions[key]["error"], key
            assert decisions["filter-always-on"]["enabled"]
            assert decisions["filter-time-window"]["enabled"]
            assert not decisions["filter-device-type"]["enabled"]

            post({"action": "nonmatching"})
            with session.open(base + "/api/snapshot", timeout=5) as response:
                nonmatching = json.load(response)
            decisions = {row["key"]: row for row in nonmatching["decisions"]}
            assert nonmatching["persona"]["identity"] == "bob"
            assert nonmatching["persona"]["order"] == "ord-standard"
            for key in MATCHING_ON:
                assert not decisions[key]["enabled"], key
            assert decisions["filter-always-on"]["enabled"]
            assert not decisions["filter-device-type"]["enabled"]

            def worker(worker_id):
                cookies = http.cookiejar.CookieJar()
                session = urllib.request.build_opener(
                    urllib.request.HTTPCookieProcessor(cookies),
                    urllib.request.ProxyHandler({}),
                )
                with session.open(base + "/identity", timeout=5) as response:
                    html = response.read().decode()
                csrf = re.search(r'name="csrf" value="([^"]+)"', html).group(1)

                def post(fields):
                    fields = dict(fields)
                    fields.update(csrf=csrf, destination="filters")
                    request = urllib.request.Request(
                        base + "/session",
                        data=urllib.parse.urlencode(fields).encode(),
                        headers={"Content-Type": "application/x-www-form-urlencoded"},
                    )
                    with session.open(request, timeout=5) as response:
                        assert response.status == 200

                for iteration in range(100):
                    matching = (worker_id + iteration) % 2 == 0
                    post({"action": "matching" if matching else "nonmatching"})
                    # Every jar uses alice, but claims/request/Order remain opposite.
                    # This exposes cross-session leakage hidden by identity-only tests.
                    post({"action": "update", "identity": "alice"})
                    with session.open(base + "/api/snapshot", timeout=5) as response:
                        assert response.headers["Cache-Control"] == "no-store"
                        snapshot = json.load(response)
                    assert snapshot["persona"]["identity"] == "alice"
                    decisions = {row["key"]: row for row in snapshot["decisions"]}
                    assert len(decisions) == 16
                    for key in ("ExpressCheckout", "filter-user-claims", "filter-country"):
                        assert decisions[key]["enabled"] == matching, (worker_id, iteration, key)
                        assert not decisions[key]["error"]
                    assert not decisions["filter-device-type"]["enabled"]
                return 100

            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                count = sum(pool.map(worker, range(8)))
            request = urllib.request.Request(
                base + "/native", headers={"X-User-Id": "alice", "X-Identity": "bob"}
            )
            with opener.open(request) as response:
                native = json.load(response)
            assert native["identity"] == "alice" and native["enabled"]
            result = {
                "production_host": "Actix-web 4.15.0 / Rust 1.98.1",
                "published_crates": "toggly 0.6.1 / toggly-actix 0.6.1",
                "workers": 8,
                "private_cookie_jars": 8,
                "sections": list(SECTIONS),
                "same_identity_context_snapshots": count,
                "order_claim_country_assertions": count * 3,
                "native_header_precedence": "alice",
                "result": "all assertions passed",
            }
        finally:
            process.send_signal(signal.SIGTERM)
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
                raise
        assert process.returncode == 0, process.returncode
    assert "Toggly close hook completed" in (output / "production-http.log").read_text()
    result["process_exit"] = process.returncode
    result["shutdown_hook"] = "completed"
    (output / "http-smoke-result.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.output:
        run(args.output.resolve())
    else:
        with tempfile.TemporaryDirectory(prefix="actix-sample-smoke-") as temporary:
            run(Path(temporary))
