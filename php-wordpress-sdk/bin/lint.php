<?php
$root = dirname(__DIR__);
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
$count = 0;
foreach ($iterator as $file) {
    $path = $file->getPathname();
    $relative = substr($path, strlen($root) + 1);
    if (str_starts_with($relative, 'vendor/') || str_starts_with($relative, '.runtime/') || $file->getExtension() !== 'php') {
        continue;
    }
    $process = proc_open([PHP_BINARY, '-l', $path], [STDIN, STDOUT, STDERR], $pipes);
    if (!is_resource($process) || proc_close($process) !== 0) {
        exit(1);
    }
    $count++;
}
echo "Linted {$count} sample PHP files.\n";
