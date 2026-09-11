<?php

namespace App\Http\Controllers;

use Toggly\Laravel\Attributes\FeatureGate;
use Toggly\Laravel\Attributes\FeatureUsage;

final class NativeGateController
{
    public function beta(): string
    {
        return 'Native beta route: this request passed FeatureGateMiddleware.';
    }

    #[FeatureGate(['new-dashboard', 'api-v2'], requirement: 'All', statusCode: 403)]
    public function all(): string
    {
        return 'Native All attribute: both flags are enabled.';
    }

    #[FeatureGate(['new-dashboard', 'api-v2'], requirement: 'Any')]
    #[FeatureUsage('new-dashboard')]
    public function any(): string
    {
        return 'Native Any attribute: at least one flag is enabled; usage is recorded.';
    }

    #[FeatureGate('api-v2', redirectTo: '/gates')]
    public function redirectGate(): string
    {
        return 'The redirect attribute permitted api-v2.';
    }
}
