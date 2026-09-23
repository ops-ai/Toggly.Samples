using System.Collections.Concurrent;
using System.IO.Compression;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Toggly.FeatureManagement.Client;
#if DESKTOP_HOST
using Toggly.FeatureManagement.Client.Desktop;
#endif

static class Check
{
    public static void True(bool value, string message) { if (!value) throw new Exception(message); }
    public static void Equal<T>(T actual, T expected, string message)
    {
        if (!EqualityComparer<T>.Default.Equals(actual, expected)) throw new Exception($"{message}: expected {expected}, got {actual}");
    }
}

sealed class SignedDefinitions : IDisposable
{
    private readonly ECDsa key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
    public string KeyId { get; }
    public string Jwks { get; }
    public string Envelope { get; }

    public SignedDefinitions()
    {
        var point = key.ExportParameters(false).Q;
        KeyId = Convert.ToHexString(SHA1.HashData(point.X!.Concat(point.Y!).ToArray())) + "ES256";
        Jwks = JsonSerializer.Serialize(new { keys = new[] { new { kty = "EC", crv = "P-256", alg = "ES256", kid = KeyId,
            x = Convert.ToBase64String(point.X!), y = Convert.ToBase64String(point.Y!) } } });
        const string defs = "{\"new-dashboard\":true,\"api-v2\":false,\"Local\":true,\"ExpressCheckout\":{\"requirement\":\"all\",\"rules\":[{\"property\":\"Vip\",\"op\":\"eq\",\"type\":\"boolean\",\"value\":\"true\"}]}}";
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var digest = SHA256.HashData(SHA256.HashData(Encoding.UTF8.GetBytes(defs + "|" + timestamp)));
        var signature = Convert.ToBase64String(key.SignHash(digest, DSASignatureFormat.IeeeP1363FixedFieldConcatenation));
        Envelope = "{\"defs\":" + defs + ",\"timestamp\":" + timestamp + ",\"signature\":\"" + signature + "\",\"kid\":\"" + KeyId + "\"}";
    }
    public void Dispose() => key.Dispose();
}

// The portable host supplies a real verifier; Desktop supplies its published native verifier.
sealed class PortableVerifier : ISignatureVerifier
{
    public ValueTask<bool> VerifyAsync(string definitionsJson, long timestamp, string signature, string keyId, string jwksJson, CancellationToken cancellationToken = default)
    {
        try
        {
            using var doc = JsonDocument.Parse(jwksJson);
            var key = doc.RootElement.GetProperty("keys").EnumerateArray().Single();
            var x = Convert.FromBase64String(key.GetProperty("x").GetString()!);
            var y = Convert.FromBase64String(key.GetProperty("y").GetString()!);
            var expected = Convert.ToHexString(SHA1.HashData(x.Concat(y).ToArray())) + "ES256";
            if (key.GetProperty("kty").GetString() != "EC" || key.GetProperty("crv").GetString() != "P-256"
                || key.GetProperty("alg").GetString() != "ES256" || expected != keyId || key.GetProperty("kid").GetString() != keyId) return ValueTask.FromResult(false);
            using var ecdsa = ECDsa.Create(new ECParameters { Curve = ECCurve.NamedCurves.nistP256, Q = new ECPoint { X = x, Y = y } });
            var digest = SHA256.HashData(SHA256.HashData(Encoding.UTF8.GetBytes(definitionsJson + "|" + timestamp)));
            return ValueTask.FromResult(ecdsa.VerifyHash(digest, Convert.FromBase64String(signature), DSASignatureFormat.IeeeP1363FixedFieldConcatenation));
        }
        catch (Exception) { return ValueTask.FromResult(false); }
    }
}

sealed class DefinitionsHandler(SignedDefinitions fixture) : HttpMessageHandler
{
    public readonly ConcurrentQueue<Uri> Requests = new();
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Enqueue(request.RequestUri!);
        var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(fixture.Envelope) };
        return Task.FromResult(response);
    }
}

sealed record Packet(string Path, string Encoding, string? Origin, string? Authorization, string? Cookie, JsonDocument Body);

