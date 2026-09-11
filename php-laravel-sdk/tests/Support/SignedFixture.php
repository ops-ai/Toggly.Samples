<?php

namespace Tests\Support;

use GuzzleHttp\Psr7\Response;
use OpenSSLAsymmetricKey;

final class SignedFixture
{
    private OpenSSLAsymmetricKey $privateKey;
    public readonly array $jwks;
    public readonly string $kid;

    public function __construct()
    {
        // Ephemeral test key material exists only in memory, never in this repository.
        $this->privateKey = openssl_pkey_new([
            'private_key_type' => OPENSSL_KEYTYPE_EC,
            'curve_name' => 'prime256v1',
        ]);
        $details = openssl_pkey_get_details($this->privateKey);
        $x = $details['ec']['x'];
        $y = $details['ec']['y'];
        $this->kid = strtoupper(sha1($x . $y)) . 'ES256';
        $this->jwks = [
            'keys' => [
                [
                    'kty' => 'EC',
                    'crv' => 'P-256',
                    'alg' => 'ES256',
                    'use' => 'sig',
                    'kid' => $this->kid,
                    'x' => self::base64url($x),
                    'y' => self::base64url($y),
                ],
            ],
        ];
    }

    public function response(array $definitions, bool $tamper = false): Response
    {
        // Match Toggly's wire protocol: exact JSON bytes plus timestamp, then a
        // SHA-256 prehash signed with ECDSA/SHA-256. Web Crypto emits raw r || s.
        $json = json_encode($definitions, JSON_UNESCAPED_SLASHES);
        $timestamp = time();
        $prehash = hash('sha256', $json . '|' . $timestamp, true);
        openssl_sign($prehash, $derSignature, $this->privateKey, OPENSSL_ALGO_SHA256);

        if ($tamper) {
            $json = str_replace('AlwaysOn', 'AlwaysOff', $json);
        }

        $body = '{"defs":' . $json . ',"signature":'
            . json_encode(base64_encode(self::derToRaw($derSignature)))
            . ',"timestamp":' . $timestamp
            . ',"kid":' . json_encode($this->kid) . '}';

        return new Response(200, ['Content-Type' => 'application/json'], $body);
    }

    private static function base64url(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    private static function derToRaw(string $der): string
    {
        // P-256 DER uses short lengths. Strip integer sign padding and pad each
        // coordinate to 32 bytes to reproduce the platform's P1363 wire format.
        $rLength = ord($der[3]);
        $r = substr($der, 4, $rLength);
        $sLength = ord($der[5 + $rLength]);
        $s = substr($der, 6 + $rLength, $sLength);

        return str_pad(ltrim($r, "\0"), 32, "\0", STR_PAD_LEFT)
            . str_pad(ltrim($s, "\0"), 32, "\0", STR_PAD_LEFT);
    }
}
