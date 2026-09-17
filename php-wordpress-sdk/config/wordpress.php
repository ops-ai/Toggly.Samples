<?php
// Loaded by the generated wp-config.php; all state stays outside the document root.
$sampleRoot = dirname(__DIR__);
require_once $sampleRoot . '/vendor/autoload.php';
\TogglySample\Environment::load($sampleRoot);
$secrets = require $sampleRoot . '/.runtime/secrets.php';
foreach ($secrets['salts'] as $name => $value) {
    define($name, $value);
}
define('DB_NAME', 'toggly_wordpress_sample');
define('DB_USER', '');
define('DB_PASSWORD', '');
define('DB_HOST', '');
define('DB_CHARSET', 'utf8');
define('DB_COLLATE', '');
define('DB_DIR', $sampleRoot . '/.runtime/database');
define('DB_FILE', 'sample.sqlite');
define('WP_HOME', getenv('SAMPLE_URL') ?: 'http://localhost:8011');
define('WP_SITEURL', WP_HOME);
define('WP_HTTP_BLOCK_EXTERNAL', \TogglySample\Environment::offline());
define('DISABLE_WP_CRON', true);
define('AUTOMATIC_UPDATER_DISABLED', true);
define('WP_AUTO_UPDATE_CORE', false);
define('DISALLOW_FILE_EDIT', true);
define('WP_DEBUG', false);
$table_prefix = 'sample_';
if (!defined('ABSPATH')) {
    define('ABSPATH', $sampleRoot . '/.runtime/wordpress/');
}
require_once ABSPATH . 'wp-settings.php';
