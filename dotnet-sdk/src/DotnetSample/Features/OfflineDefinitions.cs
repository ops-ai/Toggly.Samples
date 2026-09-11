using System.Text.Json;
using Toggly.FeatureManagement.Data;

namespace DotnetSample.Features;

// This is sample data in Toggly's published definitions schema, not a replacement
// evaluator. The real NuGet provider deserializes it and runs its native filters.
// Live apps receive equivalent definitions from their Toggly environment.
public sealed class OfflineDefinitions(IConfiguration configuration)
{
    public List<FeatureDefinitionModel> Create()
    {
        FeatureDefinitionModel Flag(string key, string filter = "AlwaysOn", params (string, string)[] parameters) => new()
        {
            FeatureKey = key,
            Filters = [new() { Name = filter, Parameters = parameters.ToDictionary(p => p.Item1, p => p.Item2) }]
        };
        FeatureDefinitionModel Entity(string key)
        {
            var flag = Flag(key, "ContextProperty", ("Property", "Vip"), ("Operator", "eq"), ("Value", "true"), ("ValueType", "boolean"));
            flag.ContextKind = "Order";
            return flag;
        }
        var dashboard = Flag(FeatureFlags.Dashboard);
        if (!configuration.GetValue("Sample:DashboardEnabled", true)) dashboard.Filters.Clear();
        // Named variants are different from a Boolean gate. The same flag carries
        // an optional configuration; Alice gets preview, everyone else classic.
        dashboard.Variants = [new() { Name = "classic", ConfigurationValue = JsonSerializer.SerializeToElement(new { title = "Classic dashboard" }) },
            new() { Name = "preview", ConfigurationValue = JsonSerializer.SerializeToElement(new { title = "Preview dashboard" }) }];
        dashboard.Allocation = new() { DefaultWhenEnabled = "classic", DefaultWhenDisabled = "classic",
            User = [new() { Variant = "preview", Users = ["alice"] }] };
        return [dashboard, configuration.GetValue("Sample:ApiEnabled", true) ? Flag(FeatureFlags.Api) : new() { FeatureKey = FeatureFlags.Api },
            configuration.GetValue("Sample:SubmitEnabled", true) ? Flag(FeatureFlags.Submit) : new() { FeatureKey = FeatureFlags.Submit }, Entity(FeatureFlags.Express),
            // Keep beta-access a baseline environment toggle, as in FLAG_TEMPLATE.
            // Denial tests start a separate host with this fixture toggle disabled.
            configuration.GetValue("Sample:BetaEnabled", true) ? Flag(FeatureFlags.Beta) : new() { FeatureKey = FeatureFlags.Beta },
            Flag("filter-always-on"), Flag("filter-percentage", "Microsoft.Percentage", ("Value", "50")),
            Flag("filter-targeting", "Microsoft.Targeting", ("Audience:Users:0", "alice"), ("Audience:DefaultRolloutPercentage", "0")),
            Flag("filter-user-claims", "UserClaims", ("Claim", "role"), ("Value", "admin"), ("Percentage", "100")),
            Flag("filter-time-window", "Microsoft.TimeWindow", ("Start", "2020-01-01T00:00:00Z"), ("End", "2099-12-31T23:59:59Z")),
            // CountryFamily and OS are the published .NET filter aliases.
            Flag("filter-country", "CountryFamily", ("Country:0", "US"), ("Percentage", "100")),
            Flag("filter-browser-family", "BrowserFamily", ("BrowserFamily:0", "Chrome"), ("Percentage", "100")),
            Flag("filter-browser-language", "BrowserLanguage", ("BrowserLanguage:0", "en"), ("Percentage", "100")),
            Flag("filter-device-type", "DeviceType", ("DeviceType:0", "Macintosh"), ("Percentage", "100")),
            Flag("filter-os", "OS", ("OperatingSystem:0", "Mac"), ("Percentage", "100")), Entity("filter-context-property")];
    }
}
