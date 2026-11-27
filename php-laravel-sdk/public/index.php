<?php

use Illuminate\Http\Request;

require __DIR__ . '/../vendor/autoload.php';
// php artisan serve includes this file on every request. require (not
// require_once) keeps a PHP build that retains included files from handing
// back the first Application, whose FeatureProvider still has the previous
// signed definitions after Live E2E turns a flag off.
$app = require __DIR__ . '/../bootstrap/app.php';
$app->handleRequest(Request::capture());
