"""Loopback-only HTTP fixtures. Real SDK networking, parser and ES256 verifier.

The ephemeral signing key is generated at runtime and never persisted. This is
controlled test data, not a substitute Toggly evaluator or dashboard credential.
"""
import base64
import hashlib
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, utils
from showcase.offline import definitions

class DefinitionsServer:
    def __init__(self):
        self.key = ec.generate_private_key(ec.SECP256R1())
        numbers = self.key.public_key().public_numbers()
        x, y = numbers.x.to_bytes(32, 'big'), numbers.y.to_bytes(32, 'big')
        b64 = lambda value: base64.urlsafe_b64encode(value).decode().rstrip('=')
        self.kid = hashlib.sha1(x + y).hexdigest().upper() + 'ES256'
        self.jwks = {'keys': [{'kty': 'EC', 'alg': 'ES256', 'crv': 'P-256', 'kid': self.kid, 'x': b64(x), 'y': b64(y)}]}
        self.revision = 1
        self.mode = 'valid'
        self.dashboard = True
        self.calls = []
        self.lock = threading.Lock()
        owner = self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass
            def do_GET(self):
                with owner.lock:
                    owner.calls.append((self.path, self.headers.get('If-None-Match')))
                    if self.path == '/.well-known/jwks':
                        body, status = json.dumps(owner.jwks).encode(), 200
                    elif owner.mode == 'error':
                        body, status = b'{}', 503
                    elif self.headers.get('If-None-Match') == f'"{owner.revision}"':
                        body, status = b'', 304
                    else:
                        if self.path.startswith('/evaluated-variants-signed/'):
                            data = {'new-dashboard': {'enabled': True, 'variant': 'compact', 'configuration': {'value': {'density': 'compact'}}}}
                        else:
                            data = [row.to_dict() for row in definitions()]
                            data[0]['filters'] = [{'name': 'AlwaysOn' if owner.dashboard else 'AlwaysOff', 'parameters': {}}]
                        raw = json.dumps(data, separators=(',', ':'))
                        timestamp = int(time.time()) + owner.revision
                        digest = hashlib.sha256(hashlib.sha256(f'{raw}|{timestamp}'.encode()).digest()).digest()
                        signature = owner.key.sign(digest, ec.ECDSA(utils.Prehashed(hashes.SHA256())))
                        if owner.mode == 'tamper':
                            signature = b'\0' * 64
                        envelope = {'defs': data, 'timestamp': timestamp, 'signature': base64.b64encode(signature).decode(), 'kid': owner.kid}
                        body, status = json.dumps(envelope, separators=(',', ':')).encode(), 200
                    self.send_response(status)
                    self.send_header('Content-Type', 'application/json')
                    if self.path != '/.well-known/jwks':
                        self.send_header('ETag', f'"{owner.revision}"')
                    self.end_headers()
                    self.wfile.write(body)
        self.httpd = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.url = f'http://127.0.0.1:{self.httpd.server_port}'
    def __enter__(self):
        self.thread.start()
        return self
    def __exit__(self, *args):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join()
    def change(self, *, dashboard=True, mode='valid'):
        with self.lock:
            self.revision += 1
            self.dashboard, self.mode = dashboard, mode
