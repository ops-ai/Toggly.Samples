using System.Security.Claims;
using DotnetSample.Models;
using Microsoft.FeatureManagement.FeatureFilters;

namespace DotnetSample.Features;

public sealed record SamplePersona(string Name, string Role, string Country, string Language, string Agent, Order Order)
{
    public TargetingContext Targeting => new() { UserId = Name, Groups = Role == "admin" ? ["beta-testers"] : [] };
}

public static class SamplePersonas
{
    public static readonly SamplePersona Matching = new("alice", "admin", "US", "en-US,en;q=0.9",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        new("ord-vip", true, 249));
    public static readonly SamplePersona NonMatching = new("bob", "user", "CA", "fr-FR,fr;q=0.9",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        new("ord-standard", false, 49));

    public static SamplePersona Current(HttpContext context) => (SamplePersona)context.Items[typeof(SamplePersona)]!;

    public static async Task Apply(HttpContext context, RequestDelegate next)
    {
        // Query controls deliberately simulate a principal and proxy/browser headers.
        // They teach targeting; they are NOT authentication. Never copy this demo
        // middleware into a protected app: use validated authentication/proxy data.
        var preset = context.Request.Query["preset"].FirstOrDefault()
            ?? context.Request.Cookies["sample-preset"] ?? "anonymous";
        var persona = preset == "nonmatching" ? NonMatching : Matching;
        if (preset == "anonymous") persona = NonMatching with { Name = "", Role = "" };
        if (context.Request.Query["order"] == "standard") persona = persona with { Order = NonMatching.Order };
        if (context.Request.Query["order"] == "vip") persona = persona with { Order = Matching.Order };
        context.Items[typeof(SamplePersona)] = persona;
        var claims = new List<Claim> { new(ClaimTypes.Name, persona.Name), new("role", persona.Role) };
        foreach (var group in persona.Targeting.Groups) claims.Add(new Claim("group", group));
        context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, persona.Name.Length == 0 ? null : "Sample persona"));
        context.Request.Headers["CF-IPCountry"] = persona.Country;
        context.Request.Headers["Accept-Language"] = persona.Language;
        context.Request.Headers.UserAgent = persona.Agent;
        // Context exists BEFORE MVC, Razor, OpenAPI or the first flag check runs.
        await next(context);
    }
}

// This singleton accessor stores no user state. IHttpContextAccessor uses the
// current asynchronous request context, so simultaneous Alice/Bob requests cannot
// overwrite each other. An anonymous background operation gets an empty context.
public sealed class RequestTargetingAccessor(IHttpContextAccessor accessor) : ITargetingContextAccessor
{
    public ValueTask<TargetingContext> GetContextAsync() => new(
        accessor.HttpContext is { } http && http.Items.TryGetValue(typeof(SamplePersona), out var persona)
            ? ((SamplePersona)persona!).Targeting : new TargetingContext());
}
