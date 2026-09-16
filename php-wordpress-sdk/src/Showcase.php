<?php

namespace TogglySample;

final class Showcase
{
    public const SECTIONS = [
        'home' => 'Start here',
        'gates' => 'Template gates',
        'programmatic' => 'Programmatic API',
        'identity' => 'Identity',
        'orders' => 'Order context',
        'filters' => 'Filter matrix',
        'wordpress' => 'WordPress',
        'variants' => 'Core variants',
    ];

    public function __construct(public readonly Runtime $runtime)
    {
    }

    public function render(string $section): void
    {
        $runtime = $this->runtime;
        $context = $runtime->context;
        $flags = $runtime->snapshot();
        $title = self::SECTIONS[$section];
        // Each file is a readable teaching surface. Only fixed section names choose files.
        require $runtime->root . '/templates/layout.php';
    }

    public static function state(bool $enabled): string
    {
        return '<span class="state ' . ($enabled ? 'on' : 'off') . '">' . ($enabled ? 'ON' : 'OFF') . '</span>';
    }

    public static function code(string $code): void
    {
        echo '<pre><code>' . esc_html($code) . '</code></pre>';
    }
}
