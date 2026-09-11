<?php

namespace App\Support;

use GuzzleHttp\Psr7\Response;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

final class OfflineTransport implements ClientInterface
{
    public array $requests = [];
    public array $telemetry = [];

    public function __construct(private DemoContext $context) {
    }

    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        // No network exists in this transport. Native SDK parsing/evaluation/gates
        // run unchanged against a deliberately labelled, deterministic demo payload.
        $this->requests[] = $request->getUri()->getPath();
        if ($request->getMethod() === 'POST') {
            $this->telemetry[] = json_decode((string) $request->getBody(), true);
            return new Response(200, [], '{}');
        }

        if (str_contains($request->getUri()->getPath(), 'evaluated-variants-signed/')) {
            parse_str($request->getUri()->getQuery(), $query);
            $identity = (string) ($query['userId'] ?? '');
            $payload = [
                'defs' => [
                    'new-dashboard' => [
                        'enabled' => true,
                        'variant' => $identity === 'alice' ? 'compact' : 'classic',
                        'configurationValue' => [
                            'fixtureIdentity' => $identity,
                            'heading' => 'A server-assigned layout',
                        ],
                    ],
                ],
            ];
        } else {
            $payload = FlagCatalog::definitions($this->context->scenario);
        }

        return new Response(200, ['Content-Type' => 'application/json'], json_encode($payload));
    }
}
