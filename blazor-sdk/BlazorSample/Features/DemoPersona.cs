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

    public static DemoPersona Current(HttpContext context) =>
        (DemoPersona)context.Items[typeof(DemoPersona)]!;

    public static async Task Apply(HttpContext context, RequestDelegate next)
    {
        var preset =
            context.Request.Query["preset"].FirstOrDefault()
            ?? context.Request.Cookies["sample-preset"];

        var persona = preset switch
        {
            "nonmatching" or "non-matching" => NonMatching,
            "anonymous" => NonMatching with { Name = "", Role = "" },
            _ => Matching,
        };

        if (context.Request.Query["order"] == "standard")
            persona = persona with { Order = NonMatching.Order };
        if (context.Request.Query["order"] == "vip")
            persona = persona with { Order = Matching.Order };

        context.Items[typeof(DemoPersona)] = persona;
        context.Request.Headers["CF-IPCountry"] = persona.Country;
        context.Request.Headers["Accept-Language"] = persona.Language;
        context.Request.Headers.UserAgent = persona.Agent;
        await next(context);
    }
}
