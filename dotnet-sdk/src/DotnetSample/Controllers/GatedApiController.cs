using DotnetSample.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.FeatureManagement;
using Microsoft.FeatureManagement.Mvc;

namespace DotnetSample.Controllers;

[ApiController]
[Route("api")]
public sealed class GatedApiController(IFeatureManagerSnapshot features) : ControllerBase
{
    // Hiding a link is only presentation. FeatureGate enforces the flag even
    // when somebody calls this URL directly; the default disabled result is 404.
    [HttpGet("beta")]
    [FeatureGate(FeatureFlags.Beta)]
    public IActionResult Beta() => Ok(new { message = "Beta endpoint enabled" });

    [HttpGet("multi")]
    [FeatureGate(RequirementType.All, FeatureFlags.Dashboard, FeatureFlags.Api)]
    public IActionResult Multi() => Ok(new { message = "Both features enabled" });

    [HttpGet("data")]
    public async Task<IActionResult> Data()
    {
        // Snapshot memoizes this Boolean check inside THIS request. Use the
        // non-snapshot IFeatureManager for different Order instances on a page.
        var enabled = await features.IsEnabledAsync(FeatureFlags.Api);
        return Ok(new { version = enabled ? 2 : 1, enabled });
    }
}
