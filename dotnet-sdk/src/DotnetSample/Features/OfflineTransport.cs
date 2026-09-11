using System.Net;
using System.Net.Http.Json;

namespace DotnetSample.Features;

// Registered only in explicitly labelled offline practice. It blocks ALL
// HttpClient network traffic (including usage/metrics), while definition requests
// still pass through TogglyFeatureProvider and the actual package's parser.
public sealed class OfflineTransport(OfflineDefinitions definitions) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        return Task.FromResult(request.RequestUri!.AbsolutePath.StartsWith("/definitions/", StringComparison.Ordinal)
            ? new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(definitions.Create()) }
            : new HttpResponseMessage(HttpStatusCode.NoContent));
    }
}

public sealed record SampleMode(bool Offline);
