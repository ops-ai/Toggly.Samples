# Published .NET frontend telemetry consumers

These two standalone executables install NuGet `Toggly.FeatureManagement.Client`
and `Toggly.FeatureManagement.Client.Desktop` 3.10.0 with locked registry
dependencies. They use no project references or locally packed SDKs. The
portable consumer supplies its own validating ES256 host verifier; the Desktop
consumer uses the published native verifier and inherits the portable reporter.

Both consumers use an ephemeral signed definitions fixture and a local HTTP
collector. The test key is synthetic. No request is sent to production. The
collector captures compact bodies and asserts the native transport includes
neither Origin nor credentials. The named `preview-a` usage/view event is an
explicit label, not an assigned experiment variant: this Boolean client does
not expose experiment variant assignment. Actual `i`/`u` fields are printed
for observation; the approved contract requires `k/e/f/m` and permits optional
`i/u` attribution.

From `dotnet-client-sdk/`:

```sh
dotnet restore tests/PublicTelemetry/Portable --locked-mode
dotnet restore tests/PublicTelemetry/Desktop --locked-mode
dotnet build tests/PublicTelemetry/Portable -c Release --no-restore
dotnet build tests/PublicTelemetry/Desktop -c Release --no-restore
dotnet run --project tests/PublicTelemetry/Portable -f net8.0 -c Release --no-build --no-restore
dotnet run --project tests/PublicTelemetry/Desktop -f net8.0 -c Release --no-build --no-restore
dotnet run --project tests/PublicTelemetry/Portable -f net10.0 -c Release --no-build --no-restore
dotnet run --project tests/PublicTelemetry/Desktop -f net10.0 -c Release --no-build --no-restore
dotnet run --project tests/PublicTelemetry/Portable -f net8.0 -c Release --no-build --no-restore -- --retry
dotnet run --project tests/PublicTelemetry/Portable -f net8.0 -c Release --no-build --no-restore -- --diagnose-legacy-kefm
```

The retry mode intentionally waits through the published 30- and 60-second
backoffs for 429 then 503 before a 202, then tests that an ambiguous HTTP
disconnect is never replayed. The Desktop executable also exercises the
portable reporter through the native adapter, including final plain flush on
`DisposeAsync`. It is a real console desktop lifetime host; a graphical
Avalonia window and production telemetry ingestion are separate gates.

`--diagnose-legacy-kefm` is a deliberate, expected-failing diagnostic for
the superseded `k/e/f/m`-only contract. It still asserts that exact legacy
field set and fails against the published 3.10.0 packet when `u` is present.
The ordinary host records the actual optional field under the approved
`k/e/f/m` plus optional `i/u` policy. Do not run the legacy diagnostic as a
passing CI gate or mistake its expected failure for a current policy conflict.
