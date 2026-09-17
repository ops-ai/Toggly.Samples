<?php

namespace TogglySample;

final class OfflineTransport
{
    public array $requests = [];
    private \OpenSSLAsymmetricKey $key;
    private array $jwk;

    public function __construct(private readonly RequestContext $context)
    {
        // This throwaway signing key exists only in memory; it is not a Toggly app key.
        $key = openssl_pkey_new([
            'private_key_type' => OPENSSL_KEYTYPE_EC,
            'curve_name' => 'prime256v1',
        ]);
        if ($key === false) {
            throw new \RuntimeException('OpenSSL could not create the offline fixture key.');
        }
        $this->key = $key;
        $details = openssl_pkey_get_details($key);
        $x = $details['ec']['x'];
        $y = $details['ec']['y'];
        $this->jwk = [
            'kty' => 'EC',
            'crv' => 'P-256',
            'alg' => 'ES256',
            'use' => 'sig',
            'kid' => strtoupper(sha1($x . $y)) . 'ES256',
            'x' => self::base64url($x),
            'y' => self::base64url($y),
        ];
    }

    private static function base64url(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    public function signed(array $definitions): string
    {
        $raw = json_encode($definitions, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $timestamp = time();
        // The platform signer prehashes defs|timestamp before ECDSA/SHA-256 signing.
        $digest = hash('sha256', $raw . '|' . $timestamp, true);
        if (!openssl_sign($digest, $signature, $this->key, OPENSSL_ALGO_SHA256)) {
            throw new \RuntimeException('Offline fixture signing failed.');
        }
        return json_encode([
            'defs' => $definitions,
            'timestamp' => $timestamp,
            'kid' => $this->jwk['kid'],
            'signature' => base64_encode($signature),
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    }

    public function intercept($previous, array $arguments, string $url): array|\WP_Error
    {
        $path = parse_url($url, PHP_URL_PATH) ?: '/';
        $method = $arguments['method'] ?? 'GET';
        $this->requests[] = [
            'path' => $path,
            'method' => $method,
            'bodyBytes' => is_string($arguments['body'] ?? null) ? strlen($arguments['body']) : null,
        ];

        if (str_ends_with($path, '/.well-known/jwks')) {
            $body = json_encode(['keys' => [$this->jwk]], JSON_THROW_ON_ERROR);
        } elseif (str_contains($path, '/evaluated-variants-signed/')) {
            parse_str(parse_url($url, PHP_URL_QUERY) ?? '', $query);
            $layout = ($query['userId'] ?? '') === 'alice' ? 'compact' : 'classic';
            $body = $this->signed([
                'new-dashboard' => [
                    'enabled' => in_array($this->context->scenario, ['both', 'dashboard'], true),
                    'variant' => $layout,
                    'configurationValue' => [
                        'layout' => $layout,
                        'heading' => $layout === 'compact' ? 'Your work at a glance' : 'A little more room to explore',
                    ],
                ],
            ]);
        } elseif (str_contains($path, '/definitions-signed/')) {
            $body = $this->signed(FlagCatalog::definitions($this->context->scenario));
        } elseif (str_contains($path, '/definitions/')) {
            $body = json_encode(FlagCatalog::definitions($this->context->scenario), JSON_THROW_ON_ERROR);
        } elseif (str_starts_with($path, '/api/usage/') || str_starts_with($path, '/api/metrics/')) {
            $body = '{}';
        } else {
            // WordPress update APIs have their own response schemas. An ordinary
            // WP_Error means offline, rather than inventing successful update metadata.
            return new \WP_Error('sample_offline', 'External WordPress requests are disabled in the offline showcase.');
        }
        if ($this->context->scenario === 'invalid-json' && str_contains($path, '/definitions')) {
            $body = 'intentionally invalid offline JSON';
        }
        return [
            'headers' => ['content-type' => 'application/json'],
            'body' => $body,
            'response' => ['code' => 200, 'message' => 'Offline fixture'],
            'cookies' => [],
        ];
    }
}
