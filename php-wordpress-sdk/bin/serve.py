"""Run the showcase with ordinary Apache HTTP and PHP-FPM requests.

This local-development launcher writes private runtime configs only. Apache owns
HTTP, static files and FastCGI forwarding; Python does not emulate a PHP server.
"""
import getpass
import grp
import os
import re
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.runtime'
DOCUMENT_ROOT = RUNTIME / 'wordpress'
PORT = int(os.environ.get('SAMPLE_PORT', '8011'))


def main():
    if not (DOCUMENT_ROOT / 'wp-load.php').exists():
        raise SystemExit('Run composer setup first.')
    fpm = shutil.which('php-fpm8.5') or shutil.which('php-fpm')
    apache = shutil.which('httpd') or shutil.which('apache2')
    if not fpm or not apache:
        raise SystemExit('Install PHP-FPM 8.5 and Apache 2.4 with proxy_fcgi support.')
    fpm_version = subprocess.check_output([fpm, '-v'], text=True)
    if not re.search(r'PHP 8\.5\.', fpm_version):
        raise SystemExit('The selected PHP-FPM executable must be PHP 8.5.')
    # Unix domain sockets cap the path near 104 bytes. This worktree (and some
    # CI checkouts) exceed that if the socket lives under .runtime/.
    socket_dir = Path(tempfile.mkdtemp(prefix='toggly-wp-'))
    socket = socket_dir / 'fpm.sock'
    modules = Path('/usr/libexec/apache2' if sys.platform == 'darwin' else '/usr/lib/apache2/modules')
    names = ['mpm_event', 'unixd', 'authz_core', 'authz_host', 'dir', 'mime', 'log_config', 'proxy', 'proxy_fcgi']
    loads = []
    for name in names:
        path = modules / ('mod_' + name + '.so')
        if path.exists():
            loads.append(f'LoadModule {name}_module "{path}"')
    (RUNTIME / 'fpm.socket-path').write_text(str(socket))
    (RUNTIME / 'fpm.conf').write_text(f'''[global]
error_log = {RUNTIME / 'fpm-error.log'}
daemonize = no
[sample]
listen = {socket}
pm = static
pm.max_children = 4
request_terminate_timeout = 140s
request_terminate_timeout_track_finished = yes
catch_workers_output = yes
clear_env = no
php_admin_value[display_errors] = Off
php_admin_value[log_errors] = On
; Sixteen native unloaded checks can wait 40 seconds before rendering false.
php_admin_value[max_execution_time] = 120
''')
    user = getpass.getuser()
    group = grp.getgrgid(os.getgid()).gr_name
    (RUNTIME / 'httpd.conf').write_text(f'''ServerRoot "{RUNTIME}"
PidFile "{RUNTIME / 'httpd.pid'}"
DefaultRuntimeDir "{RUNTIME}"
Mutex "file:{RUNTIME}" default
ServerName localhost
Listen 127.0.0.1:{PORT}
{chr(10).join(loads)}
User {user}
Group {group}
ErrorLog "{RUNTIME / 'httpd-error.log'}"
LogLevel warn
DocumentRoot "{DOCUMENT_ROOT}"
DirectoryIndex index.php
TypesConfig /dev/null
AddType text/css .css
AddType application/javascript .js
AddType image/png .png
AddType image/jpeg .jpg .jpeg
AddType image/svg+xml .svg
LimitRequestBody 1048576
Timeout 150
ProxyTimeout 150
<Directory "{DOCUMENT_ROOT}">
    Require all granted
    AllowOverride None
    Options -Indexes
    FallbackResource /index.php
</Directory>
<FilesMatch "\\.php$">
    SetHandler "proxy:unix:{socket}|fcgi://localhost"
</FilesMatch>
<Files "wp-config.php">
    Require all denied
</Files>
''')
    # Test configs before launching; failures remain visible and no service is replaced.
    subprocess.run([fpm, '-t', '-y', str(RUNTIME / 'fpm.conf')], check=True)
    subprocess.run([apache, '-t', '-f', str(RUNTIME / 'httpd.conf')], check=True)
    children = []
    def stop(_signum=None, _frame=None):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        children.append(subprocess.Popen([fpm, '-F', '-y', str(RUNTIME / 'fpm.conf')]))
        deadline = time.monotonic() + 10
        while not socket.exists():
            if children[0].poll() is not None or time.monotonic() > deadline:
                raise RuntimeError('PHP-FPM did not create its private socket.')
            time.sleep(0.05)
        children.append(subprocess.Popen([apache, '-DFOREGROUND', '-f', str(RUNTIME / 'httpd.conf')]))
        print(f'WordPress + Apache + PHP-FPM: http://localhost:{PORT}', flush=True)
        while all(child.poll() is None for child in children):
            time.sleep(0.2)
        raise RuntimeError('A native host process exited; inspect .runtime logs.')
    except KeyboardInterrupt:
        pass
    finally:
        # Stop only the child handles created here, even after a failed startup.
        for child in reversed(children):
            if child.poll() is None:
                child.terminate()
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
        socket.unlink(missing_ok=True)
        try:
            socket_dir.rmdir()
        except OSError:
            pass
        (RUNTIME / 'fpm.socket-path').unlink(missing_ok=True)


if __name__ == '__main__':
    main()
