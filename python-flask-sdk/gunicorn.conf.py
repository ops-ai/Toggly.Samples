"""Local production WSGI host with one independently owned SDK per worker."""
import os
bind = os.getenv('SAMPLE_BIND', '127.0.0.1:5001')
workers = 2
threads = 4
preload_app = False
accesslog = None
# This sample does not need a host-wide Gunicorn control socket.
control_socket_disable = True

def worker_exit(server, worker):
    # atexit may also run; close_client is idempotent at the application layer.
    from showcase import close_client
    close_client(worker.wsgi)
