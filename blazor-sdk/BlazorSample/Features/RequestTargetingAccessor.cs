using Microsoft.FeatureManagement.FeatureFilters;

namespace BlazorSample.Features;

public sealed class RequestTargetingAccessor(IHttpContextAccessor accessor) : ITargetingContextAccessor
{
    public ValueTask<TargetingContext> GetContextAsync()
    {
        if (accessor.HttpContext?.Items.TryGetValue(typeof(DemoPersona), out var persona) == true
            && persona is DemoPersona demo)
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
