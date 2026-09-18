<?php

$key = trim((string) getenv('TOGGLY_APP_KEY'));
if ($key === '' || $key === 'ci-placeholder') {
    fwrite(STDOUT, "soak skipped: no live TOGGLY_APP_KEY\n");
    exit(0);
}

$refresh = (int) (getenv('TOGGLY_REFRESH_INTERVAL') ?: 5);
$flush = (int) (getenv('TOGGLY_USAGE_FLUSH_INTERVAL') ?: 60);
$wait = $refresh + $flush + 10;
$port = getenv('PORT') ?: '0';
$cmd = [PHP_BINARY, 'artisan', 'serve', '--host=127.0.0.1', '--port='.$port];
$descriptors = [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']];
$process = proc_open($cmd, $descriptors, $pipes, dirname(__DIR__));
if (!is_resource($process)) {
    fwrite(STDERR, "soak failed to start artisan serve\n");
    exit(1);
}

try {
    sleep($wait);
    fwrite(STDOUT, "soak complete: waited {$wait}s (refresh {$refresh}s + flush {$flush}s + slack 10s)\n");
    exit(0);
} finally {
    proc_terminate($process);
    $deadline = time() + 10;
    while (proc_get_status($process)['running'] && time() < $deadline) {
        usleep(100000);
    }
    if (proc_get_status($process)['running']) {
        proc_terminate($process, 9);
    }
    proc_close($process);
}
