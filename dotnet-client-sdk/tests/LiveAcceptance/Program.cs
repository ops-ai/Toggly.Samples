using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using Toggly.FeatureManagement.Client;
using Toggly.FeatureManagement.Client.Desktop;
using LiveAcceptance;

// Configuration comes only from the launching environment. Never echo key values,
// request URLs, SDK exception messages, or signed payloads into acceptance logs.
if (Environment.GetEnvironmentVariable("TOGGLY_LIVE_ACCEPTANCE") != "1"
    || string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("TOGGLY_APP_KEY"))
    || string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("TOGGLY_ENVIRONMENT")))
{
    Evidence.Log("configuration-required");
    return 2;
}

var mode = Environment.GetEnvironmentVariable("TOGGLY_LIVE_CHILD") ?? "online";
if (mode is not ("online" or "offline" or "corrupt" or "context"))
{
    Evidence.Log("configuration-required");
    return 2;
}

var directory = mode == "online"
    ? Path.Combine(Path.GetTempPath(), "toggly-live-" + Guid.NewGuid().ToString("N"))
    : Environment.GetEnvironmentVariable("TOGGLY_LIVE_CACHE");
if (string.IsNullOrWhiteSpace(directory) || (mode != "online" && !Directory.Exists(directory)))
{
    Evidence.Log("configuration-required");
    return 2;
}

try
{
    if (mode == "online")
    {
        if (OperatingSystem.IsWindows())
            Directory.CreateDirectory(directory);
        else
            Directory.CreateDirectory(directory, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
    }
    using var deadline = new CancellationTokenSource(TimeSpan.FromMinutes(3));
    var evidence = new Evidence();
    var options = new TogglyClientOptions
    {
        AppKey = Environment.GetEnvironmentVariable("TOGGLY_APP_KEY"),
        Environment = Environment.GetEnvironmentVariable("TOGGLY_ENVIRONMENT")!,
        Context = new(mode == "context" ? "uncached-live-acceptance" : "alice", ["beta"],
            new Dictionary<string, string> { ["role"] = "admin" }),
        Defaults = new Dictionary<string, bool> { ["new-dashboard"] = true },
        // The bounded runner ends before its first periodic refresh can occur.
        RefreshInterval = TimeSpan.FromDays(1),
        EnableLiveUpdates = mode == "online",
    };
    using var transport = new ObservedHttp(evidence, mode != "online");
    using var http = new HttpClient(transport) { Timeout = TimeSpan.FromSeconds(10) };
    await using (var client = new TogglyClient(options, http,
        new ObservedVerifier(evidence), new ObservedStore(directory, evidence),
        new ObservedUpdates(evidence)))
    {
        await client.InitializeAsync(deadline.Token);
        if (mode == "online")
        {
            Evidence.Require(!client.IsEnabled("new-dashboard") && evidence.Saves > 0,
                "live-baseline-not-accepted");
            Evidence.Require(evidence.Verifications > 0 && evidence.DefinitionResponses > 0,
                "signed-baseline-required");
            var baseline = evidence.LastSave!;
            Evidence.Log("baseline-accepted", baseline);
            await AwaitToggle(client, evidence, true, deadline.Token);
            await AwaitToggle(client, evidence, false, deadline.Token);
        }
        else
        {
            var accepted = mode == "offline";
            Evidence.Require(client.IsEnabled("new-dashboard") == !accepted,
                "cold-state-mismatch");
            Evidence.Require(transport.Blocked > 0 && evidence.DefinitionResponses == 0,
                "offline-transport-not-proven");
            Evidence.Require(accepted ? evidence.Verifications > 0 : evidence.Verifications == 0,
                "cold-verification-mismatch");
            Evidence.Log("cold-" + mode + "-passed");
        }
    }

    if (mode == "online")
    {
        // A new OS process has no live SDK objects, HTTP cache or verifier key cache.
        await RunChild("offline", directory, deadline.Token);
        await RunChild("context", directory, deadline.Token);
        foreach (var file in Directory.GetFiles(directory, "*.json"))
        {
            var snapshot = JsonSerializer.Deserialize<ClientSnapshot>(await File.ReadAllTextAsync(file))!;
            using var envelope = JsonDocument.Parse(snapshot.Envelope);
            var tampered = JsonSerializer.Serialize(new
            {
                defs = new Dictionary<string, bool> { ["new-dashboard"] = true },
                timestamp = envelope.RootElement.GetProperty("timestamp").GetInt64(),
                kid = envelope.RootElement.GetProperty("kid").GetString(),
                signature = envelope.RootElement.GetProperty("signature").GetString(),
            });
            await File.WriteAllTextAsync(file, JsonSerializer.Serialize(snapshot with
            {
                Envelope = tampered
            }));
        }
        await RunChild("corrupt", directory, deadline.Token);
        Evidence.Log("desktop-live-acceptance-passed");
    }
    return 0;
}
catch (Exception error)
{
    // Exception types are useful without leaking URLs or configuration from inner errors.
    Evidence.Log("acceptance-failed", new
    {
        errorType = error.GetType().Name
    });
    return 1;
}
finally
{
    if (mode == "online" && Directory.Exists(directory))
        Directory.Delete(directory, true);
}

static async Task AwaitToggle(TogglyClient client, Evidence evidence, bool expected, CancellationToken ct)
{
    var previous = evidence.LastSave!;
    var marker = evidence.Sequence;
    Evidence.Log(expected ? "set-new-dashboard-true-now" : "set-new-dashboard-false-now");
    using var window = CancellationTokenSource.CreateLinkedTokenSource(ct);
    window.CancelAfter(TimeSpan.FromSeconds(60));
    while (!evidence.IsPushApplied(marker, previous, expected) || client.IsEnabled("new-dashboard") != expected)
        await Task.Delay(100, window.Token);
    Evidence.Log("push-applied", evidence.LastSave);
}

static async Task RunChild(string mode, string directory, CancellationToken ct)
{
    var executable = Environment.ProcessPath ?? throw new InvalidOperationException();
    var start = new ProcessStartInfo(executable)
    {
        UseShellExecute = false,
        RedirectStandardOutput = true,
        RedirectStandardError = true,
    };
    if (Path.GetFileNameWithoutExtension(executable) == "dotnet")
        start.ArgumentList.Add(Assembly.GetExecutingAssembly().Location);
    start.Environment["TOGGLY_LIVE_CHILD"] = mode;
    start.Environment["TOGGLY_LIVE_CACHE"] = directory;
    using var process = Process.Start(start) ?? throw new InvalidOperationException();
    var stdout = process.StandardOutput.ReadToEndAsync(ct);
    var stderr = process.StandardError.ReadToEndAsync(ct);
    using var limit = CancellationTokenSource.CreateLinkedTokenSource(ct);
    limit.CancelAfter(TimeSpan.FromSeconds(20));
    try
    {
        await process.WaitForExitAsync(limit.Token);
        var output = await stdout;
        await stderr;
        Evidence.Require(process.ExitCode == 0, "cold-child-failed");
        // Only this executable's JSON evidence is forwarded; stderr remains private.
        var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        Evidence.Require(lines.Length == 1, "missing-child-evidence");
        foreach (var line in lines)
        {
            using var parsed = JsonDocument.Parse(line);
            Evidence.Require(parsed.RootElement.GetProperty("event").GetString() == "cold-" + mode + "-passed",
                "unexpected-child-output");
            Console.WriteLine(line);
        }
    }
    finally
    {
        if (!process.HasExited)
        {
            process.Kill(entireProcessTree: true);
            await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(5));
        }
    }
}
