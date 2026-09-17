<?php

namespace TogglySample;

final class Environment
{
    public static function load(string $root): void
    {
        // Only this sample's ignored .env is read. Existing process variables win.
        $path = $root . '/.env';
        if (!is_file($path)) {
            return;
        }
        $values = parse_ini_file($path, false, INI_SCANNER_RAW);
        if ($values === false) {
            throw new \RuntimeException('The local .env file could not be parsed.');
        }
        foreach ($values as $key => $value) {
            if (in_array($key, ['TOGGLY_APP_KEY', 'TOGGLY_ENVIRONMENT', 'TOGGLY_BASE_URL', 'TOGGLY_SIGNED_DEFINITIONS', 'SAMPLE_URL'], true)
                && getenv($key) === false) {
                putenv($key . '=' . $value);
            }
        }
    }

    public static function appKey(): string
    {
        return trim((string) getenv('TOGGLY_APP_KEY'));
    }

    public static function offline(): bool
    {
        return self::appKey() === '';
    }

    public static function settings(): array
    {
        return [
            'app_key' => self::appKey(),
            'environment' => getenv('TOGGLY_ENVIRONMENT') ?: 'Production',
            'base_url' => self::offline()
                ? 'https://sample.invalid/'
                : (getenv('TOGGLY_BASE_URL') ?: 'https://definitions.toggly.io/'),
            'use_signed_definitions' => getenv('TOGGLY_SIGNED_DEFINITIONS') !== 'false',
        ];
    }
}
