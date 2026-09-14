using System.Security.Claims;
using EmbeddedDashboardSample.Models;

namespace EmbeddedDashboardSample.Features;

public sealed record SamplePersona(string Preset, string Name, string Role, string Country, string Language, string Agent, Order Order);

public static class SamplePersonas
{
    public static readonly SamplePersona Matching = new("matching", "alice", "admin", "US", "en-US,en;q=0.9",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        new("ord-vip", true, 249));
    public static readonly SamplePersona NonMatching = new("nonmatching", "bob", "user", "CA", "fr-FR,fr;q=0.9",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        new("ord-standard", false, 49));

    public static SamplePersona Current(HttpContext context) => (SamplePersona)context.Items[typeof(SamplePersona)]!;

    public static async Task Apply(HttpContext context, RequestDelegate next)
    {
        // These controls teach evaluation on workshop requests only. Never synthesize
        // claims or trusted proxy headers for the management dashboard, even locally.
        if (!context.Request.Path.StartsWithSegments("/internal/features"))
        {
            var persona = context.Request.Query["preset"] == "nonmatching" ? NonMatching : Matching;
            if (context.Request.Query["order"] == "standard") persona = persona with { Order = NonMatching.Order };
            if (context.Request.Query["order"] == "vip") persona = persona with { Order = Matching.Order };
            context.Items[typeof(SamplePersona)] = persona;
            // An unauthenticated demo principal supplies Identity.Name and literal
            // "group" claims to the published HTTP targeting accessor. It grants no permission.
            var claims = new List<Claim> { new(ClaimTypes.Name, persona.Name), new("role", persona.Role) };
            if (persona.Preset == "matching") claims.Add(new Claim("group", "beta-testers"));
            context.User = new ClaimsPrincipal(new ClaimsIdentity(claims));
            context.Request.Headers["CF-IPCountry"] = persona.Country;
            context.Request.Headers["Accept-Language"] = persona.Language;
            context.Request.Headers.UserAgent = persona.Agent;
        }
        await next(context);
    }
}
