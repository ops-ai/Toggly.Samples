using System.Runtime.CompilerServices;
using Toggly.FeatureManagement.Client;
using Toggly.FeatureManagement.Client.Desktop;

namespace LiveAcceptance;

/// <summary>Passes through real TLS requests online; denies every HTTP request in cold children.</summary>
internal sealed class ObservedHttp(Evidence evidence, bool offline) : DelegatingHandler(new HttpClientHandler())
{
    public int Blocked
    {
        get; private set;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        if (offline)
        {
            Blocked++;
            throw new HttpRequestException("Acceptance transport is offline.");
        }
        var definitions = request.RequestUri!.AbsolutePath.StartsWith("/evaluated-signed/", StringComparison.Ordinal);
        if (definitions)
            evidence.RecordRequest();
        var response = await base.SendAsync(request, ct);
        if (definitions && response.IsSuccessStatusCode)
            evidence.RecordResponse();
        return response;
    }
}

internal sealed class ObservedVerifier(Evidence evidence) : ISignatureVerifier
{
    private readonly Es256SignatureVerifier verifier = new();

    public async ValueTask<bool> VerifyAsync(string definitionsJson, long timestamp, string signature,
        string keyId, string jwksJson, CancellationToken cancellationToken = default)
    {
        var valid = await verifier.VerifyAsync(definitionsJson, timestamp, signature, keyId, jwksJson, cancellationToken);
        if (valid)
            evidence.RecordVerification();
        return valid;
    }
}

internal sealed class ObservedStore(string directory, Evidence evidence) : ISnapshotStore
{
    private readonly FileSnapshotStore store = new(directory);

    public ValueTask<ClientSnapshot?> LoadAsync(string contextKey, CancellationToken cancellationToken = default) =>
        store.LoadAsync(contextKey, cancellationToken);

    public async ValueTask SaveAsync(string contextKey, ClientSnapshot snapshot, CancellationToken cancellationToken = default)
    {
        await store.SaveAsync(contextKey, snapshot, cancellationToken);
        evidence.RecordSave(snapshot.Envelope, snapshot.Revision);
    }
}

internal sealed class ObservedUpdates(Evidence evidence) : IUpdateSource
{
    private readonly WebSocketUpdates updates = new();

    public async IAsyncEnumerable<string> ListenAsync(Uri uri, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await foreach (var message in updates.ListenAsync(uri, cancellationToken))
        {
            evidence.RecordFrame(message);
            yield return message;
        }
    }
}
