using System.Net;
using System.Net.Http.Json;
using Toggly.FeatureManagement.Data;

namespace BlazorSample.Features;

public sealed class OfflineTransport : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken token
    )
    {
        token.ThrowIfCancellationRequested();
        return Task.FromResult(
            request.RequestUri!.AbsolutePath.StartsWith("/definitions/", StringComparison.Ordinal)
                ? new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = JsonContent.Create(Definitions()),
                }
                : new HttpResponseMessage(HttpStatusCode.NoContent)
        );
    }

    public static List<FeatureDefinitionModel> Definitions()
    {
        FeatureDefinitionModel Flag(
            string key,
            string filter = "AlwaysOn",
            params (string, string)[] parameters
        ) =>
            new()
            {
                FeatureKey = key,
                Filters =
                [
                    new()
                    {
                        Name = filter,
                        Parameters = parameters.ToDictionary(p => p.Item1, p => p.Item2),
                    },
                ],
            };
        FeatureDefinitionModel Order(string key)
        {
            var value = Flag(
                key,
                "ContextProperty",
                ("Property", "Vip"),
                ("Operator", "eq"),
                ("Value", "true"),
                ("ValueType", "boolean")
            );
            value.ContextKind = "Order";
            return value;
        }
        return
        [
            Flag("new-dashboard"),
            Flag("api-v2"),
            Flag("enhanced-submit"),
            Flag("beta-access"),
            Order("ExpressCheckout"),
            Order("filter-context-property"),
            Flag("filter-always-on"),
            Flag("filter-percentage", "Microsoft.Percentage", ("Value", "50")),
            Flag(
                "filter-targeting",
                "Microsoft.Targeting",
                ("Audience:Users:0", "alice"),
                ("Audience:DefaultRolloutPercentage", "0")
            ),
            Flag(
                "filter-time-window",
                "Microsoft.TimeWindow",
                ("Start", "2020-01-01T00:00:00Z"),
                ("End", "2099-12-31T23:59:59Z")
            ),
        ];
    }
}
