# frozen_string_literal: true

# Local definitions exercise native SDK evaluation without a real app key.
require 'bundler/setup'
require 'tmpdir'
require 'securerandom'
require 'rbconfig'
require 'timeout'
require_relative '../test/support/fixture_server'

fixture = FixtureServer.new
pid = nil
stopping = false
Signal.trap('INT') { stopping = true }
Signal.trap('TERM') { stopping = true }
Dir.mktmpdir('rails-sdk-demo') do |directory|
  begin
    env = {
      'RAILS_ENV' => 'production',
      'SECRET_KEY_BASE' => SecureRandom.hex(64),
      'TOGGLY_APP_KEY' => 'local-fixture',
      'TOGGLY_LOCAL_FIXTURE' => 'true',
      'TOGGLY_DEFINITIONS_URL' => fixture.url,
      'TOGGLY_CACHE_PATH' => File.join(directory, 'cache'),
      'TOGGLY_REFRESH_INTERVAL' => '10',
      'BIND' => 'tcp://127.0.0.1:3007'
    }
    bundle = Gem.bin_path('bundler', 'bundle')
    app_root = File.expand_path('..', __dir__)
    unless system(env, RbConfig.ruby, bundle, 'exec', 'rails', 'assets:precompile', chdir: app_root)
      raise 'Production assets failed to compile'
    end
    pid = Process.spawn(env, RbConfig.ruby, bundle, 'exec', 'puma', '-e', 'production', '-C', 'config/puma.rb', chdir: app_root)
    puts 'Ruby Rails SDK Sample fixture demo: http://localhost:3007 — dashboard on/off, quit or Ctrl-C.'
    input_open = true
    loop do
      break if stopping
      if Process.waitpid(pid, Process::WNOHANG)
        pid = nil
        break
      end
      if input_open && IO.select([$stdin], nil, nil, 0.2)
        line = $stdin.gets
        input_open = false if line.nil?
        case line&.strip
        when 'dashboard on'
          fixture.toggle('new-dashboard', true)
          puts 'Fixture dashboard ON; wait for native polling.'
        when 'dashboard off'
          fixture.toggle('new-dashboard', false)
          puts 'Fixture dashboard OFF; wait for native polling.'
        when 'quit'
          stopping = true
        end
      else
        sleep 0.2
      end
    end
  ensure
    if pid
      Process.kill('TERM', pid)
      begin
        Timeout.timeout(10) { Process.wait(pid) }
      rescue Timeout::Error
        Process.kill('KILL', pid)
        Process.wait(pid)
      end
    end
    fixture.close
  end
end
