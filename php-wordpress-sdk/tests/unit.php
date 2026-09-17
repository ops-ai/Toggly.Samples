<?php
// These tests protect request isolation and validation before WordPress is installed.
require dirname(__DIR__) . '/vendor/autoload.php';

use TogglySample\FlagCatalog;
use TogglySample\RequestContext;

$checks = 0;
function check(bool $condition, string $label): void
{
    global $checks;
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$label}\n");
        exit(1);
    }
    $checks++;
}

check(class_exists(RequestContext::class), 'RequestContext must provide the scoped cookie controls');
$matching = RequestContext::fromCookies([]);
$other = RequestContext::fromCookies([
    'toggly_preset' => 'non-matching',
    'toggly_identity' => 'bob',
    'toggly_order' => 'ord-standard',
]);
check($matching->evaluation()['identity'] === 'alice', 'matching identity');
check($other->evaluation()['identity'] === 'bob', 'second request identity');
check($matching->evaluation()['identity'] === 'alice', 'another request cannot mutate the first');
check($matching->evaluation()['request']['country'] === 'US', 'matching country');
check($other->evaluation()['request']['country'] === 'CA', 'non-matching country');
check($matching->evaluation()['context']['Vip'] === true, 'VIP entity');
check($other->evaluation()['context']['Vip'] === false, 'standard entity');
$missing = RequestContext::fromCookies(['toggly_order' => 'missing']);
check(!isset($missing->evaluation()['context']), 'missing entity stays missing');
$bad = RequestContext::fromCookies(['toggly_identity' => ['alice'], 'toggly_order' => '../secret']);
check($bad->identity === 'alice' && $bad->order === 'ord-vip', 'malformed cookies have safe defaults');
check(RequestContext::validChanges(['preset' => 'matching', 'identity' => 'alice', 'order' => 'missing', 'scenario' => 'both']) !== null, 'valid POST accepted');
check(RequestContext::validChanges(['preset' => 'matching', 'identity' => ['alice'], 'order' => 'missing', 'scenario' => 'both']) === null, 'array POST rejected');
check(count(FlagCatalog::keys()) === 16, 'sixteen shared catalog keys');
check(FlagCatalog::filters()['filter-percentage']['parameters']['Value'] === '50', 'percentage uses the PHP string wire form');
check(FlagCatalog::filters()['filter-context-property']['parameters']['ContextKind'] === 'Order', 'Order context-property recipe is preserved');
echo "{$checks} request-context checks passed.\n";
