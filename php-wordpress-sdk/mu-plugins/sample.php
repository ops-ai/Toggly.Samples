<?php
/**
 * Plugin Name: Toggly SDK Showcase Loader
 * Description: Loads the published plugin and this sample's request-scoped presentation.
 */

$sampleRoot = dirname(__DIR__);
require_once $sampleRoot . '/vendor/autoload.php';
\TogglySample\Environment::load($sampleRoot);

// Installation mail is suppressed only in this deliberately disposable sample.
add_filter('pre_wp_mail', '__return_true');
if (defined('WP_INSTALLING') && WP_INSTALLING) {
    return;
}

$GLOBALS['toggly_sample'] = new \TogglySample\Runtime($sampleRoot);
$GLOBALS['toggly_sample']->register();
// The published plugin entry registers its normal plugins_loaded initialization.
require_once $sampleRoot . '/vendor/toggly/wordpress/toggly.php';
