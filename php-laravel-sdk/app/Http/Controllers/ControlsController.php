<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Toggly\FeatureManagement\Core\MetricsService;

final class ControlsController
{
    public function update(Request $request): RedirectResponse
    {
        $values = $request->validate([
            'preset' => 'required|in:matching,non-matching',
            'order' => 'required|in:vip,standard,missing',
            'scenario' => 'required|in:mixed,all,off',
        ]);

        // The CSRF-protected form changes only this browser's server-side session.
        foreach ($values as $key => $value) {
            $request->session()->put('demo.' . $key, $value);
        }

        return redirect('/identity')->with('message', 'Context saved. The next request uses the new values.');
    }

    public function enhanced(): RedirectResponse
    {
        // Native route middleware has already checked enhanced-submit on this POST.
        return redirect('/api')->with('message', 'Enhanced submission accepted by the native route gate.');
    }

    public function metric(MetricsService $metrics): RedirectResponse
    {
        $metrics->incrementCounter('sample-clicks', 1);
        return redirect('/integrations')->with('message', 'Native metric recorded and flushed at request end.');
    }
}
