<?php
// The entity stays separate from the person; preserve the SDK limitation in the output.
use TogglySample\Showcase;
?>
<section class="hero-card">
    <div>
        <span class="eyebrow">ENTITY ≠ USER</span>
        <h2>
            One person. Different Orders.
        </h2>
        <p>
            Keep the user fixed while switching <strong>ord-vip</strong>, <strong>ord-standard</strong>, and <strong>missing</strong>. An Order is the thing being evaluated, not the person making the request.
        </p>
    </div>
    <div class="feature-preview">
        <span class="preview-label">EXPRESS CHECKOUT</span><?php echo Showcase::state($flags['ExpressCheckout']); ?>
        <h3>
            <?php echo esc_html($context->order); ?>
        </h3>
    </div>
</section>
<section class="panel">
    <h2>
        An honest native gap
    </h2>
    <p>
        The shared rule is <code>ContextProperty</code>: <code>Order.Vip eq true</code>, with an Order binding on both <code>ExpressCheckout</code> and <code>filter-context-property</code>. Published PHP 1.0.0 has no evaluator for it, so both flags remain OFF for VIP, standard and missing entities.
    </p>
    <p>
        The sample preserves the exact rule and controls. It does not replace the SDK with its own Order evaluator.
    </p>
    <?php Showcase::code(json_encode($context->evaluation()['context'] ?? null, JSON_PRETTY_PRINT)); ?>
    <p>
        <code>filter-context-property</code> <?php echo Showcase::state($flags['filter-context-property']); ?>
    </p>
</section>
