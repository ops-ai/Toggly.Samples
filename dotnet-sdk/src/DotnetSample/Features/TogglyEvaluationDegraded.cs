namespace DotnetSample.Features;

internal static class TogglyEvaluationDegraded
{
    public const string HttpContextItemKey = "TogglyEvaluationDegraded";
    public const string ResponseHeaderName = "X-Toggly-Sample-Degraded";
    public const string ResponseHeaderValue = "evaluation-failed";

    public static bool IsDegraded(HttpContext? context) =>
        context?.Items[HttpContextItemKey] is true;

    public static void MarkDegraded(HttpContext? context, Exception exception, ILogger logger)
    {
        if (context is null)
            return;

        if (context.Items[HttpContextItemKey] is true)
            return;

        context.Items[HttpContextItemKey] = true;
        logger.LogError(exception, "Toggly feature evaluation failed; continuing with defaults OFF for this request");
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[ResponseHeaderName] = ResponseHeaderValue;
            return Task.CompletedTask;
        });
    }
}
