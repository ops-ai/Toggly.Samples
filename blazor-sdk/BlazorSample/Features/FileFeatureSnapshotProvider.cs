using System.Security.Cryptography;
using System.Text.Json;
using Toggly.FeatureManagement;
using Toggly.FeatureManagement.Data;

namespace BlazorSample.Features;

/// <summary>
/// Single-host storage adapter. The trusted SDK verifies signed definitions;
/// the service account must protect this directory, including its public JWKS.
/// </summary>
public sealed class FileFeatureSnapshotProvider : IFeatureSnapshotProvider
{
    private const int MaximumBytes = 4 * 1024 * 1024;
    private const UnixFileMode OwnerFile = UnixFileMode.UserRead | UnixFileMode.UserWrite;
    private const UnixFileMode OwnerDirectory = OwnerFile | UnixFileMode.UserExecute;
    private readonly string directory;
    private readonly string scope;
    private readonly ILogger<FileFeatureSnapshotProvider> logger;

    public FileFeatureSnapshotProvider(
        string root,
        string appKey,
        string environment,
        ILogger<FileFeatureSnapshotProvider> logger
    )
    {
        if (!Path.IsPathFullyQualified(root) || string.IsNullOrWhiteSpace(appKey))
            throw new ArgumentException("Snapshot storage requires an absolute directory and backend key.");

        // JSON tuple avoids ambiguous concatenation; credentials never become
        // filenames or record fields. Case-sensitive environment is intentional.
        var identity = JsonSerializer.SerializeToUtf8Bytes(new[] { appKey, environment });
        scope = Convert.ToHexString(SHA256.HashData(identity));
        directory = Path.Combine(Path.GetFullPath(root), scope);
        this.logger = logger;
        CheckLinks(directory);
        if (OperatingSystem.IsWindows())
            Directory.CreateDirectory(directory);
        else
        {
            Directory.CreateDirectory(root, OwnerDirectory);
            Directory.CreateDirectory(directory, OwnerDirectory);
            File.SetUnixFileMode(root, OwnerDirectory);
            File.SetUnixFileMode(directory, OwnerDirectory);
        }
    }

    public Task SaveSnapshotAsync(FeatureDefinitionsSnapshot snapshot, CancellationToken ct = default) =>
        Write("definitions.json", snapshot, ct);

    public Task<FeatureDefinitionsSnapshot?> GetFeaturesSnapshotAsync(CancellationToken ct = default) =>
        Read<FeatureDefinitionsSnapshot>("definitions.json", ct);

    public Task ClearSnapshotAsync(CancellationToken ct = default) => Clear("definitions.json", ct);

    public Task SaveJwkSnapshot(JsonWebKeySet jwks, long timestamp, CancellationToken ct = default) =>
        Write("jwks.json", new JwkRecord(jwks, timestamp), ct);

    public async Task<(JsonWebKeySet? Jwks, long? Timestamp)> GetJwkSnapshotAsync(CancellationToken ct = default)
    {
        var value = await Read<JwkRecord>("jwks.json", ct);
        return (value?.Jwks, value?.Timestamp);
    }

    public Task ClearJwkSnapshotAsync(CancellationToken ct = default) => Clear("jwks.json", ct);

    private async Task<T?> Read<T>(string name, CancellationToken ct) where T : class
    {
        try
        {
            var path = Path.Combine(directory, name);
            ct.ThrowIfCancellationRequested();
            CheckLinks(path);
            // Serialized records are nonempty. Check metadata before opening:
            // a stable Unix FIFO has length zero and its open can block before
            // async I/O or cancellation runs. The directory remains trusted.
            var entry = new FileInfo(path);
            if (!entry.Exists || entry.Length <= 0 || entry.Length > MaximumBytes)
                return null;
            await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete, 4096, true);
            if (stream.Length > MaximumBytes)
                return null;
            // Cap the actual read as well as Length, including concurrent growth.
            var bytes = new byte[MaximumBytes + 1];
            var count = 0;
            while (count < bytes.Length)
            {
                var read = await stream.ReadAsync(bytes.AsMemory(count), ct);
                if (read == 0)
                    break;
                count += read;
            }
            if (count > MaximumBytes)
                return null;
            var record = JsonSerializer.Deserialize<Record<T>>(bytes.AsSpan(0, count));
            return record is { Version: 1 } && record.Namespace == scope ? record.Value : null;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or JsonException or NotSupportedException)
        {
            // Paths, definitions and credentials never enter diagnostic output.
            logger.LogWarning("Persisted Toggly snapshot unavailable or invalid.");
            return null;
        }
    }

    private async Task Write<T>(string name, T value, CancellationToken ct)
    {
        var temporary = Path.Combine(directory, $"{Guid.NewGuid():N}.tmp");
        try
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(new Record<T>(1, scope, value));
            if (bytes.Length > MaximumBytes)
                throw new IOException("Snapshot exceeds storage limit.");
            var path = Path.Combine(directory, name);
            CheckLinks(path);
            var options = new FileStreamOptions
            {
                Mode = FileMode.CreateNew,
                Access = FileAccess.Write,
                Share = FileShare.None,
                Options = FileOptions.Asynchronous | FileOptions.WriteThrough,
            };
            if (!OperatingSystem.IsWindows())
                options.UnixCreateMode = OwnerFile;
            await using (var stream = new FileStream(temporary, options))
            {
                await stream.WriteAsync(bytes, ct);
                await stream.FlushAsync(ct);
            }
            ct.ThrowIfCancellationRequested();
            CheckLinks(path);
            File.Move(temporary, path, overwrite: true);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or JsonException or NotSupportedException)
        {
            logger.LogWarning("Toggly snapshot could not be persisted.");
        }
        finally
        {
            try
            {
                File.Delete(temporary);
            }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            {
                logger.LogWarning("Toggly temporary snapshot cleanup failed.");
            }
        }
    }

    private Task Clear(string name, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var path = Path.Combine(directory, name);
        CheckLinks(path);
        File.Delete(path);
        return Task.CompletedTask;
    }

    private static void CheckLinks(string path)
    {
        for (var current = path; !string.IsNullOrEmpty(current); current = Path.GetDirectoryName(current))
            if ((File.Exists(current) || Directory.Exists(current)) && (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0)
                throw new IOException("Snapshot storage cannot use symbolic links.");
    }

    private sealed record Record<T>(int Version, string Namespace, T Value);
    private sealed record JwkRecord(JsonWebKeySet Jwks, long Timestamp);
}

/// <summary>Explicit offline mode never supplies fixture definitions.</summary>
public sealed class DenyTogglyTransport : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        return Task.FromException<HttpResponseMessage>(new HttpRequestException("Toggly network access is disabled."));
    }
}
