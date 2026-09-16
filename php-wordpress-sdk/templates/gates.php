<?php
use TogglySample\Showcase;
use function Toggly\WordPress\toggly_is_enabled;

// Rich context belongs in the native PHP helper; shortcode context below is a simple object.
$dashboard = toggly_is_enabled('new-dashboard', $context->evaluation());
$api = toggly_is_enabled('api-v2', $context->evaluation());
$shortcode = '[toggly_feature name="filter-targeting" context=\'{"identity":"' . $context->identity . '"}\']<p class="success">The native shortcode admitted Alice.</p>[/toggly_feature]';
?>
<div class="two-columns">
    <section class="panel">
        <span class="eyebrow">NATIVE WORDPRESS HELPER</span>
        <h2>
            A feature gate
        </h2>
        <div id="feature-gate">
            <?php echo $dashboard ? '<p class="success">The new dashboard is visible.</p>' : '<p>The new dashboard is hidden.</p>'; ?>
        </div>
        <?php Showcase::code("use function Toggly\\WordPress\\toggly_is_enabled;\n\nif (toggly_is_enabled('new-dashboard', \$context)) {\n    // Render the new view.\n}"); ?>
    </section>
    <section class="panel">
        <span class="eyebrow">SAMPLE TEMPLATE COMPOSITION</span>
        <h2>
            The opposite branch
        </h2>
        <div id="negate-gate">
            <?php echo !$dashboard ? '<p class="success">The fallback dashboard is visible.</p>' : '<p>The fallback stays hidden.</p>'; ?>
        </div>
        <?php Showcase::code("if (!toggly_is_enabled('new-dashboard', \$context)) {\n    // Render the familiar view.\n}"); ?>
    </section>
</div>
<section class="panel">
    <span class="eyebrow">NATIVE SHORTCODE</span>
    <h2>
        A block for Alice
    </h2>
    <div id="native-shortcode">
        <?php echo do_shortcode($shortcode) ?: '<p>Bob does not see the gated content.</p>'; ?>
    </div>
    <?php Showcase::code('[toggly_feature name="filter-targeting" context=\'{"identity":"alice"}\']' . "\n    A block for Alice.\n[/toggly_feature]"); ?>
    <p>
        Use a JSON object without array brackets in shortcode attributes. WordPress's shortcode parser stops at <code>]</code>; pass richer request and Order context through the native PHP helper.
    </p>
</section>
<section class="panel">
    <span class="eyebrow">SAMPLE MULTI-KEY COMPOSITION</span>
    <h2>
        Two flags, four combinations
    </h2>
    <div class="result-pair">
        <span>All: dashboard AND API <?php echo Showcase::state($dashboard && $api); ?></span><span>Any: dashboard OR API <?php echo Showcase::state($dashboard || $api); ?></span>
    </div>
    <p id="multi-gate" data-all="<?php echo $dashboard && $api ? 'true' : 'false'; ?>" data-any="<?php echo $dashboard || $api ? 'true' : 'false'; ?>">
        Select both, dashboard, api or neither in Offline flags. PHP combines two native helper results; the plugin does not provide a multi-key shortcode.
    </p>
    <?php Showcase::code("\$all = \$dashboard && \$api;\n\$any = \$dashboard || \$api;"); ?>
    <p>
        <a href="<?php echo esc_url(home_url('/?section=variants')); ?>">Continue to the native core variant gate →</a>
    </p>
</section>
