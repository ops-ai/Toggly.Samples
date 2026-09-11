<?php

namespace App\Support;

use Illuminate\Http\Request;

final class DemoContext
{
    public const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    public const FIREFOX_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';

    public function __construct(
        public readonly string $preset,
        public readonly string $scenario,
        public readonly string $identity,
        public readonly array $groups,
        public readonly array $claims,
        public readonly array $requestFields,
        public readonly ?array $order,
    ) {
    }

    public static function fromRequest(Request $request): self
    {
        // Session controls choose only predefined personas; they are not a login system.
        $preset = $request->session()->get('demo.preset', 'matching');
        $matches = $preset === 'matching';
        $orderChoice = $request->session()->get('demo.order', $matches ? 'vip' : 'standard');
        $order = match ($orderChoice) {
            'vip' => [
                'Id' => 'ord-vip',
                'Vip' => true,
                'Total' => 240.0,
            ],
            'standard' => [
                'Id' => 'ord-standard',
                'Vip' => false,
                'Total' => 49.0,
            ],
            default => null,
        };

        return new self(
            preset: $matches ? 'matching' : 'non-matching',
            scenario: $request->session()->get('demo.scenario', 'mixed'),
            identity: $matches ? 'alice' : 'bob',
            groups: $matches ? ['beta-testers'] : [],
            claims: ['role' => $matches ? 'admin' : 'user'],
            requestFields: [
                'country' => $matches ? 'US' : 'CA',
                'acceptLanguage' => $matches ? 'en-US,en;q=0.9' : 'fr-FR,fr;q=0.9',
                'userAgent' => $matches ? self::CHROME_MAC : self::FIREFOX_WINDOWS,
            ],
            order: $order,
        );
    }

    public function evaluation(): array
    {
        // Core uses identity for filters; the adapter's usage provider reads userId.
        // Order is displayed separately: published PHP has no entity evaluation API.
        return [
            'identity' => $this->identity,
            'userId' => $this->identity,
            'groups' => $this->groups,
            'claims' => $this->claims,
            'request' => $this->requestFields,
        ];
    }
}
