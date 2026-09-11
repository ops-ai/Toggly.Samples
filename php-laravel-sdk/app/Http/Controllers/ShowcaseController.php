<?php

namespace App\Http\Controllers;

use App\Support\FlagCatalog;
use App\Support\TogglyRuntime;
use Illuminate\Http\JsonResponse;
use Illuminate\View\View;

final class ShowcaseController
{
    public function page(TogglyRuntime $runtime, string $section = 'home'): View
    {
        return view($section, [
            'runtime' => $runtime,
            'snapshot' => $runtime->snapshot(),
            'catalog' => FlagCatalog::FILTERS,
        ]);
    }

    public function snapshot(TogglyRuntime $runtime): JsonResponse
    {
        return response()->json($runtime->snapshot());
    }
}
