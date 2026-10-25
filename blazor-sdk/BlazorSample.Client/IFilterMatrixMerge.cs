namespace BlazorSample.Client;

/// <summary>
/// Server-only in-process filter matrix evaluation for SSR prerender (same path as
/// <c>/api/demo-filter-matrix</c>, without loopback HTTP).
/// </summary>
public interface IFilterMatrixMerge
{
    Task<Dictionary<string, bool>?> EvaluatePresetAsync(
        string preset,
        CancellationToken cancellationToken = default
    );
}
