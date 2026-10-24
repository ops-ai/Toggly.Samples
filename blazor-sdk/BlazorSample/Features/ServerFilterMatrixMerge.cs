using BlazorSample.Client;

namespace BlazorSample.Features;

public sealed class ServerFilterMatrixMerge(DemoFilterMatrix matrix) : IFilterMatrixMerge
{
    public async Task<Dictionary<string, bool>?> EvaluatePresetAsync(
        string preset,
        CancellationToken cancellationToken = default
    ) => await matrix.EvaluatePresetAsync(preset);
}