sealed class LocalCollector : IAsyncDisposable
{
    private readonly TcpListener listener = new(IPAddress.Loopback, 0);
    private readonly CancellationTokenSource stop = new();
    private readonly Task loop;
    private readonly ConcurrentQueue<int> statuses = new();
    public readonly ConcurrentQueue<Packet> Packets = new();
    public string BaseUrl { get; }
    public bool AbortNext { get; set; }

    public LocalCollector()
    {
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        BaseUrl = $"http://127.0.0.1:{port}/";
        loop = Task.Run(RunAsync);
    }
    public void Respond(params int[] codes) { foreach (var code in codes) statuses.Enqueue(code); }
    private async Task RunAsync()
    {
        while (!stop.IsCancellationRequested)
        {
            TcpClient connection;
            try { connection = await listener.AcceptTcpClientAsync(stop.Token); }
            catch (Exception) when (stop.IsCancellationRequested) { break; }
            using (connection)
            {
            var stream = connection.GetStream();
            var headers = new MemoryStream();
            var recent = 0;
            while (recent != 0x0d0a0d0a)
            {
                var value = stream.ReadByte();
                if (value < 0 || headers.Length > 8192) throw new Exception("Malformed local HTTP request");
                headers.WriteByte((byte)value);
                recent = (recent << 8) | value;
            }
            var lines = Encoding.ASCII.GetString(headers.ToArray()).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
            var path = lines[0].Split(' ')[1];
            var values = lines.Skip(1).Select(line => line.Split(':', 2)).ToDictionary(pair => pair[0], pair => pair[1].Trim(), StringComparer.OrdinalIgnoreCase);
            var length = int.Parse(values["Content-Length"]);
            var raw = new byte[length];
            await stream.ReadExactlyAsync(raw, stop.Token);
            var encoding = values.GetValueOrDefault("Content-Encoding") ?? "plain";
            if (encoding == "gzip")
            {
                using var compressed = new GZipStream(new MemoryStream(raw), CompressionMode.Decompress);
                using var decoded = new MemoryStream();
                await compressed.CopyToAsync(decoded);
                raw = decoded.ToArray();
            }
            Packets.Enqueue(new(path, encoding, values.GetValueOrDefault("Origin"),
                values.GetValueOrDefault("Authorization"), values.GetValueOrDefault("Cookie"), JsonDocument.Parse(raw)));
            if (AbortNext) { AbortNext = false; continue; }
            var status = statuses.TryDequeue(out var code) ? code : 202;
            var response = Encoding.ASCII.GetBytes($"HTTP/1.1 {status} Result\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
            await stream.WriteAsync(response, stop.Token);
            }
        }
    }
    public async Task WaitCountAsync(int count, TimeSpan timeout)
    {
        var deadline = DateTimeOffset.UtcNow + timeout;
        while (Packets.Count < count && DateTimeOffset.UtcNow < deadline) await Task.Delay(25);
        Check.True(Packets.Count >= count, $"Expected {count} HTTP packets, saw {Packets.Count}");
    }
    public async ValueTask DisposeAsync()
    {
        stop.Cancel();
        listener.Stop();
        await loop.WaitAsync(TimeSpan.FromSeconds(2));
        foreach (var packet in Packets) packet.Body.Dispose();
        stop.Dispose();
    }
}

static class Program
{
    private static TogglyClient Create(TogglyClientOptions options, HttpClient http)
    {
#if DESKTOP_HOST
        return DesktopClient.Create(options, http);
#else
        return new TogglyClient(options, http, new PortableVerifier());
#endif
    }
    // Field-presence checks document the published package's observed
    // attribution behavior under approved optional i/u policy.
    // --diagnose-legacy-kefm keeps the superseded exact field set observable.
    private static void PacketFields(Packet packet, string key, string attributionField)
    {
        Check.Equal(packet.Path, "/api/frontend/telemetry", "compact endpoint");
        Check.True(packet.Origin is null && packet.Authorization is null && packet.Cookie is null, "No browser Origin or credentials on native HTTP");
        var body = packet.Body.RootElement;
        Check.Equal(body.GetProperty("k").GetString(), key, "public app key");
        Check.Equal(body.GetProperty("e").GetString(), "Production", "environment");
        Check.True(body.TryGetProperty(attributionField, out _), "observed optional attribution field");
        var fields = body.EnumerateObject().Select(x => x.Name).Order().ToArray();
        Console.WriteLine($"PACKET_FIELDS={string.Join('/', fields)} ENCODING={packet.Encoding}");
    }
    public static async Task Main(string[] args)
    {
        using var fixture = new SignedDefinitions();
        await using var collector = new LocalCollector();
        using var handler = new DefinitionsHandler(fixture);
        using var http = new HttpClient(handler);
        var options = new TogglyClientOptions
        {
            AppKey = "public-client-a", Environment = "Production", BaseUri = new Uri("https://definitions.fixture.invalid/"),
            TrustedJwks = fixture.Jwks, EnableLiveUpdates = false, MetricsBaseUrl = collector.BaseUrl,
            Context = new EvaluationContext("opaque-user-a"),
            LocalGates = new Dictionary<string, Func<bool>> { ["Local"] = () => false },
        };
        await using (var client = Create(options, http))
        {
            await client.InitializeAsync();
            Check.True(client.IsReady, "initialized signed client");
            Check.True(client.IsEnabled("new-dashboard"), "signed direct ON");
            Check.True(!client.IsEnabled("api-v2"), "signed direct OFF");
            Check.True(client.Evaluate(["new-dashboard", "api-v2"], Requirement.Any), "any gate");
            Check.True(!client.Evaluate(["new-dashboard", "api-v2"], Requirement.All), "all gate");
            Check.True(client.Evaluate(["api-v2"], negate: true), "negated gate");
            Check.True(!client.IsEnabled("Local"), "effective local denial");
            var vip = new EntityContext("Order", "vip", new Dictionary<string, object?> { ["Vip"] = true });
            var standard = new EntityContext("Order", "standard", new Dictionary<string, object?> { ["Vip"] = false });
            Check.True(client.IsEnabled("ExpressCheckout", vip), "signed entity match");
            Check.True(!client.IsEnabled("ExpressCheckout", standard), "signed entity miss");
            Check.True(!client.IsEnabled("ExpressCheckout"), "entity missing fails closed");
            var telemetry = (IFrontendTelemetry)client;
            telemetry.RecordUsage("new-dashboard", "preview-a");
            telemetry.RecordView("new-dashboard", "preview-a");
            telemetry.IncrementCounter("orders", 2);
            telemetry.IncrementCounter("orders", 3);
            telemetry.SetGauge("cart", 7);
            telemetry.SetGauge("cart", 9);
            await telemetry.FlushTelemetryAsync();
            await collector.WaitCountAsync(1, TimeSpan.FromSeconds(5));
            var first = collector.Packets.ElementAt(0);
            PacketFields(first, "public-client-a", "u");
            if (args.Contains("--diagnose-legacy-kefm"))
            {
                var actual = first.Body.RootElement.EnumerateObject().Select(field => field.Name).Order().ToArray();
                Check.True(actual.SequenceEqual(new[] { "e", "f", "k", "m" }),
                    $"Superseded k/e/f/m-only diagnostic: observed {string.Join('/', actual)}");
            }
            Check.Equal(first.Encoding, "gzip", "ordinary native flush gzip");
            var features = first.Body.RootElement.GetProperty("f");
            Check.Equal(features.GetProperty("new-dashboard").GetProperty("preview-a")[1].GetInt32(), 1, "explicit usage label");
            Check.Equal(features.GetProperty("new-dashboard").GetProperty("preview-a")[2].GetInt32(), 1, "explicit view label");
            Check.Equal(features.GetProperty("Local").GetProperty("disabled")[0].GetInt32(), 1, "local effective check");
            Check.Equal(first.Body.RootElement.GetProperty("m").GetProperty("orders").GetInt32(), 5, "counter sum");
            Check.Equal(first.Body.RootElement.GetProperty("m").GetProperty("cart").GetInt32(), 9, "latest gauge");

            await ((IFrontendIdentitySession)client).SetIdentityAsync(new EvaluationContext("opaque-user-b"), "minted-instance-b");
            telemetry.RecordUsage("session-b");
            await client.FlushTelemetryAsync(keepalive: true);
            await collector.WaitCountAsync(2, TimeSpan.FromSeconds(5));
            var second = collector.Packets.ElementAt(1);
            PacketFields(second, "public-client-a", "i");
            Check.Equal(second.Encoding, "plain", "native background flush plain");
            Check.True(!second.Body.RootElement.TryGetProperty("u", out _), "minted identity excludes client user");
            Check.True(!second.Body.RootElement.GetProperty("f").TryGetProperty("new-dashboard", out _), "new identity has no old events");
        }

        var before = collector.Packets.Count;
        await using (var other = Create(options with { AppKey = "public-client-b", Context = new EvaluationContext("opaque-user-c") }, http))
        {
            other.RecordUsage("other-client");
            await other.FlushTelemetryAsync();
        }
        await collector.WaitCountAsync(before + 1, TimeSpan.FromSeconds(5));
        PacketFields(collector.Packets.ElementAt(before), "public-client-b", "u");
        Check.True(!collector.Packets.ElementAt(before).Body.RootElement.GetProperty("f").TryGetProperty("session-b", out _), "client isolation");

        before = collector.Packets.Count;
        var definitionsBeforeKeyless = handler.Requests.Count;
        await using (var keyless = Create(options with { AppKey = "" }, http))
        { await keyless.InitializeAsync(); keyless.RecordUsage("silent"); await keyless.FlushTelemetryAsync(); }
        await using (var optout = Create(options with { EnableTelemetry = false }, http))
        { optout.RecordUsage("silent"); await optout.FlushTelemetryAsync(); }
        Check.Equal(collector.Packets.Count, before, "keyless and opt-out silent");
        Check.Equal(handler.Requests.Count, definitionsBeforeKeyless, "keyless initialization made no definition request");

        before = collector.Packets.Count;
        await using (var lifetime = Create(options with { AppKey = "lifetime-client", Context = new EvaluationContext("opaque-exit") }, http))
            lifetime.RecordUsage("on-background-exit");
        await collector.WaitCountAsync(before + 1, TimeSpan.FromSeconds(5));
        var final = collector.Packets.ElementAt(before);
        PacketFields(final, "lifetime-client", "u");
        Check.Equal(final.Encoding, "plain", "native final dispose uses plain JSON");

        if (args.Contains("--retry")) await RetryCases(fixture, collector, http, options);
        Console.WriteLine($"PUBLIC_{(typeof(Program).Assembly.GetName().Name == "Desktop" ? "DESKTOP" : "PORTABLE")}_TELEMETRY_PASS");
    }

