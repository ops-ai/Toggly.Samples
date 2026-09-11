# frozen_string_literal: true

require 'bundler/setup'
require_relative 'app'

configuration = RubyShowcase::Configuration.new
service = RubyShowcase::FeatureService.new(configuration)
# Ephemeral signing material is sufficient for this local demo. Supply a stable
# SESSION_SECRET from your runtime environment when sessions must survive restart.
secret = ENV.fetch('SESSION_SECRET', SecureRandom.hex(64))
raise 'SESSION_SECRET must contain at least 64 bytes' if secret.bytesize < 64

# Puma's after_stopped callback may run inside a signal trap. Native telemetry
# uses mutexes, so close here outside that trap after serving has stopped.
at_exit do
  service.close
  warn "Ruby sample SDK closed=#{service.client.closed?} telemetry_closed=#{service.telemetry.summary[:closed]}"
end

run RubyShowcase::Application.build(service: service, secret: secret, secure: ENV['SESSION_COOKIE_SECURE'] == 'true')
