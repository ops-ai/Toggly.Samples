using Microsoft.FeatureManagement.FeatureFilters;

namespace BlazorSample.Features;

public sealed class RequestTargetingAccessor(IHttpContextAccessor accessor) : ITargetingContextAccessor
{
    public ValueTask<TargetingContext> GetContextAsync()
    {
        if (accessor.HttpContext is not null
            && DemoPersona.TryFromExplicitPreset(accessor.HttpContext, out var demo)
            && !string.IsNullOrEmpty(demo.Name))
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
