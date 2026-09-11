<?php

namespace App\Support;

final class FlagCatalog
{
    public const BASE_KEYS = [
        'new-dashboard',
        'api-v2',
        'enhanced-submit',
        'ExpressCheckout',
        'beta-access',
    ];

    // Native Definitions schemas are explicit so the reader can copy the exact rule.
    public const FILTERS = [
        [
            'key' => 'filter-always-on',
            'title' => 'Always On',
            'filter' => 'AlwaysOn',
            'parameters' => [],
            'note' => 'Always on for both presets.',
            'supported' => true,
        ],
        [
            'key' => 'filter-percentage',
            'title' => 'Percentage',
            'filter' => 'Percentage',
            'parameters' => [
                'Value' => '50',
            ],
            'note' => 'Sticky 50% per identity; both presets may share a result.',
            'supported' => true,
        ],
        [
            'key' => 'filter-targeting',
            'title' => 'Targeting',
            'filter' => 'Targeting',
            'parameters' => [
                'Audience.Users:0' => 'alice',
            ],
            'note' => 'Only alice matches.',
            'supported' => true,
        ],
        [
            'key' => 'filter-user-claims',
            'title' => 'User Claims',
            'filter' => 'UserClaims',
            'parameters' => [
                'Claim' => 'role',
                'Value' => 'admin',
                'Percentage' => '100',
            ],
            'note' => 'Explicit context claims.role must be admin.',
            'supported' => true,
        ],
        [
            'key' => 'filter-time-window',
            'title' => 'Time Window',
            'filter' => 'TimeWindow',
            'parameters' => [
                'Start' => '2020-01-01T00:00:00Z',
                'End' => '2099-12-31T23:59:59Z',
            ],
            'note' => 'Open for both presets from 2020 through 2099.',
            'supported' => true,
        ],
        [
            'key' => 'filter-country',
            'title' => 'Country',
            'filter' => 'Country',
            'parameters' => [
                'Country:0' => 'US',
                'Percentage' => '100',
            ],
            'note' => 'Explicit request.country must be US.',
            'supported' => true,
        ],
        [
            'key' => 'filter-browser-family',
            'title' => 'Browser Family',
            'filter' => 'BrowserFamily',
            'parameters' => [
                'BrowserFamily:0' => 'Chrome',
                'Percentage' => '100',
            ],
            'note' => 'The native parser detects Chrome.',
            'supported' => true,
        ],
        [
            'key' => 'filter-browser-language',
            'title' => 'Browser Language',
            'filter' => 'BrowserLanguage',
            'parameters' => [
                'BrowserLanguage:0' => 'en',
                'Percentage' => '100',
            ],
            'note' => 'Accept-Language contains en.',
            'supported' => true,
        ],
        [
            'key' => 'filter-device-type',
            'title' => 'Device Type',
            'filter' => 'DeviceType',
            'parameters' => [
                'DeviceType:0' => 'Macintosh',
                'Percentage' => '100',
            ],
            'note' => 'Unsupported Macintosh match: native PHP classifies this desktop UA as Other.',
            'supported' => false,
        ],
        [
            'key' => 'filter-os',
            'title' => 'Operating System',
            'filter' => 'OperatingSystem',
            'parameters' => [
                'OperatingSystem:0' => 'Mac',
                'Percentage' => '100',
            ],
            'note' => 'Native Mac OS classification matches Mac.',
            'supported' => true,
        ],
        [
            'key' => 'filter-context-property',
            'title' => 'Context Property',
            'filter' => 'ContextProperty',
            'parameters' => [
                'ContextKind' => 'Order',
                'Property' => 'Vip',
                'Operator' => 'eq',
                'Value' => 'true',
                'ValueType' => 'boolean',
            ],
            'note' => 'Unsupported: published PHP does not evaluate ContextProperty or Order entities.',
            'supported' => false,
        ],
    ];

    public static function keys(): array
    {
        return array_merge(self::BASE_KEYS, array_column(self::FILTERS, 'key'));
    }

    public static function definitions(string $scenario): array
    {
        $definitions = [];
        foreach (self::FILTERS as $row) {
            $definitions[] = [
                'featureKey' => $row['key'],
                'filters' => [
                    [
                        'name' => $row['filter'],
                        'parameters' => $row['parameters'],
                    ],
                ],
            ];
        }

        foreach (self::BASE_KEYS as $key) {
            if ($key === 'ExpressCheckout') {
                // Preserve the real unsupported rule instead of inventing VIP success.
                $contextRule = self::FILTERS[array_key_last(self::FILTERS)];
                $filters = [
                    [
                        'name' => $contextRule['filter'],
                        'parameters' => $contextRule['parameters'],
                    ],
                ];
            } elseif ($scenario === 'off') {
                $filters = [
                    ['name' => 'AlwaysOff'],
                ];
            } elseif ($key === 'beta-access' && $scenario === 'mixed') {
                $filters = [
                    [
                        'name' => 'Targeting',
                        'parameters' => [
                            'Audience.Users:0' => 'alice',
                        ],
                    ],
                ];
            } else {
                $enabled = $scenario === 'all' || $key !== 'api-v2';
                $filters = [
                    ['name' => $enabled ? 'AlwaysOn' : 'AlwaysOff'],
                ];
            }

            $definitions[] = [
                'featureKey' => $key,
                'filters' => $filters,
                'metrics' => $key === 'enhanced-submit' ? ['sample-clicks'] : [],
            ];
        }

        return $definitions;
    }
}
