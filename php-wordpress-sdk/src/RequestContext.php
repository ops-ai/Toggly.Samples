<?php

namespace TogglySample;

final class RequestContext
{
    public const MATCHING_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    public const OTHER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
    public const OPTIONS = [
        'preset' => ['matching', 'non-matching'],
        'identity' => ['alice', 'bob'],
        'order' => ['ord-vip', 'ord-standard', 'missing'],
        'scenario' => ['both', 'dashboard', 'api', 'neither', 'invalid-json'],
    ];

    public function __construct(
        public readonly string $preset,
        public readonly string $identity,
        public readonly string $order,
        public readonly string $scenario,
    ) {
    }

    public static function fromCookies(array $cookies): self
    {
        $values = [];
        foreach (self::OPTIONS as $key => $allowed) {
            $candidate = $cookies['toggly_' . $key] ?? $allowed[0];
            $values[$key] = is_string($candidate) && in_array($candidate, $allowed, true)
                ? $candidate
                : $allowed[0];
        }
        return new self(...array_values($values));
    }

    public static function validChanges(array $input): ?array
    {
        $values = [];
        foreach (self::OPTIONS as $key => $allowed) {
            $candidate = $input[$key] ?? null;
            if (!is_string($candidate) || !in_array($candidate, $allowed, true)) {
                return null;
            }
            $values[$key] = $candidate;
        }
        return $values;
    }

    public function evaluation(): array
    {
        $matching = $this->preset === 'matching';
        // Evaluation identity and entity data are explicit inputs, not global SDK state.
        $context = [
            'identity' => $this->identity,
            'userId' => $this->identity,
            'claims' => ['role' => $matching ? 'admin' : 'user'],
            'request' => [
                'country' => $matching ? 'US' : 'CA',
                'userAgent' => $matching ? self::MATCHING_AGENT : self::OTHER_AGENT,
                'acceptLanguage' => $matching ? 'en-US,en;q=0.9' : 'fr-FR,fr;q=0.9',
            ],
        ];
        if ($this->order !== 'missing') {
            $context['contextKind'] = 'Order';
            $context['context'] = [
                'Id' => $this->order,
                'Vip' => $this->order === 'ord-vip',
                'Total' => $this->order === 'ord-vip' ? 120 : 80,
            ];
        }
        return $context;
    }
}
