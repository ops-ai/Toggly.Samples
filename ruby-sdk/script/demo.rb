# frozen_string_literal: true

# Optional local teaching mode. The production app still uses ordinary native
# HTTP definitions; only the fixture process is special to this demonstration.
require 'bundler/setup'
require 'tmpdir'
require 'rbconfig'
require_relative '../test/support/fixture_server'

fixture = FixtureServer.new
pid = nil
Dir.mktmpdir('ruby-showcase-demo') do |directory|
  begin
    env = {
      'TOGGLY_APP_KEY' => 'local-fixture',
      'TOGGLY_LOCAL_FIXTURE' => 'true',
      'TOGGLY_DEFINITIONS_URL' => fixture.url,
      'TOGGLY_SNAPSHOT_PATH' => File.join(directory, 'definitions.json'),
      'TOGGLY_REFRESH_INTERVAL' => '2',
      'RACK_ENV' => 'production'
    }
    pid = Process.spawn(env, RbConfig.ruby, Gem.bin_path('bundler', 'bundle'), 'exec', 'puma',
                        '-e', 'production', '-C', 'config/puma.rb', chdir: File.expand_path('..', __dir__))
    puts 'Local native fixture: http://localhost:9292 (or your BIND override).'
    puts 'Type "dashboard off" / "dashboard on" to change the fixture, or "quit" to stop.'
    while (line = $stdin.gets)
      case line.strip
      when 'dashboard off'
        fixture.toggle('new-dashboard', false)
        puts 'Native fixture new-dashboard OFF; polling updates the sample.'
      when 'dashboard on'
        fixture.toggle('new-dashboard', true)
        puts 'Native fixture new-dashboard ON; polling updates the sample.'
      when 'quit'
        break
      end
    end
  ensure
    if pid
      Process.kill('TERM', pid) rescue Errno::ESRCH
      Process.wait(pid) rescue Errno::ECHILD
    end
    fixture.close
  end
end
