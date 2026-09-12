using System.Text;
using System.Text.Json;
using Toggly.FeatureManagement.Client;
using Toggly.FeatureManagement.Client.Desktop;
namespace DotnetClientSample;

public sealed class Showcase : IAsyncDisposable
{
    public static readonly string[] Sections=["Home", "Declarative gates", "Programmatic API", "Identity", "Entity context", "Filters matrix", "Host lifecycle"];
    public static readonly string[] Flags=["new-dashboard","api-v2","enhanced-submit","ExpressCheckout","beta-access","filter-always-on","filter-percentage","filter-targeting","filter-user-claims","filter-time-window","filter-country","filter-browser-family","filter-browser-language","filter-device-type","filter-os","filter-context-property"];
    private readonly HttpClient http=new() { Timeout=TimeSpan.FromSeconds(10) };
    public TogglyClient Client { get; }
    public bool Offline { get; }
    public bool Matching { get; private set; }=true;
    public bool LocalPrerequisite { get; set; }=true;
    public string LastError { get; private set; }="None";
    public string Identity => Matching ? "alice" : "bob";
    public EntityContext Order => new("Order",Matching?"ord-vip":"ord-standard",new Dictionary<string,object?>{{"Vip",Matching},{"Total",Matching?250:30}});
    public Showcase()
    {
        var key=Environment.GetEnvironmentVariable("TOGGLY_APP_KEY"); Offline=string.IsNullOrWhiteSpace(key);
        // This is a public frontend key. Worker targeting is rollout input, never authentication.
        // Defaults are explicit offline choices; no synthetic HTTP transport or fabricated signature.
        Client=DesktopClient.Create(new()
        {
            AppKey=key, Environment=Environment.GetEnvironmentVariable("TOGGLY_ENVIRONMENT")??"Production",
            Context=Context(true), Defaults=new Dictionary<string,bool>{{"new-dashboard",true},{"api-v2",false},{"enhanced-submit",true},{"beta-access",false},{"filter-always-on",true}},
            LocalGates=new Dictionary<string,Func<bool>>{{"enhanced-submit",()=>LocalPrerequisite}}
        },http,Environment.GetEnvironmentVariable("TOGGLY_SNAPSHOT_DIRECTORY") is {Length:>0} folder ? folder : null);
        Client.Error+=(_,error)=>LastError=error.Message;
    }
    private static EvaluationContext Context(bool matching)=>new(matching?"alice":"bob",matching?["beta"]:[],new Dictionary<string,string>{{"role",matching?"admin":"user"}});
    public async Task SetPresetAsync(bool matching,CancellationToken ct=default)
    {
        Matching=matching;
        // One client represents this one application session. This is never shared server request state.
        // SetContext clears old targeting data before awaiting the context-specific refetch.
        await Client.SetContextAsync(Context(matching),ct);
    }
    public string Render(string section)
    {
        var output=new StringBuilder();
        if(Offline) output.AppendLine("OFFLINE: TOGGLY_APP_KEY is missing. Showing explicit defaults; no live connection.");
        output.AppendLine($"Ready={Client.IsReady}; identity={Identity}; order={Order.Key}; local prerequisite={LocalPrerequisite}");
        output.AppendLine();
        switch(section)
        {
            case "Home":
                output.AppendLine("Explore the seven sections. In Toggly, toggle new-dashboard and observe the changed snapshot below.");
                foreach(var flag in Flags) output.AppendLine($"{flag}: {Client.IsEnabled(flag,Order)}");
                break;
            case "Declarative gates":
                output.AppendLine(Client.IsEnabled("new-dashboard")?"NEW DASHBOARD: visible":"NEW DASHBOARD: hidden");
                output.AppendLine($"Negated new-dashboard: {Client.Evaluate(["new-dashboard"],negate:true)}");
                output.AppendLine($"All new-dashboard + api-v2: {Client.Evaluate(["new-dashboard","api-v2"])}");
                output.AppendLine($"Any new-dashboard + api-v2: {Client.Evaluate(["new-dashboard","api-v2"],Requirement.Any)}");
                output.AppendLine("Variant assignment: this boolean client does not expose experiments. Do not interpret true/false as a variant.");
                break;
            case "Programmatic API":
                // A programmatic check changes application behavior; the backend must authorize protected actions.
                output.AppendLine(Client.IsEnabled("api-v2")?"Selected API v2 branch":"Selected API v1 fallback branch");
                output.AppendLine($"Submit enabled after device-local prerequisite: {Client.IsEnabled("enhanced-submit")}");
                output.AppendLine($"Unknown flag safely off: {Client.IsEnabled("unknown-feature")}");
                output.AppendLine("Use the prerequisite control to see an AND post-filter disable enhanced-submit.");
                break;
            case "Identity":
                output.AppendLine("Matching: alice, beta group, role=admin. Non-matching: bob, no groups, role=user.");
                output.AppendLine($"beta-access={Client.IsEnabled("beta-access")}; targeting={Client.IsEnabled("filter-targeting")}; user claims={Client.IsEnabled("filter-user-claims")}");
                output.AppendLine("These are demonstration claims supplied by the client. They confer no authorization.");
                break;
            case "Entity context":
                // Entity context belongs to each read: two widgets can evaluate different Orders concurrently.
                output.AppendLine($"Order {Order.Key}, Vip={Matching}: ExpressCheckout={Client.IsEnabled("ExpressCheckout",Order)}");
                output.AppendLine($"Without Order: {Client.IsEnabled("ExpressCheckout")}");
                using(var gate=JsonDocument.Parse("{\"requirement\":\"all\",\"rules\":[{\"property\":\"Vip\",\"op\":\"eq\",\"value\":\"true\",\"type\":\"boolean\"}]}"))
                    output.AppendLine($"Local EntityGate teaching fixture (not downloaded flags): {EntityEvaluator.Resolve(gate.RootElement,Order)}");
                output.AppendLine("The worker returns a signed EntityGate when user-side rules pass; missing entity data fails closed.");
                break;
            case "Filters matrix":
                foreach(var flag in Flags.Where(f=>f.StartsWith("filter-"))) output.AppendLine($"{flag,-25} {Client.IsEnabled(flag,Order),-5} {FilterNote(flag)}");
                output.AppendLine("Matching/Non-matching controls change identity, groups, claims and Order only. Native HTTP has no browser preset headers.");
                break;
            default:
                output.AppendLine("InitializeAsync -> verified signed snapshot -> Changed notifications -> DisposeAsync.");
                output.AppendLine("WebSocket invalidations trigger debounced HTTP refresh; polling continues during reconnects.");
                output.AppendLine("In-memory last-known-good survives errors. File snapshots are reverified against trusted JWKS. Without out-of-band TrustedJwks, cold offline startup uses defaults until JWKS can be fetched.");
                output.AppendLine("The desktop host posts notifications to Avalonia Dispatcher.UIThread. The console consumes them directly.");
                output.AppendLine($"Last error: {LastError}");
                break;
        }
        return output.ToString();
    }
    private static string FilterNote(string flag)=>flag switch
    {
        "filter-targeting" or "filter-user-claims"=>"worker: matching on / non-matching off",
        "filter-context-property"=>"local Order: matching on / non-matching off",
        "filter-percentage"=>"worker: sticky per identity; no fixed expected outcome",
        "filter-always-on"=>"on for both presets",
        "filter-time-window"=>"worker clock: on during configured window",
        _=>"worker request signal; presets cannot override native geography/browser"
    };
    public async ValueTask DisposeAsync() {await Client.DisposeAsync();http.Dispose();}
}
