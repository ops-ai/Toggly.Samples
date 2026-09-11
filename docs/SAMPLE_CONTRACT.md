# Sample Contract

Every sample in this repository must satisfy this contract.
Reference implementation: [`nextjs-server-sdk/`](../nextjs-server-sdk/).

## Required sections

1. Home — map, flag checklist, and live snapshot
2. Declarative gates — feature, negate, variant, and multi-key examples
3. Programmatic API
4. Identity — request- or session-scoped; request handling must not mutate
   process-wide identity
5. Entity context — an `Order` with `Vip` context
6. Filters matrix — Matching and Non-matching presets
7. Package-unique surfaces — middleware, edge, framework hooks, or equivalent
8. Missing app-key banner — configuration errors are visible without crashing

## Shared names

Use the applications, context kind, flags, and filter presets in
[`FLAG_TEMPLATE.md`](FLAG_TEMPLATE.md).

## Quality

- The sample README includes a quick start, Toggly app setup, package versions,
  a section table, and a manual checklist.
- Teach a reader who is new to feature flags: include a first-toggle exercise
  with enabled/disabled expectations and a source-reading map. Explain keys,
  definitions, environments, evaluation, initialization, defaults, refresh/cache
  and failure behavior, identity scope, entity mapping, and the distinction
  between boolean branches and experiment assignment where those surfaces exist.
- Place useful why/how comments at the actual configuration, evaluation, gate,
  identity/context, and framework-boundary callsites. Explain non-obvious SDK
  behavior and limitations rather than narrating syntax. Demo claims are not
  authentication, and presentation gates do not replace authorization.
- Explain environment variables in the example file and README, including any
  browser-exposure prefix, build-time substitution, and actual fallback behavior.
- Verify teaching text against the pinned published package implementations and
  declarations, existing checks, and corresponding Toggly Docs pages. Record
  contradictions and unsupported behavior explicitly; do not promise APIs or
  isolation available only in unreleased source. Offline fixtures/builds do not
  prove live dashboard provisioning or connectivity. Preserve behavior for
  teaching-only changes and report runtime defects for separate follow-up.
- Use published packages only. Do not depend on `.local-sdk/` tarballs.
- Add offline unit or smoke tests where practical.
- CI must build and test with placeholder environment values only.
- Add the sample to the root README catalog.
- Add a CI job and a Dependabot entry, or the language ecosystem equivalent,
  for the sample folder when that folder lands.

## Behavioral rules

- Prefer negate over a separate `FeatureOff` API when the SDK uses that
  pattern.
- Document honestly when the SDK does not support a filter type yet.
- Carry request identity, claims, headers, and entity context per evaluation;
  do not mutate a shared client identity from request handling.
