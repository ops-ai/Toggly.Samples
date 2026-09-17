<?php
// Keep the shared matrix rows visible even when a native evaluator cannot match them.
use TogglySample\FlagCatalog;
use TogglySample\Showcase;
?>
<section class="panel">
    <div class="section-line">
        <h2>
            The eleven-filter matrix
        </h2>
        <span class="muted"><?php echo esc_html($context->preset); ?></span>
    </div>
    <p>
        Use the exact preset buttons above. Each result below comes from the native plugin with the current request context. The notes distinguish expected matching behavior from native limitations.
    </p>
    <div class="table-scroll">
        <table>
            <thead>
                <tr>
                    <th scope="col">
                        Filter / flag
                    </th>
                    <th scope="col">
                        Native result
                    </th>
                    <th scope="col">
                        What to expect
                    </th>
                </tr>
            </thead>
            <tbody>
                <?php foreach (FlagCatalog::filters() as $key => $filter): ?>
                <tr data-filter="<?php echo esc_attr($key); ?>">
                    <td>
                        <strong><?php echo esc_html($filter['title']); ?></strong><code><?php echo esc_html($key); ?></code>
                    </td>
                    <td>
                        <?php echo Showcase::state($flags[$key]); ?>
                    </td>
                    <td>
                        <?php echo esc_html($filter['note']); ?>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</section>
<section class="panel">
    <h2>
        Exact inputs, visible assumptions
    </h2>
    <p>
        Matching uses Alice, role admin, US, English and Chrome 120 on macOS with a VIP Order. Non-matching uses Bob, role user, CA, French and Firefox 121 on Windows with a standard Order. Device Type remains <strong>Macintosh</strong>; Operating System remains <strong>Mac</strong>.
    </p>
    <?php Showcase::code(json_encode($context->evaluation()['request'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)); ?>
</section>
