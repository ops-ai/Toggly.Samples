# frozen_string_literal: true

# One process owns one SDK client and its refresh thread. Cluster/fork deployment
# would need per-worker initialization and is deliberately outside this sample.
workers 0
threads 1, 8
bind ENV.fetch('BIND', 'tcp://127.0.0.1:9292')
environment ENV.fetch('RACK_ENV', 'production')
rackup File.expand_path('../config.ru', __dir__)
