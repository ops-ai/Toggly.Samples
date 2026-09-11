# frozen_string_literal: true

# Real external Puma CLI verification. All network traffic stays on loopback.
require 'bundler/setup'
require 'socket'
require 'tmpdir'
require 'timeout'
require 'rbconfig'
require_relative '../test/support/fixture_server'
require_relative '../test/support/http_browser'
require_relative '../app/models/order'
require_relative '../app/services/request_context'
require_relative '../app/services/catalog'

def check(condition, message)
  raise message unless condition
end

def eventually(seconds: 10)
  deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + seconds
  loop do
    value = yield
    return value if value
    raise 'Bounded process wait expired' if Process.clock_gettime(Process::CLOCK_MONOTONIC) > deadline
    sleep 0.05
  end
end

fixture = FixtureServer.new
pid = nil
results = []
Dir.mktmpdir('rails-production-smoke') do |directory|
  begin
    3.times do |run|
      socket = TCPServer.new('127.0.0.1', 0)
      port = socket.addr[1]
      socket.close
      log_path = File.join(directory, "puma-#{run}.log")
      env = {
        'TOGGLY_APP_KEY' => run == 2 ? '' : 'local-fixture',
        'TOGGLY_LOCAL_FIXTURE' => run == 2 ? 'false' : 'true',
        'TOGGLY_DEFINITIONS_URL' => fixture.url,
        'TOGGLY_CACHE_PATH' => File.join(directory, 'cache'),
        'TOGGLY_REFRESH_INTERVAL' => '1',
        'SECRET_KEY_BASE' => 'isolated-process-test-session-material-' * 3,
        'RUBYOPT' => "#{ENV['RUBYOPT']} -r#{File.expand_path('../test/support/lifecycle_observer.rb', __dir__)}",
        'BIND' => "tcp://127.0.0.1:#{port}",
        'RAILS_ENV' => 'production'
      }
      command = [RbConfig.ruby, Gem.bin_path('bundler', 'bundle'), 'exec', 'puma', '-e', 'production', '-C', 'config/puma.rb']
      pid = Process.spawn(env, *command, chdir: File.expand_path('..', __dir__), out: log_path, err: [:child, :out])
      browser = HttpBrowser.new("http://127.0.0.1:#{port}")
      initial = eventually do
        browser.snapshot
      rescue Errno::ECONNREFUSED, EOFError
        nil
      end
      check(initial.fetch('flags').length == 16, 'Flag checklist missing')

      csrf = browser.csrf
      if run.zero?
        check(initial.fetch('ready'), 'Connected initialization failed')
        Catalog::SECTIONS.each_key do |path|
          page = browser.get(path)
          check(page.code == '200' && page.body.include?('Ruby Rails SDK Sample'), "Page #{path} failed")
        end
        page = Nokogiri::HTML(browser.get('/').body)
        %w[link[rel=stylesheet] script[src]].each do |selector|
          node = page.at_css(selector)
          asset = node['href'] || node['src']
          check(asset.match?(/-[a-f0-9]+\.(css|js)$/), 'Asset URL lacks digest')
          check(browser.get(asset).code == '200', 'Precompiled asset missing')
        end
        check(browser.get('/api/v2').code == '200', 'Allowed native API denied')
        check(browser.get('/beta').code == '200', 'Allowed native beta route denied')
        check(browser.post('/actions/submit', 'title' => 'missing csrf').code == '422', 'CSRF bypass')
        check(browser.post('/actions/submit', 'authenticity_token' => csrf, 'title' => 'accepted').code == '303', 'Allowed action failed')

        # Each worker owns an independent signed cookie jar and immutable context.
        threads = 24.times.map do |index|
          Thread.new do
            user = HttpBrowser.new("http://127.0.0.1:#{port}")
            token = user.csrf
            preset = RequestContext::PRESETS.fetch(index.even? ? 'matching' : 'non-matching')
            values = preset.merge('identity' => "persona-#{index}", 'authenticity_token' => token)
            check(user.post('/context', values).code == '303', 'Context update failed')
            snapshot = user.snapshot
            check(snapshot.dig('context', 'identity') == "persona-#{index}", 'Identity leaked')
            flags = snapshot.fetch('flags').to_h { |flag| [flag.fetch('key'), flag.fetch('enabled')] }
            check(flags.fetch('ExpressCheckout') == index.even?, 'Order leaked')
            check(flags.fetch('filter-user-claims') == index.even?, 'Claims leaked')
          end
        end
        threads.each(&:value)

        changed = browser.post('/context', 'authenticity_token' => csrf, 'order' => 'ord-standard')
        check(changed.code == '303', 'Same-user Order update failed')
        standard = browser.snapshot
        check(standard.dig('context', 'identity') == 'alice', 'Order changed identity')
        check(!standard.fetch('flags').find { |flag| flag['key'] == 'ExpressCheckout' }.fetch('enabled'), 'Same-user standard Order stale')
        fixture.toggle('new-dashboard', false)
        fixture.toggle('api-v2', false)
        fixture.toggle('enhanced-submit', false)
        eventually do
          !browser.snapshot.fetch('flags').find { |flag| flag['key'] == 'new-dashboard' }.fetch('enabled')
        end
        check(browser.get('/api/v2').code == '404', 'Background refresh did not deny route')
        check(browser.post('/actions/submit', 'authenticity_token' => csrf, 'title' => 'denied').code == '404', 'Background refresh did not deny action')
        check(Dir.glob(File.join(env['TOGGLY_CACHE_PATH'], '**', '*')).any? { |path| File.file?(path) }, 'Native Rails cache snapshot missing')
      elsif run == 1
        check(initial.fetch('ready') == false, 'Native restored readiness behavior changed')
        flag = initial.fetch('flags').find { |item| item['key'] == 'beta-access' }
        check(flag.fetch('enabled'), 'Native enabled snapshot was not restored')
        start_fetches = fixture.fetches.size
        eventually { fixture.fetches.size > start_fetches }
        check(browser.get('/beta').code == '200', 'Failed poll discarded restored definitions')
      else
        check(browser.get('/beta').code == '404', 'Offline native HTML gate must deny')
        check(browser.get('/beta').body.include?('native Rails feature gate returned 404'), 'Native public 404 absent')
        check(initial.fetch('mode') == 'offline', 'Missing-key mode missing')
        check(initial.fetch('flags').none? { |flag| flag.fetch('enabled') }, 'Offline defaults changed')
        Catalog::SECTIONS.each_key do |path|
          check(browser.get(path).body.include?('No app key'), 'Missing-key banner absent')
        end
      end

      stop_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      Process.kill('TERM', pid)
      status = Timeout.timeout(10) { Process.wait2(pid).last }
      stopped_pid = pid
      pid = nil
      # Puma defaults to raising SIGTERM after graceful shutdown. Record that
      # signal status honestly; do not turn it into a fabricated process exit 0.
      check(status.signaled? && status.termsig == Signal.list.fetch('TERM'), "Unexpected Puma status #{status}")
      log = File.read(log_path)
      check(log.include?('single mode') && log.include?('Environment: production'), 'Wrong Puma mode')
      expected_cleanup = "NATIVE_RAILTIE_CLOSED=true"
      check(log.include?(expected_cleanup), "Process native cleanup missing:\n#{log}")
      results << { run: run, pid: stopped_pid, command: command, exit: status.exitstatus, signal: status.termsig,
                   stop_seconds: Process.clock_gettime(Process::CLOCK_MONOTONIC) - stop_at }
      fixture.available = false if run.zero?
    end
    puts JSON.pretty_generate(ruby: RUBY_VERSION, sdk: Toggly::VERSION, puma: Puma::Const::PUMA_VERSION, rails: Gem.loaded_specs.fetch('rails').version.to_s,
                              concurrent_sessions: 24, runs: results, fetches: fixture.fetches)
  ensure
    if pid
      Process.kill('TERM', pid) rescue Errno::ESRCH
      begin
        Timeout.timeout(10) { Process.wait(pid) }
      rescue Timeout::Error
        Process.kill('KILL', pid) rescue Errno::ESRCH
        Process.wait(pid) rescue Errno::ECHILD
      end
    end
    fixture.close
  end
end
