<?php
// Common navigation and controls let the reader compare examples with the same context.
use TogglySample\Environment;
use TogglySample\Showcase;
?>
<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title><?php echo esc_html($title); ?> · Toggly WordPress</title>
        <link rel="stylesheet" href="<?php echo esc_url(home_url('/sample-assets/style.css')); ?>">
        <?php wp_head(); ?>
    </head>
    <body>
        <a class="skip-link" href="#main">Skip to content</a>
        <header class="masthead">
            <a class="brand" href="<?php echo esc_url(home_url('/')); ?>"><span class="brand-mark">t</span> toggly <span class="brand-divider">/</span> <span>WordPress lab</span></a>
            <span class="edition">PHP 8.5 · WordPress 7.1</span>
        </header>
        <div class="shell">
            <aside class="sidebar">
                <p class="eyebrow">
                    THE FIELD GUIDE
                </p>
                <nav aria-label="Showcase sections">
                    <?php foreach (Showcase::SECTIONS as $key => $label): ?>
                    <a href="<?php echo esc_url(home_url('/?section=' . $key)); ?>" <?php echo $key === $section ? 'aria-current="page"' : ''; ?>><?php echo esc_html($label); ?></a>
                    <?php endforeach; ?>
                </nav>
                <div class="sidebar-note">
                    <span class="status-dot"></span>
                    <?php echo Environment::offline() ? 'Offline playground' : 'Live configuration'; ?>
                    <p>
                        Native SDK results.<br>One WordPress request at a time.
                    </p>
                </div>
            </aside>
            <main id="main">
                <div class="page-heading">
                    <p class="eyebrow">
                        FEATURE MANAGEMENT, IN PRACTICE
                    </p>
                    <h1>
                        <?php echo esc_html($title); ?>
                    </h1>
                    <p class="lede">
                        Small switches. Clear examples. Explore the published WordPress plugin with a context you can change.
                    </p>
                </div>
                <?php if (Environment::offline()): ?>
                <div class="notice" role="status" id="missing-key">
                    <strong>No app key? Start exploring.</strong>
                    <span>All HTTP stays offline. These signed fixtures are demo data, evaluated by the installed SDK. Add your own app key to connect later.</span>
                </div>
                <?php endif; ?>
                <?php if (isset($_GET['updated'])): ?>
                <p class="success" role="status">
                    Context saved. This new request refreshed definitions before evaluating.
                </p>
                <?php endif; ?>
                <?php require $runtime->root . '/templates/controls.php'; ?>
                <?php require $runtime->root . '/templates/' . $section . '.php'; ?>
                <footer class="page-footer">
                    <span>Published WordPress 1.0.0 + PHP core 1.0.0</span>
                    <a href="<?php echo esc_url(home_url('/?snapshot=1')); ?>">View this request as JSON ↗</a>
                    <p>
                        Demo personas are not authentication. Local flags are not an authorization boundary.
                    </p>
                </footer>
            </main>
        </div>
        <?php wp_footer(); ?>
    </body>
</html>
