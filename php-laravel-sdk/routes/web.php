<?php

use App\Http\Controllers\ControlsController;
use App\Http\Controllers\NativeGateController;
use App\Http\Controllers\ShowcaseController;
use Illuminate\Support\Facades\Route;

Route::get('/', [ShowcaseController::class, 'page']);
foreach (['gates', 'api', 'identity', 'orders', 'filters', 'integrations'] as $section) {
    Route::get('/' . $section, [ShowcaseController::class, 'page'])->defaults('section', $section);
}
Route::get('/api/snapshot', [ShowcaseController::class, 'snapshot']);
Route::post('/controls', [ControlsController::class, 'update']);
Route::post('/actions/enhanced', [ControlsController::class, 'enhanced'])
    ->middleware('feature:enhanced-submit');
Route::post('/actions/metric', [ControlsController::class, 'metric']);
Route::get('/native/beta', [NativeGateController::class, 'beta'])->middleware('feature:beta-access');
Route::get('/native/redirect', [NativeGateController::class, 'beta'])
    ->middleware('feature:beta-access,/gates');
Route::middleware('feature.attributes')->group(function (): void {
    Route::get('/native/all', [NativeGateController::class, 'all']);
    Route::get('/native/any', [NativeGateController::class, 'any']);
    Route::get('/native/attribute-redirect', [NativeGateController::class, 'redirectGate']);
});
