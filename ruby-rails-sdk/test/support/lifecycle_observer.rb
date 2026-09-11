# Test-only read-only observer, loaded before Rails. at_exit is LIFO, so the
# native Railtie closes its client before this earlier callback observes it.
at_exit do
  warn "NATIVE_RAILTIE_CLOSED=#{Toggly.client.closed?}" if defined?(Toggly)
end
