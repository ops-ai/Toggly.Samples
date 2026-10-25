using Microsoft.FeatureManagement.FeatureFilters;
using Toggly.FeatureManagement.Blazor.Server;

namespace BlazorSample.Features;

/// <summary>
/// Interactive Server circuits expose identity via <see cref="BlazorTargetingContext"/>.
/// HTTP SSR and signed snapshot hosts use <see cref="RequestTargetingAccessor"/>.
/// </summary>
public sealed class CircuitAndRequestTargetingAccessor(
    BlazorTargetingContext blazor,
    IHttpContextAccessor http
) : ITargetingContextAccessor
{
    public async ValueTask<TargetingContext> GetContextAsync()
    {
        var circuit = await blazor.GetContextAsync();
        if (!string.IsNullOrEmpty(circuit.UserId))
            return circuit;

        return await new RequestTargetingAccessor(http).GetContextAsync();
    }
}
