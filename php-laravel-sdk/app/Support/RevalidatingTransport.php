<?php

namespace App\Support;

use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

/**
 * Live E2E turns filter-targeting off, then the page keeps rendering ON.
 * definitions-signed is cacheable at the edge. A fresh PHP request that still
 * presents the previous response never sees the empty filter list. Force a
 * unique URL and revalidation headers so each demo request reads the current
 * document. The signed bytes are what the SDK verifies; the query is not.
 */
final class RevalidatingTransport implements ClientInterface
{
    private int $sequence = 0;

    public function __construct(private readonly ClientInterface $inner)
    {
    }

    public function inner(): ClientInterface
    {
        return $this->inner;
    }

    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        if (strtoupper($request->getMethod()) === 'GET') {
            $uri = $request->getUri();
            $this->sequence++;
            $refresh = 'toggly_refresh=' . $this->sequence . '-' . hrtime(true);
            $query = $uri->getQuery();
            $request = $request
                ->withUri($uri->withQuery($query === '' ? $refresh : $query . '&' . $refresh))
                ->withHeader('Cache-Control', 'no-cache')
                ->withHeader('Pragma', 'no-cache');
        }

        return $this->inner->sendRequest($request);
    }
}
