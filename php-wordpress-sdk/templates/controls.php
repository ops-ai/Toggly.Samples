<?php
// A normal WordPress POST applies cookies; the redirect creates the next request context.
use TogglySample\RequestContext;
?>
<section class="controls" aria-labelledby="controls-heading">
    <div class="section-line">
        <h2 id="controls-heading">
            Your request context
        </h2>
        <span class="context-chip"><?php echo esc_html($context->identity); ?> / <?php echo esc_html($context->order); ?></span>
    </div>
    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
        <input type="hidden" name="action" value="toggly_controls">
        <input type="hidden" name="section" value="<?php echo esc_attr($section); ?>">
        <?php wp_nonce_field('toggly_controls'); ?>
        <div class="control-grid">
            <?php foreach (RequestContext::OPTIONS as $name => $options): ?>
            <label for="control-<?php echo esc_attr($name); ?>">
            <?php echo esc_html(['preset' => 'Headers + claims', 'identity' => 'Identity', 'order' => 'Order', 'scenario' => 'Offline flags'][$name]); ?>
            <select id="control-<?php echo esc_attr($name); ?>" name="<?php echo esc_attr($name); ?>">
            <?php foreach ($options as $option): ?>
            <option value="<?php echo esc_attr($option); ?>" <?php selected($context->{$name}, $option); ?>><?php echo esc_html($option); ?></option>
            <?php endforeach; ?>
            </select>
            </label>
            <?php endforeach; ?>
        </div>
        <div class="control-bottom">
            <p>
                Changes apply to your browser only. Offline flags do not change a configured Toggly app.
            </p>
            <button type="submit">Apply &amp; refresh <span aria-hidden="true">→</span></button>
        </div>
    </form>
    <div class="preset-row">
        <span>Or load the exact shared preset:</span>
        <?php foreach (['matching' => ['alice', 'ord-vip'], 'non-matching' => ['bob', 'ord-standard']] as $preset => [$identity, $order]): ?>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <input type="hidden" name="action" value="toggly_controls">
            <input type="hidden" name="section" value="<?php echo esc_attr($section); ?>">
            <input type="hidden" name="preset" value="<?php echo esc_attr($preset); ?>">
            <input type="hidden" name="identity" value="<?php echo esc_attr($identity); ?>">
            <input type="hidden" name="order" value="<?php echo esc_attr($order); ?>">
            <input type="hidden" name="scenario" value="<?php echo esc_attr($context->scenario); ?>">
            <?php wp_nonce_field('toggly_controls'); ?>
            <button class="secondary" type="submit"><?php echo esc_html(ucfirst($preset)); ?></button>
        </form>
        <?php endforeach; ?>
    </div>
</section>