    private static async Task RetryCases(SignedDefinitions fixture, LocalCollector collector, HttpClient http, TogglyClientOptions options)
    {
        var before = collector.Packets.Count;
        collector.Respond(429, 503, 202);
        await using (var client = Create(options with { AppKey = "retry-client", Context = new EvaluationContext() }, http))
        {
            client.RecordUsage("retry-only");
            await client.FlushTelemetryAsync().WaitAsync(TimeSpan.FromSeconds(110));
        }
        await collector.WaitCountAsync(before + 3, TimeSpan.FromSeconds(2));
        var attempts = collector.Packets.Skip(before).Take(3).ToArray();
        Check.True(attempts.All(p => p.Body.RootElement.GetProperty("k").GetString() == "retry-client"), "bounded 429/503 retry attribution");
        Check.True(attempts.All(p => p.Body.RootElement.GetProperty("f").GetProperty("retry-only").GetProperty("enabled")[1].GetInt32() == 1), "same aggregate retried");
        before = collector.Packets.Count;
        collector.AbortNext = true;
        await using (var ambiguous = Create(options with { AppKey = "ambiguous-client", Context = new EvaluationContext() }, http))
        {
            ambiguous.RecordUsage("drop-on-ambiguous");
            await ambiguous.FlushTelemetryAsync();
        }
        await Task.Delay(250);
        Check.Equal(collector.Packets.Count, before + 1, "ambiguous transport never replays");
        Console.WriteLine("PUBLIC_PORTABLE_RETRY_AND_AMBIGUOUS_PASS");
    }
}
