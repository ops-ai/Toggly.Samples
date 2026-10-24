using BlazorSample.Client;

namespace BlazorSample.Features;

public sealed class ServerFilterMatrixMerge(DemoFilterMatrix matrix) : IFilterMatrixMerge
{
    public Task<Dictionary<string, bool>?> EvaluatePresetAsync(
        string preset,
        CancellationToken cancellationToken = default
    ) => matrix.EvaluatePresetAsync(preset);
}
