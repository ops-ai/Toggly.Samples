<?php

namespace Tests\Support;

use GuzzleHttp\Psr7\Response;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

final class FixtureTransport implements ClientInterface
{
    public array $requests = [];

    public function __construct(
        public array $responses,
        private array $jwks = [],
    ) {
    }

    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        $this->requests[] = $request;

        // Every request stays local, including shutdown telemetry and key lookup.
        if ($request->getMethod() === 'POST') {
            return new Response(200, [], '{}');
        }

        if (str_ends_with($request->getUri()->getPath(), '/.well-known/jwks')) {
            return new Response(200, [], json_encode($this->jwks));
        }

        if ($this->responses === []) {
            throw new \RuntimeException('The fixture has no remaining response.');
        }

        return array_shift($this->responses);
    }
}
