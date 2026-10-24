namespace BlazorSample.Client;

/// <summary>WebAssembly host has no HTTP request persona pipeline.</summary>
public sealed class NullFilterMatrixMerge : IFilterMatrixMerge
{
    public Task<Dictionary<string, bool>?> EvaluatePresetAsync(
        string preset,
        CancellationToken cancellationToken = default
    ) => Task.FromResult<Dictionary<string, bool>?>(null);
}
