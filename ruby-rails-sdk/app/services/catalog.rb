# frozen_string_literal: true

module Catalog
  SECTIONS = {
    '/' => ['Home', 'Start here, check all sixteen flags, and watch current evaluations.'],
    '/gates' => ['Declarative gates', 'Use native Rails view helpers, negate, Any and All.'],
    '/api' => ['Programmatic API', 'Protect an HTTP route and a state-changing action.'],
    '/identity' => ['Identity', 'Keep a demo persona in this browser’s encrypted Rails session.'],
    '/orders' => ['Order context', 'Change the Order while preserving the same user.'],
    '/filters' => ['Filter matrix', 'Compare the exact Matching and Non-matching presets.'],
    '/sdk' => ['Native surfaces', 'Inspect diagnostics, snapshots, polling and telemetry.'],
    '/setup' => ['Configuration', 'Understand missing keys, defaults and the manual setup.']
  }.freeze

  FILTERS = [
    ['always-on', 'AlwaysOn', 'ON for both presets.'],
    ['percentage', 'Percentage', '50% sticky by identity; opposite outcomes are not guaranteed.'],
    ['targeting', 'Targeting', 'Native sole-rule result is ON for alice and bob; negative targeting is not demonstrated.'],
    ['user-claims', 'UserClaims', 'role=admin; segment percentage 100.'],
    ['time-window', 'TimeWindow', 'Open from 2020 through 2099; ON for both presets.'],
    ['country', 'Country', 'US; segment percentage 100.'],
    ['browser-family', 'BrowserFamily', 'Chrome; segment percentage 100.'],
    ['browser-language', 'BrowserLanguage', 'en; segment percentage 100.'],
    ['device-type', 'DeviceType', 'Native Macintosh preset evaluates OFF for both; parser reports Other.'],
    ['os', 'OperatingSystem', 'Mac; segment percentage 100.'],
    ['context-property', 'ContextProperty', 'Order.Vip equals boolean true.']
  ].freeze

  FLAGS = (%w[new-dashboard api-v2 enhanced-submit ExpressCheckout beta-access] +
           FILTERS.map { |suffix, _name, _note| "filter-#{suffix}" }).freeze
  DEFAULTS = FLAGS.to_h { |key| [key, false] }.freeze
end
