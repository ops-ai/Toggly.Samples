<?php

$root = dirname(__DIR__);
$envLocal = $root.'/.env.local';
if (is_readable($envLocal) && getenv('TOGGLY_APP_KEY') === false) {
    foreach (file($envLocal, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        if (!str_contains($line, '=')) {
            continue;
        }
        [$name, $value] = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        if ($name !== '' && getenv($name) === false) {
            putenv($name.'='.$value);
            $_ENV[$name] = $value;
        }
    }
}

$key = trim((string) getenv('TOGGLY_APP_KEY'));
if ($key === '' || $key === 'ci-placeholder') {
    fwrite(STDOUT, "soak skipped: no live TOGGLY_APP_KEY\n");
    exit(0);
}

$host = '127.0.0.1';
$port = getenv('PORT') ?: '18010';
$base = "http://{$host}:{$port}";
$cmd = [PHP_BINARY, 'artisan', 'serve', '--host='.$host, '--port='.$port];
$log = sys_get_temp_dir().'/toggly-php-laravel-soak.log';
$descriptors = [
    0 => ['file', '/dev/null', 'r'],
    1 => ['file', $log, 'w'],
    2 => ['file', $log, 'a'],
];
$process = proc_open($cmd, $descriptors, $pipes, $root);
if (!is_resource($process)) {
    fwrite(STDERR, "soak failed to start artisan serve\n");
    exit(1);
}

try {
    $ready = false;
    $deadline = time() + 20;
    while (time() < $deadline) {
        $status = proc_get_status($process);
        if (!$status['running']) {
            fwrite(STDERR, "soak artisan serve exited before ready\n");
            exit(1);
        }
        if (soak_status($base.'/') === 200) {
            $ready = true;
            break;
        }
        usleep(250000);
    }
    if (!$ready) {
        fwrite(STDERR, "soak timed out waiting for {$base}\n");
        exit(1);
    }

    // Each request boots, refreshFeatures(true), then flush() in middleware.
    // Two showcase hits give a first-load miss and a follow-up hit or miss.
    $codes = [];
    foreach (['/', '/api/snapshot', '/', '/api/snapshot'] as $path) {
        $codes[] = soak_status($base.$path, 45);
    }

    $failed = array_filter($codes, static fn (int $code): bool => $code < 200 || $code >= 400);
    fwrite(STDOUT, 'soak complete: hit '.implode(',', $codes)." on {$base}\n");
    exit($failed === [] ? 0 : 1);
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

function soak_status(string $url, int $timeout = 3): int
{
    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => $timeout,
            'ignore_errors' => true,
            'header' => "Accept: */*\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $ctx);
    unset($body);
    $headers = function_exists('http_get_last_response_headers')
        ? http_get_last_response_headers()
        : ($http_response_header ?? null);
    if (!is_array($headers) || !isset($headers[0])) {
        return 0;
    }
    if (preg_match('/\s(\d{3})\s/', $headers[0], $matches) !== 1) {
        return 0;
    }

    return (int) $matches[1];
}
