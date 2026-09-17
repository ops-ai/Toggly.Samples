<?php
// The installer only creates a new, isolated runtime. It never reinstalls an existing site.
$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';
\TogglySample\Environment::load($root);
$runtime = $root . '/.runtime';
if (is_file($runtime . '/database/sample.sqlite')) {
    fwrite(STDERR, "A sample database already exists. Use composer build; setup will not overwrite it.\n");
    exit(1);
}
@mkdir($runtime . '/downloads', 0700, true);
$releases = json_decode(file_get_contents($root . '/config/releases.json'), true, 512, JSON_THROW_ON_ERROR);
foreach ($releases as $name => $release) {
    $file = $runtime . '/downloads/' . ($name === 'wordpress' ? 'wordpress.tar.gz' : 'sqlite.zip');
    if (!is_file($file)) {
        // Argument arrays avoid shell interpolation; URLs and hashes are pinned public releases.
        $process = proc_open(['curl', '--fail', '--location', '--silent', '--show-error', $release['url'], '--output', $file], [STDIN, STDOUT, STDERR], $pipes);
        if (!is_resource($process) || proc_close($process) !== 0) {
            throw new RuntimeException('The official ' . $name . ' download failed.');
        }
    }
    if (!hash_equals($release['sha256'], hash_file('sha256', $file))) {
        throw new RuntimeException('Official archive checksum mismatch for ' . $name . '.');
    }
}
$commands = [
    ['tar', '-xzf', $runtime . '/downloads/wordpress.tar.gz', '-C', $runtime],
    ['unzip', '-q', '-o', $runtime . '/downloads/sqlite.zip', '-d', $runtime . '/wordpress/wp-content/plugins'],
];
foreach ($commands as $command) {
    $process = proc_open($command, [STDIN, STDOUT, STDERR], $pipes);
    if (!is_resource($process) || proc_close($process) !== 0) {
        throw new RuntimeException('Could not extract an official runtime archive.');
    }
}
copy($runtime . '/wordpress/wp-content/plugins/sqlite-database-integration/db.copy', $runtime . '/wordpress/wp-content/db.php');
@mkdir($runtime . '/wordpress/wp-content/mu-plugins', 0755, true);
file_put_contents($runtime . '/wordpress/wp-content/mu-plugins/toggly-sample.php', "<?php\nrequire " . var_export($root . '/mu-plugins/sample.php', true) . ";\n");
file_put_contents($runtime . '/wordpress/wp-config.php', "<?php\nrequire " . var_export($root . '/config/wordpress.php', true) . ";\n");
$salts = [];
foreach (['AUTH_KEY', 'SECURE_AUTH_KEY', 'LOGGED_IN_KEY', 'NONCE_KEY', 'AUTH_SALT', 'SECURE_AUTH_SALT', 'LOGGED_IN_SALT', 'NONCE_SALT'] as $name) {
    $salts[$name] = bin2hex(random_bytes(32));
}
$password = bin2hex(random_bytes(16));
file_put_contents($runtime . '/secrets.php', "<?php\nreturn " . var_export(['salts' => $salts], true) . ";\n");
chmod($runtime . '/secrets.php', 0600);
// The MU loader installs pre_wp_mail before WordPress installation sends notifications.
define('WP_INSTALLING', true);
$_SERVER['HTTP_HOST'] = parse_url(getenv('SAMPLE_URL') ?: 'http://localhost:8011', PHP_URL_HOST);
$_SERVER['REQUEST_URI'] = '/';
require $runtime . '/wordpress/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/upgrade.php';
wp_install('Toggly WordPress Lab', 'sample-admin', 'sample@example.invalid', false, '', $password);
file_put_contents($runtime . '/admin-login.txt', "Username: sample-admin\nPassword: {$password}\n");
chmod($runtime . '/admin-login.txt', 0600);
require $root . '/bin/build.php';
echo "WordPress installed into .runtime with its own SQLite database.\n";
echo "Disposable credentials: .runtime/admin-login.txt (not printed or committed).\n";
