using System.Security.Claims;

namespace BlazorSample.Features;

public sealed record DemoOrder(string Id, bool Vip, decimal Total);

public sealed record DemoPersona(
    string Name,
    string Role,
    string Country,
    string Language,
    string Agent,
    DemoOrder Order
)
{
    public static readonly DemoPersona Matching = new(
        "alice",
        "admin",
        "US",
        "en-US,en;q=0.9",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        new DemoOrder("ord-vip", true, 249)
    );

    public static readonly DemoPersona NonMatching = new(
        "bob",
        "user",
        "CA",
        "fr-FR,fr;q=0.9",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        new DemoOrder("ord-standard", false, 49)
    );

    private static readonly DemoPersona Anonymous = new(
        "",
        "",
        "",
        "",
        "",
        NonMatching.Order
    );

    public static (DemoPersona Persona, bool ApplyDemoHeaders) FromPreset(string? preset) =>
        preset switch
        {
            "matching" => (Matching, true),
            "nonmatching" or "non-matching" => (NonMatching, true),
            "anonymous" => (Anonymous, false),
            _ => (Anonymous, false),
        };

    public static bool TryFromExplicitPreset(HttpContext context, out DemoPersona persona)
    {
        var preset =
            context.Request.Query["preset"].FirstOrDefault()
            ?? context.Request.Cookies["sample-preset"];
        if (string.IsNullOrWhiteSpace(preset))
        {
            persona = Anonymous;
            return false;
        }

        (persona, _) = FromPreset(preset);
        if (context.Request.Query["order"] == "standard")
            persona = persona with { Order = NonMatching.Order };
        if (context.Request.Query["order"] == "vip")
            persona = persona with { Order = Matching.Order };
        return true;
    }

    public static void ApplyFromRequestIfPresent(HttpContext context)
    {
        var preset =
            context.Request.Query["preset"].FirstOrDefault()
            ?? context.Request.Cookies["sample-preset"];
        if (string.IsNullOrWhiteSpace(preset))
            return;

        var (persona, applyHeaders) = FromPreset(preset);
        if (context.Request.Query["order"] == "standard")
            persona = persona with { Order = NonMatching.Order };
        if (context.Request.Query["order"] == "vip")
            persona = persona with { Order = Matching.Order };
        ApplyRequestHeaders(context, persona, applyHeaders);
    }

    public static void ApplyRequestHeaders(HttpContext context, DemoPersona persona, bool applyDemoHeaders)
    {
        if (applyDemoHeaders)
        {
            context.Request.Headers["CF-IPCountry"] = persona.Country;
            context.Request.Headers["Accept-Language"] = persona.Language;
            context.Request.Headers.UserAgent = persona.Agent;
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, persona.Name),
            new("role", persona.Role),
        };
        context.User = new ClaimsPrincipal(
            new ClaimsIdentity(claims, persona.Name.Length == 0 ? null : "Demo persona")
        );
        context.Items[typeof(DemoPersona)] = persona;
    }
}
