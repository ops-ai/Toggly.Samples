using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace LiveAcceptance;

internal sealed record SavedState(long Sequence, string Hash, string? Revision, string Kid, long Timestamp, bool Value);

/// <summary>Records ordering, not elapsed-time guesses, for a pushed signed update.</summary>
internal sealed class Evidence
{
    private readonly object gate = new();
    private long sequence;
    private long lastFrame;
    private long lastRequest;
    private int saves;
    private int verifications;
    private int responses;
    private SavedState? lastSave;

    public long Sequence
    {
        get
        {
            lock (gate)
                return sequence;
        }
    }

    public int Saves
    {
        get
        {
            lock (gate)
                return saves;
        }
    }

    public int Verifications
    {
        get
        {
            lock (gate)
                return verifications;
        }
    }

    public int DefinitionResponses
    {
        get
        {
            lock (gate)
                return responses;
        }
    }

    public SavedState? LastSave
    {
        get
        {
            lock (gate)
                return lastSave;
        }
    }

    public void RecordFrame(string message)
    {
        var invalidates = message is "update" or "flags-updated";
        try
        {
            if (!invalidates)
            {
                using var document = JsonDocument.Parse(message);
                invalidates = document.RootElement.TryGetProperty("type", out var type)
                    && type.GetString() is "update" or "flags-updated";
            }
        }
        catch (JsonException) { /* Unrelated WebSocket traffic is not acceptance evidence. */ }
        if (invalidates)
        {
            lock (gate)
                lastFrame = ++sequence;
        }
    }

    public void RecordRequest()
    {
        lock (gate)
            lastRequest = ++sequence;
    }

    public void RecordResponse()
    {
        lock (gate)
        {
            responses++;
            sequence++;
        }
    }

    public void RecordVerification()
    {
        lock (gate)
        {
            verifications++;
            sequence++;
        }
    }

    public void RecordSave(string envelope, string? revision)
    {
        using var document = JsonDocument.Parse(envelope);
        var root = document.RootElement;
        var value = root.GetProperty("defs").GetProperty("new-dashboard").GetBoolean();
        lock (gate)
        {
            saves++;
            lastSave = new(++sequence, Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(envelope))),
                revision, root.GetProperty("kid").GetString()!, root.GetProperty("timestamp").GetInt64(), value);
        }
    }

    public bool IsPushApplied(long marker, SavedState previous, bool expected)
    {
        lock (gate)
        {
            return lastSave is { } saved && lastFrame > marker && lastRequest > lastFrame
                && saved.Sequence > lastRequest && saved.Hash != previous.Hash
                && !string.IsNullOrWhiteSpace(saved.Revision) && saved.Revision != previous.Revision
                && saved.Value == expected;
        }
    }

    public static void Require(bool condition, string code)
    {
        if (!condition)
            throw new AcceptanceException(code);
    }

    public static void Log(string name, object? data = null) =>
        Console.WriteLine(JsonSerializer.Serialize(new
        {
            @event = name,
            data
        }));
}

internal sealed class AcceptanceException(string code) : Exception
{
    public string Code { get; } = code;
}
