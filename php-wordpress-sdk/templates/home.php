<?php
// Render SDK results from this request rather than maintaining another flag cache.
use TogglySample\FlagCatalog;
use TogglySample\Showcase;
?>
<section class="hero-card">
    <div>
        <span class="eyebrow">YOUR FIRST FLAG</span>
        <h2>
            Meet the new dashboard.
        </h2>
        <p>
            Start with <code>new-dashboard</code>. Choose <strong>both</strong> or <strong>dashboard</strong> to enable the offline flag; choose <strong>api</strong> or <strong>neither</strong> to disable it.
        </p>
        <a class="text-link" href="<?php echo esc_url(home_url('/?section=gates')); ?>">See the template change →</a>
    </div>
    <div class="feature-preview" data-feature="new-dashboard">
        <span class="preview-label">CURRENT NATIVE RESULT</span>
        <?php echo Showcase::state($flags['new-dashboard']); ?>
        <h3>
            <?php echo $flags['new-dashboard'] ? 'A new view of your work' : 'The familiar dashboard'; ?>
        </h3>
        <div class="mini-bars" aria-hidden="true">
            <i></i><i></i><i></i><i></i>
        </div>
    </div>
</section>
<section>
    <div class="section-line">
        <h2>
            Follow the trail
        </h2>
        <span class="muted">8 sections · 16 shared flags</span>
    </div>
    <div class="card-grid">
        <?php foreach (Showcase::SECTIONS as $key => $label): ?>
        <a class="section-card" href="<?php echo esc_url(home_url('/?section=' . $key)); ?>"><span><?php echo esc_html($label); ?></span><b aria-hidden="true">↗</b></a>
        <?php endforeach; ?>
    </div>
</section>
<section class="panel">
    <div class="section-line">
        <h2>
            Flag checklist &amp; live snapshot
        </h2>
        <span class="muted">Refreshed before this request's checks</span>
    </div>
    <div class="flag-grid">
        <?php foreach (FlagCatalog::keys() as $key): ?>
        <div class="flag" data-flag="<?php echo esc_attr($key); ?>">
            <code><?php echo esc_html($key); ?></code><?php echo Showcase::state($flags[$key]); ?>
        </div>
        <?php endforeach; ?>
    </div>
    <p class="footnote">
        OFF is the native result, including missing flags and unsupported Order rules. It does not prove a remote configuration exists.
    </p>
</section>
<section class="panel">
    <h2>
        Read the source with a purpose
    </h2>
    <p>
        Start with <code>mu-plugins/sample.php</code> for native startup, then <code>src/Runtime.php</code> for request flow. Each <code>templates/</code> file teaches one section. <code>FlagCatalog.php</code> preserves the shared recipe; <code>OfflineTransport.php</code> supplies explicit demo data.
    </p>
</section>
