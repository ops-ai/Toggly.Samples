# frozen_string_literal: true

# Optional live soak: skip without a real key; wait refresh + flush + slack.
require 'bundler/setup'
require 'rbconfig'

key = ENV.fetch('TOGGLY_APP_KEY', '').strip
if key.empty? || key == 'ci-placeholder'
  puts 'soak skipped: no live TOGGLY_APP_KEY'
  exit 0
end

refresh = Integer(ENV.fetch('TOGGLY_REFRESH_INTERVAL', '5'))
flush = 60
wait = refresh + flush + 10
pid = Process.spawn(
  ENV.to_h.merge(
    'TOGGLY_REFRESH_INTERVAL' => refresh.to_s,
    'BIND' => ENV.fetch('BIND', 'tcp://127.0.0.1:0'),
    'RACK_ENV' => 'development'
  ),
  RbConfig.ruby, Gem.bin_path('bundler', 'bundle'), 'exec', 'puma',
  '-C', 'config/puma.rb',
  chdir: File.expand_path('..', __dir__),
  out: File::NULL,
  err: File::NULL
)
begin
  sleep wait
  puts "soak complete: waited #{wait}s (refresh #{refresh}s + flush #{flush}s + slack 10s)"
ensure
  Process.kill('TERM', pid) rescue Errno::ESRCH
  begin
    Process.wait(pid)
  rescue Errno::ECHILD
  end
end
