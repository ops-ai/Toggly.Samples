<?php
// Inspect native WordPress surfaces without replacing the installed plugin behavior.
use TogglySample\Showcase;
?>
<section class="panel">
    <span class="eyebrow">NATIVE HOST INTEGRATION</span>
    <h2>
        WordPress does the hosting
    </h2>
    <p>
        The sample's MU loader requires the Composer autoloader, then the published plugin entry. The plugin initializes on <code>plugins_loaded</code>, registers its shortcode, settings page, cron callbacks and administrator bar.
    </p>
    <a class="button" href="<?php echo esc_url(admin_url('options-general.php?page=toggly')); ?>">Open native Settings → Toggly ↗</a>
    <p class="footnote">
        Use the disposable WordPress login created by setup. Environment configuration is authoritative in this sample, so edit the ignored .env and restart the host to change app settings.
    </p>
</section>
<section class="panel">
    <h2>
        Two real recurring hooks
    </h2>
    <div class="table-scroll">
        <table>
            <thead>
                <tr>
                    <th>
                        Native hook
                    </th>
                    <th>
                        Registered interval
                    </th>
                    <th>
                        Next scheduled UTC
                    </th>
                </tr>
            </thead>
            <tbody>
                <?php
                foreach (['toggly_refresh_features', 'toggly_send_stats'] as $hook):
                    $event = wp_get_scheduled_event($hook);
                ?>
                <tr>
                    <td>
                        <code><?php echo esc_html($hook); ?></code>
                    </td>
                    <td>
                        <?php echo $event ? esc_html((string) $event->interval) . ' seconds' : 'Not scheduled'; ?>
                    </td>
                    <td>
                        <?php echo $event ? esc_html(gmdate('Y-m-d H:i:s', $event->timestamp)) : 'Not scheduled'; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <p>
        The loader registers intervals before native initialization. Automatic traffic-driven cron is disabled for deterministic local behavior; a normal scheduler can request <code>/wp-cron.php</code>. The native cron endpoint completes its HTTP response before processing due work.
    </p>
    <?php Showcase::code('curl -fsS http://localhost:8011/wp-cron.php'); ?>
    <p>
        Snapshot persistence is explicitly <code>none</code>. Cron refresh updates only that cron request's memory; each page refreshes again before evaluation. Native transient storage cannot load with the installed PSR-16 v3 types, so it is not silently enabled.
    </p>
</section>
<section class="panel">
    <h2>
        Telemetry and hook boundaries
    </h2>
    <p>
        The native telemetry callback can run, but this published WordPress adapter loses the POST body when passing the request stream. An attempted send is not delivered analytics. No replacement transport is installed in live configuration.
    </p>
    <p>
        The advertised feature-turns-on/off bridge is not a working state-change notification surface in this package. The sample does not manually dispatch those actions. Use explicit native refresh and the visible results on the next page.
    </p>
    <p>
        <code>beta-access</code> <?php echo Showcase::state($flags['beta-access']); ?> controls this sample-composed preview: <strong><?php echo $flags['beta-access'] ? 'Beta preview available' : 'Standard experience'; ?></strong>.
    </p>
</section>
