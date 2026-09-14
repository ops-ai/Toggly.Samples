using BlazorSample.Features;
using Microsoft.Extensions.Logging.Abstractions;
using Toggly.FeatureManagement;
using Toggly.FeatureManagement.Data;

var root = Path.Combine(Path.GetFullPath(args[0]), $"snapshot-checks-{Guid.NewGuid():N}");
Directory.CreateDirectory(root);
var key = "fixture-secret-must-not-be-persisted";
FileFeatureSnapshotProvider Store(string app = "fixture-secret-must-not-be-persisted", string environment = "Production") =>
    new(root, app, environment, NullLogger<FileFeatureSnapshotProvider>.Instance);
void Check(bool value, string description)
{
    if (!value) throw new InvalidOperationException(description);
    Console.WriteLine(description);
}
try
{
    var store = Store();
    var snapshot = new FeatureDefinitionsSnapshot { SignedDefsJson = "[]", Signature = "fixture", KeyId = "public", Timestamp = 1 };
    await store.SaveSnapshotAsync(snapshot);
    Check((await Store().GetFeaturesSnapshotAsync())?.SignedDefsJson == "[]", "new provider reads persisted exact bytes");
    Check(await Store("wrong-app").GetFeaturesSnapshotAsync() == null, "wrong app is a cache miss");
    Check(await Store(environment: "Staging").GetFeaturesSnapshotAsync() == null, "wrong environment is a cache miss");
    var file = Directory.GetFiles(root, "definitions.json", SearchOption.AllDirectories).Single();
    var directory = Path.GetDirectoryName(file)!;
    Check(!File.ReadAllText(file).Contains(key), "record omits backend key");
    if (!OperatingSystem.IsWindows())
    {
        Check(File.GetUnixFileMode(file) == (UnixFileMode.UserRead | UnixFileMode.UserWrite), "file permissions are owner only");
        Check(File.GetUnixFileMode(directory) == (UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute), "directory permissions are owner only");
    }
    var writers = Enumerable.Range(0, 16).Select(async i =>
    {
        await Store().SaveSnapshotAsync(new FeatureDefinitionsSnapshot { SignedDefsJson = $"[{i}]" });
        var read = await Store().GetFeaturesSnapshotAsync();
        Check(read?.SignedDefsJson?.StartsWith('[') == true, "concurrent atomic replacement never exposes partial JSON");
    });
    await Task.WhenAll(writers);
    var before = File.ReadAllText(file);
    await store.SaveSnapshotAsync(new FeatureDefinitionsSnapshot { SignedDefsJson = new string('x', 4 * 1024 * 1024) });
    Check(File.ReadAllText(file) == before, "oversize write preserves last complete snapshot");
    using var cancelled = new CancellationTokenSource();
    cancelled.Cancel();
    try { await store.SaveSnapshotAsync(snapshot, cancelled.Token); throw new Exception("cancellation ignored"); }
    catch (OperationCanceledException) { Check(File.ReadAllText(file) == before, "cancelled write preserves last complete snapshot"); }
    Check(Directory.GetFiles(directory, "*.tmp").Length == 0, "failed writes leave no temporary files");
    File.WriteAllText(file, "{malformed");
    Check(await store.GetFeaturesSnapshotAsync() == null, "malformed snapshot fails closed");
    File.WriteAllText(file, new string(' ', 4 * 1024 * 1024 + 1));
    Check(await store.GetFeaturesSnapshotAsync() == null, "oversize read fails closed");
    await store.SaveSnapshotAsync(snapshot);
    await store.SaveJwkSnapshot(new JsonWebKeySet(), 10);
    Check((await Store().GetJwkSnapshotAsync()).Timestamp == 10, "JWKS timestamp round trips without invented expiry policy");
    await store.ClearSnapshotAsync();
    await store.ClearJwkSnapshotAsync();
    Check(await store.GetFeaturesSnapshotAsync() == null && (await store.GetJwkSnapshotAsync()).Jwks == null, "clear removes both records");
    if (!OperatingSystem.IsWindows())
    {
        var target = Path.Combine(root, "target.json");
        File.WriteAllText(target, "sentinel");
        File.CreateSymbolicLink(file, target);
        Check(await store.GetFeaturesSnapshotAsync() == null, "symbolic link read is rejected");
        await store.SaveSnapshotAsync(snapshot);
        Check(File.ReadAllText(target) == "sentinel", "symbolic link write cannot alter its target");
    }
    using var handler = new DenyTogglyTransport();
    using var client = new HttpClient(handler);
    try { await client.GetAsync("https://unreachable.invalid/"); throw new Exception("network denial ignored"); }
    catch (HttpRequestException) { Check(true, "offline handler denies HTTP before transport"); }
}
finally { Directory.Delete(root, recursive: true); }
