<?php
// The endpoint performs its own native check before returning its gated response.
use TogglySample\Showcase;
?>
<section class="panel">
    <span class="eyebrow">NATIVE PLUGIN INSTANCE</span>
    <h2>
        Ask before doing the work
    </h2>
    <?php Showcase::code("\$plugin = \\Toggly\\WordPress\\TogglyPlugin::getInstance();\n\$enabled = \$plugin->isEnabled('api-v2', \$requestContext);"); ?>
    <p>
        Current <code>api-v2</code>: <?php echo Showcase::state($flags['api-v2']); ?>. The demo endpoint evaluates this flag again in its own request, before returning an allowed or denied JSON response.
    </p>
    <a class="button" href="<?php echo esc_url(home_url('/sample-api')); ?>">Request the gated API ↗</a>
    <p class="footnote">
        Expect HTTP 200 when enabled and HTTP 403 when disabled. This is a feature gate demonstration, not API authentication.
    </p>
</section>
<section class="panel">
    <h2>
        Loading, missing flags and failures
    </h2>
    <p>
        WordPress waits for the native first refresh before rendering. An unknown key returns false. The native provider waits up to 2.5 seconds per check when initial loading fails. This full sixteen-flag page can therefore take roughly 40 seconds. Try <strong>invalid-json</strong> in offline mode to see a new request with unusable definitions fail closed; choose <strong>both</strong> to recover.
    </p>
    <p>
        Missing key result: <?php echo Showcase::state($runtime->enabled('not-in-the-catalog')); ?>
    </p>
    <p>
        Native network retries can delay live requests. This sample does not replace retry behavior or display a fabricated successful result. No persisted snapshot is configured, so a new request cannot use a prior request's in-memory definitions.
    </p>
</section>
<section class="panel">
    <h2>
        Gate a mutation before applying it
    </h2>
    <p>
        <code>enhanced-submit</code> is <?php echo Showcase::state($flags['enhanced-submit']); ?>. In an application, evaluate this flag after normal authentication, permissions and nonce checks, but before performing the enhanced action. The sample controls change demo cookies only.
    </p>
    <?php Showcase::code("if (\$plugin->isEnabled('enhanced-submit', \$requestContext)) {\n    // Apply the enhanced behavior after normal permission checks.\n}"); ?>
</section>
