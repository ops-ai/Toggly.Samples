<?php
// The core variant result is shown separately because the WordPress plugin has no accessor.
use TogglySample\Showcase;
$variant = $runtime->variants?->variant();
?>
<section class="hero-card">
    <div>
        <span class="eyebrow">NATIVE PHP CORE · SEPARATE FROM THE PLUGIN</span>
        <h2>
            A configuration, not just a switch.
        </h2>
        <p>
            The WordPress adapter has no variant accessor. This section constructs a request-owned native core provider using the published WordPress HTTP classes, then fetches a server-assigned variant with the current identity already configured.
        </p>
    </div>
    <div class="feature-preview" id="variant-preview">
        <span class="preview-label"><?php echo esc_html($context->identity); ?>'S ASSIGNMENT</span>
        <h3>
            <?php echo esc_html($variant['name'] ?? 'No enabled variant'); ?>
        </h3>
        <p>
            <?php echo esc_html($variant['configurationValue']['heading'] ?? 'The feature is disabled or no assignment was returned.'); ?>
        </p>
    </div>
</section>
<section class="panel">
    <h2>
        Read, then compose a variant gate
    </h2>
    <?php Showcase::code("\$settings = new TogglySettings([\n    'enable_variants' => true,\n    'identity' => \$requestIdentity,\n    // Include the app key, environment and signature settings.\n]);\n\n\$provider->refreshFeatures();\n\$variant = \$provider->getVariant('new-dashboard');\nif ((\$variant['name'] ?? null) === 'compact') {\n    // Render the compact layout.\n}\n\$provider->shutdown();"); ?>
    <p>
        The provider is independent for each request and is closed at shutdown. The identity is passed before the first fetch, never changed on a shared provider. The conditional view is sample PHP composition around a native core variant result.
    </p>
    <?php Showcase::code(json_encode($variant, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)); ?>
    <p>
        Offline Alice receives compact and Bob classic from a signed deterministic fixture. This demonstrates parsing and signature verification against the fixture's own ephemeral key; it is not live platform authenticity proof.
    </p>
</section>
