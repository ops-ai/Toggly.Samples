<?php

namespace TogglySample;

final class FlagCatalog
{
    public const BASELINE = [
        'new-dashboard',
        'api-v2',
        'enhanced-submit',
        'ExpressCheckout',
        'beta-access',
    ];

    public static function filters(): array
    {
        // Native PHP wire parameters are strings and indexed lists, matching
        // the reviewed Laravel sample and the published 1.0.0 evaluator.
        return [
            'filter-always-on' => [
                'title' => 'Always On',
                'name' => 'AlwaysOn',
                'parameters' => [],
                'note' => 'ON for both presets.',
            ],
            'filter-percentage' => [
                'title' => 'Percentage',
                'name' => 'Percentage',
                'parameters' => ['Value' => '50'],
                'note' => 'Sticky by identity; Alice/Bob outcomes are not prescribed.',
            ],
            'filter-targeting' => [
                'title' => 'Targeting',
                'name' => 'Targeting',
                'parameters' => ['Audience.Users:0' => 'alice'],
                'note' => 'Alice is included; Bob is not.',
            ],
            'filter-user-claims' => [
                'title' => 'User Claims',
                'name' => 'UserClaims',
                'parameters' => [
                    'Percentage' => '100',
                    'Claim' => 'role',
                    'Value' => 'admin',
                ],
                'note' => 'Matches role=admin at 100 percent.',
            ],
            'filter-time-window' => [
                'title' => 'Time Window',
                'name' => 'TimeWindow',
                'parameters' => [
                    'Start' => '2020-01-01T00:00:00Z',
                    'End' => '2099-12-31T23:59:59Z',
                ],
                'note' => 'Open for both presets from 2020 through 2099.',
            ],
            'filter-country' => [
                'title' => 'Country',
                'name' => 'Country',
                'parameters' => [
                    'Percentage' => '100',
                    'Country:0' => 'US',
                ],
                'note' => 'US matches; CA does not.',
            ],
            'filter-browser-family' => [
                'title' => 'Browser Family',
                'name' => 'BrowserFamily',
                'parameters' => [
                    'Percentage' => '100',
                    'BrowserFamily:0' => 'Chrome',
                ],
                'note' => 'Chrome matches; Firefox does not.',
            ],
            'filter-browser-language' => [
                'title' => 'Browser Language',
                'name' => 'BrowserLanguage',
                'parameters' => [
                    'Percentage' => '100',
                    'BrowserLanguage:0' => 'en',
                ],
                'note' => 'English matches; French does not.',
            ],
            'filter-device-type' => [
                'title' => 'Device Type',
                'name' => 'DeviceType',
                'parameters' => [
                    'Percentage' => '100',
                    'DeviceType:0' => 'Macintosh',
                ],
                'note' => 'Native limitation: both exact desktop agents parse as Other, so OFF for both. Macintosh is preserved.',
            ],
            'filter-os' => [
                'title' => 'Operating System',
                'name' => 'OperatingSystem',
                'parameters' => [
                    'Percentage' => '100',
                    'OperatingSystem:0' => 'Mac',
                ],
                'note' => 'Mac matches; Windows does not.',
            ],
            'filter-context-property' => [
                'title' => 'Context Property',
                'name' => 'ContextProperty',
                'parameters' => [
                    'ContextKind' => 'Order',
                    'Property' => 'Vip',
                    'Operator' => 'eq',
                    'Value' => 'true',
                    'ValueType' => 'boolean',
                ],
                'note' => 'Unsupported by the PHP evaluator: OFF for VIP, standard and missing Order.',
            ],
        ];
    }

    public static function keys(): array
    {
        return array_merge(self::BASELINE, array_keys(self::filters()));
    }

    public static function definitions(string $scenario): array
    {
        $dashboard = in_array($scenario, ['both', 'dashboard'], true);
        $api = in_array($scenario, ['both', 'api'], true);
        $definitions = [];
        foreach ([
            'new-dashboard' => $dashboard,
            'api-v2' => $api,
            'enhanced-submit' => $dashboard,
            'beta-access' => $api,
        ] as $key => $enabled) {
            $definitions[] = [
                'featureKey' => $key,
                'filters' => $enabled ? [['name' => 'AlwaysOn', 'parameters' => []]] : [],
            ];
        }
        foreach (self::filters() as $key => $filter) {
            $definition = [
                'featureKey' => $key,
                'filters' => [[
                    'name' => $filter['name'],
                    'parameters' => $filter['parameters'],
                ]],
            ];
            if ($key === 'filter-context-property') {
                // A platform Order binding accompanies the ContextProperty rule.
                $definition['contextKind'] = 'Order';
                $checkout = $definition;
                $checkout['featureKey'] = 'ExpressCheckout';
                $definitions[] = $checkout;
            }
            $definitions[] = $definition;
        }
        return $definitions;
    }
}
