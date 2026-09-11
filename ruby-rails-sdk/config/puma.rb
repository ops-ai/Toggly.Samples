# An initialized SDK owns background work. Keep one process; do not fork it.
workers 0
threads 1, 4
bind ENV.fetch('BIND', 'tcp://127.0.0.1:3007')
environment ENV.fetch('RAILS_ENV', 'development')
