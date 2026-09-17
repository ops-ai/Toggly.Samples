<?php
$root = dirname(__DIR__);
$documentRoot = $root . '/.runtime/wordpress';
if (!is_file($documentRoot . '/wp-load.php')) {
    fwrite(STDERR, "Run composer setup before building the installed showcase.\n");
    exit(1);
}
// Copy only public styles; source, dependencies, secrets and the database stay outside.
@mkdir($documentRoot . '/sample-assets', 0755, true);
copy($root . '/assets/style.css', $documentRoot . '/sample-assets/style.css');
echo "Built public CSS for the installed WordPress document root.\n";
