"""Each worker initializes and owns its SDK client. Do not use --preload."""
bind = '127.0.0.1:8000'
workers = 2
threads = 4
preload_app = False
control_socket_disable = True

def worker_exit(server, worker):
    from showcase.apps import close_client
    close_client()
