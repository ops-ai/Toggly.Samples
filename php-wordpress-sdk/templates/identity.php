<?php
// Show explicit targeting input so demo claims are not confused with WordPress permissions.
use TogglySample\Showcase;
?>
<section class="panel">
    <span class="eyebrow">ONE BROWSER, ONE CONTEXT</span>
    <h2>
        <?php echo esc_html(ucfirst($context->identity)); ?> is making this request
    </h2>
    <p>
        Targeting result: <?php echo Showcase::state($flags['filter-targeting']); ?>. Switch Alice to Bob while keeping the same Order. Then open another browser session: its cookies and evaluations remain independent.
    </p>
    <?php Showcase::code(json_encode($context->evaluation(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)); ?>
    <p>
        <code>identity</code> supplies targeting and sticky rollout input. Claims and request headers are explicit fields. No request handling changes a shared SDK identity.
    </p>
</section>
<section class="panel">
    <h2>
        Demo identity is not a WordPress login
    </h2>
    <p>
        Alice's <code>role=admin</code> is example targeting data. It does not grant WordPress's <code>manage_options</code> capability. Sign in through WordPress to inspect the real Settings page and admin bar.
    </p>
    <p>
        The native WordPress context provider derives telemetry identifiers from WordPress login/IP data. It is not an automatic targeting provider. The published core's usage recording does not guarantee attribution to the explicit evaluation persona; do not interpret these demo counters as user analytics.
    </p>
</section>
