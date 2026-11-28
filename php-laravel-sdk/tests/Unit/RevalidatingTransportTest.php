<?php

namespace Tests\Unit;

use App\Support\RevalidatingTransport;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;
use Tests\Support\FixtureTransport;

class RevalidatingTransportTest extends TestCase
{
    public function test_definition_gets_are_not_reusable_cache_keys(): void
    {
        $inner = new FixtureTransport([
            new Response(200, [], '{}'),
            new Response(200, [], '{}'),
        ]);
        $transport = new RevalidatingTransport($inner);

        $transport->sendRequest(new Request('GET', 'https://definitions.toggly.io/definitions-signed/app/Production'));
        $transport->sendRequest(new Request('GET', 'https://definitions.toggly.io/definitions-signed/app/Production'));

        $first = $inner->requests[0];
        $second = $inner->requests[1];
        $this->assertStringContainsString('toggly_refresh=', $first->getUri()->getQuery());
        $this->assertStringContainsString('toggly_refresh=', $second->getUri()->getQuery());
        $this->assertNotSame($first->getUri()->getQuery(), $second->getUri()->getQuery());
        $this->assertSame('no-cache', $first->getHeaderLine('Cache-Control'));
        $this->assertSame('no-cache', $first->getHeaderLine('Pragma'));
    }

    public function test_telemetry_posts_are_left_unchanged(): void
    {
        $inner = new FixtureTransport([]);
        $transport = new RevalidatingTransport($inner);

        $transport->sendRequest(new Request('POST', 'https://app.toggly.io/usage', [], '{}'));

        $sent = $inner->requests[0];
        $this->assertSame('', $sent->getUri()->getQuery());
        $this->assertFalse($sent->hasHeader('Cache-Control'));
    }
}
