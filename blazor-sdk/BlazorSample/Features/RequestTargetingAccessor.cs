using Microsoft.FeatureManagement.FeatureFilters;
using Toggly.FeatureManagement.Blazor.Server;

namespace BlazorSample.Features;

public sealed class RequestTargetingAccessor(IHttpContextAccessor accessor) : ITargetingContextAccessor
{
    public ValueTask<TargetingContext> GetContextAsync()
    {
        var circuit = BlazorTargetingContext.Current;
        if (!string.IsNullOrEmpty(circuit.Identity))
        {
            return ValueTask.FromResult(
                new TargetingContext
                {
                    UserId = circuit.Identity,
                    Groups = circuit.Groups?.ToList() ?? [],
                }
            );
        }

        if (accessor.HttpContext is not { } http)
            return ValueTask.FromResult(new TargetingContext());

        if (http.Items.TryGetValue(typeof(DemoPersona), out var boxed)
            && boxed is DemoPersona fromItems
            && !string.IsNullOrEmpty(fromItems.Name))
        {
            return ValueTask.FromResult(
                new TargetingContext
                {
                    UserId = fromItems.Name,
                    Groups = fromItems.Role == "admin" ? ["beta-testers"] : [],
                }
            );
        }

        if (DemoPersona.TryFromExplicitPreset(http, out var demo) && !string.IsNullOrEmpty(demo.Name))
        {
            return ValueTask.FromResult(
                new TargetingContext
                {
                    UserId = demo.Name,
                    Groups = demo.Role == "admin" ? ["beta-testers"] : [],
                }
            );
        }

        return ValueTask.FromResult(new TargetingContext());
    }
}
