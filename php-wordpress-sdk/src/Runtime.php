<?php

namespace TogglySample;

use Toggly\WordPress\TogglyPlugin;

final class Runtime
{
    public readonly RequestContext $context;
    public readonly ?OfflineTransport $offlineTransport;
    public ?VariantRuntime $variants = null;
    private string $session;
    private bool $prepared = false;

    public function __construct(public readonly string $root)
    {
        $this->context = RequestContext::fromCookies($_COOKIE);
        $session = $_COOKIE['toggly_session'] ?? '';
        $this->session = is_string($session) && preg_match('/^[a-f0-9]{32}$/', $session)
            ? $session
            : bin2hex(random_bytes(16));
        $this->offlineTransport = Environment::offline() ? new OfflineTransport($this->context) : null;
    }

    public function register(): void
    {
        // Configuration is public WordPress integration; the package remains unchanged.
        add_filter('pre_option_toggly_settings', static fn () => Environment::settings());
        add_filter('pre_option_toggly_snapshot_provider', static fn () => 'none');
        add_filter('cron_schedules', static function (array $schedules): array {
            $schedules['toggly_refresh_interval'] = ['interval' => 300, 'display' => 'Every five minutes'];
            $schedules['toggly_send_interval'] = ['interval' => 60, 'display' => 'Every minute'];
            return $schedules;
        });
        if ($this->offlineTransport !== null) {
            add_filter('pre_http_request', [$this->offlineTransport, 'intercept'], 10, 3);
            add_filter('pre_option_show_avatars', '__return_zero');
        }
        // Anonymous WordPress nonces normally share user ID zero. Bind our form nonce
        // to a random browser cookie so another visitor's nonce cannot change this one.
        add_filter('nonce_user_logged_out', fn ($id, $action) => $action === 'toggly_controls'
            ? hexdec(substr(hash('sha256', $this->session), 0, 7))
            : $id, 10, 2);
        add_action('init', function (): void {
            if (!headers_sent() && (!defined('DOING_CRON') || !DOING_CRON)) {
                $this->cookie('toggly_session', $this->session);
                if (Environment::offline()) {
                    // Server transport interception does not cover browser images/scripts.
                    // Keep offline pages on this origin, including WordPress admin pages.
                    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; worker-src 'self' blob:; base-uri 'self'; form-action 'self'");
                }
            }
        });
        add_action('admin_post_toggly_controls', [$this, 'controls']);
        add_action('admin_post_nopriv_toggly_controls', [$this, 'controls']);
        add_action('template_redirect', [$this, 'render'], 1);
        add_action('shutdown', function (): void {
            $this->variants?->close();
        });
    }

    private function cookie(string $name, string $value): void
    {
        setcookie($name, $value, [
            'expires' => time() + 86400,
            'path' => '/',
            'secure' => is_ssl(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    public function prepare(bool $variants = false): void
    {
        if (!$this->prepared) {
            // With native persistence disabled, every ordinary request needs its first fetch.
            do_action('toggly_refresh_features');
            $this->prepared = true;
        }
        if ($variants && $this->variants === null) {
            $this->variants = new VariantRuntime($this->context);
        }
    }

    public function enabled(string $key, ?array $context = null): bool
    {
        return TogglyPlugin::getInstance()->isEnabled($key, $context ?? $this->context->evaluation());
    }

    public function snapshot(): array
    {
        $results = [];
        foreach (FlagCatalog::keys() as $key) {
            $results[$key] = $this->enabled($key);
        }
        return $results;
    }

    public function controls(): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            wp_die('Use the form to change the demo.', 'Method not allowed', ['response' => 405]);
        }
        $nonce = $_POST['_wpnonce'] ?? null;
        if (!is_string($nonce) || !wp_verify_nonce($nonce, 'toggly_controls')) {
            wp_die('This form has expired or belongs to another browser. Reload and try again.', 'Invalid nonce', ['response' => 403]);
        }
        $values = RequestContext::validChanges($_POST);
        $section = $_POST['section'] ?? 'home';
        if ($values === null || !is_string($section) || !array_key_exists($section, Showcase::SECTIONS)) {
            wp_die('Choose one of the supported demo values.', 'Invalid controls', ['response' => 400]);
        }
        foreach ($values as $key => $value) {
            $this->cookie('toggly_' . $key, $value);
        }
        // Redirect instead of mutating this request's SDK identity. The next request
        // constructs new context and refreshes native definitions before evaluating.
        wp_safe_redirect(home_url('/?section=' . rawurlencode($section) . '&updated=1'), 303);
        exit;
    }

    public function render(): void
    {
        if (is_admin()) {
            return;
        }
        $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        if ($path !== '/' && $path !== '/index.php' && $path !== '/sample-api') {
            return;
        }
        $section = $_GET['section'] ?? 'home';
        if (!is_string($section) || !array_key_exists($section, Showcase::SECTIONS)) {
            wp_die('That showcase section does not exist.', 'Not found', ['response' => 404]);
        }
        $this->prepare($section === 'variants' || isset($_GET['snapshot']));
        nocache_headers();
        if (isset($_GET['snapshot'])) {
            wp_send_json([
                'offline' => Environment::offline(),
                'context' => $this->context->evaluation(),
                'scenario' => $this->context->scenario,
                'flags' => $this->snapshot(),
                'variant' => $this->variants?->variant(),
                'transport' => $this->offlineTransport?->requests,
            ]);
        }
        if ($path === '/sample-api') {
            $enabled = $this->enabled('api-v2');
            wp_send_json([
                'allowed' => $enabled,
                'identity' => $this->context->identity,
                'message' => $enabled ? 'Native api-v2 gate allowed this demo request.' : 'Native api-v2 gate denied this demo request.',
            ], $enabled ? 200 : 403);
        }
        (new Showcase($this))->render($section);
        exit;
    }
}
