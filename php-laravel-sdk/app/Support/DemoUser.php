<?php

namespace App\Support;

use Illuminate\Auth\GenericUser;

final class DemoUser extends GenericUser
{
    public function __construct(private DemoContext $context)
    {
        parent::__construct(['id' => $context->identity]);
    }

    public function groups(): array
    {
        return $this->context->groups;
    }
}
