using Microsoft.FeatureManagement;
using Microsoft.FeatureManagement.FeatureFilters;

namespace DotnetSample.Features;

internal static class ResilientTogglyFeatureEvaluationExtensions
{
    public static IServiceCollection AddResilientTogglyFeatureEvaluation(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        Decorate<IFeatureManager, ResilientFeatureManager>(services);
        Decorate<IVariantFeatureManager, ResilientVariantFeatureManager>(services);
        Decorate<IFeatureManagerSnapshot, ResilientFeatureManagerSnapshot>(services);
        return services;
    }

    private static void Decorate<TService, TDecorator>(IServiceCollection services)
        where TService : class
        where TDecorator : class, TService
    {
        var index = -1;
        for (var i = 0; i < services.Count; i++)
        {
            if (services[i].ServiceType == typeof(TService))
            {
                index = i;
                break;
            }
        }

        if (index < 0)
            return;

        var existing = services[index];
        services.RemoveAt(index);
        services.Insert(index, ServiceDescriptor.Describe(typeof(TService), sp =>
        {
            TService inner = existing.ImplementationFactory is not null
                ? (TService)existing.ImplementationFactory(sp)
                : existing.ImplementationInstance is not null
                    ? (TService)existing.ImplementationInstance
                    : (TService)ActivatorUtilities.CreateInstance(sp, existing.ImplementationType!);

            return ActivatorUtilities.CreateInstance<TDecorator>(sp, inner);
        }, existing.Lifetime));
    }
}

internal sealed class ResilientFeatureManager(
    IFeatureManager inner, IHttpContextAccessor httpContext, ILogger<ResilientFeatureManager> logger) : IFeatureManager
{
    public IAsyncEnumerable<string> GetFeatureNamesAsync() => inner.GetFeatureNamesAsync();

    public Task<bool> IsEnabledAsync(string feature) => Evaluate(() => inner.IsEnabledAsync(feature));

    public Task<bool> IsEnabledAsync<TContext>(string feature, TContext context) =>
        Evaluate(() => inner.IsEnabledAsync(feature, context));

    private async Task<bool> Evaluate(Func<Task<bool>> evaluate)
    {
        try
        {
            return await evaluate();
        }
        catch (Exception ex)
        {
            TogglyEvaluationDegraded.MarkDegraded(httpContext.HttpContext, ex, logger);
            return false;
        }
    }
}

internal sealed class ResilientVariantFeatureManager(
    IVariantFeatureManager inner, IHttpContextAccessor httpContext, ILogger<ResilientVariantFeatureManager> logger)
    : IVariantFeatureManager
{
    public IAsyncEnumerable<string> GetFeatureNamesAsync(CancellationToken cancellationToken = default) =>
        inner.GetFeatureNamesAsync(cancellationToken);

    public ValueTask<bool> IsEnabledAsync(string feature, CancellationToken cancellationToken = default) =>
        Evaluate(() => inner.IsEnabledAsync(feature, cancellationToken).AsTask());

    public ValueTask<bool> IsEnabledAsync<TContext>(string feature, TContext context,
        CancellationToken cancellationToken = default) =>
        Evaluate(() => inner.IsEnabledAsync(feature, context, cancellationToken).AsTask());

    public ValueTask<Variant> GetVariantAsync(string feature, CancellationToken cancellationToken = default) =>
        EvaluateVariant(() => inner.GetVariantAsync(feature, cancellationToken).AsTask());

    public ValueTask<Variant> GetVariantAsync(string feature, ITargetingContext context,
        CancellationToken cancellationToken = default) =>
        EvaluateVariant(() => inner.GetVariantAsync(feature, context, cancellationToken).AsTask());

    private async ValueTask<bool> Evaluate(Func<Task<bool>> evaluate)
    {
        try
        {
            return await evaluate();
        }
        catch (Exception ex)
        {
            TogglyEvaluationDegraded.MarkDegraded(httpContext.HttpContext, ex, logger);
            return false;
        }
    }

    private async ValueTask<Variant> EvaluateVariant(Func<Task<Variant>> evaluate)
    {
        try
        {
            return await evaluate();
        }
        catch (Exception ex)
        {
            TogglyEvaluationDegraded.MarkDegraded(httpContext.HttpContext, ex, logger);
            return default!;
        }
    }
}

internal sealed class ResilientFeatureManagerSnapshot(
    IFeatureManagerSnapshot inner, IHttpContextAccessor httpContext, ILogger<ResilientFeatureManagerSnapshot> logger)
    : IFeatureManagerSnapshot
{
    public IAsyncEnumerable<string> GetFeatureNamesAsync() => inner.GetFeatureNamesAsync();

    public Task<bool> IsEnabledAsync(string feature) => Evaluate(() => inner.IsEnabledAsync(feature));

    public Task<bool> IsEnabledAsync<TContext>(string feature, TContext context) =>
        Evaluate(() => inner.IsEnabledAsync(feature, context));

    private async Task<bool> Evaluate(Func<Task<bool>> evaluate)
    {
        try
        {
            return await evaluate();
        }
        catch (Exception ex)
        {
            TogglyEvaluationDegraded.MarkDegraded(httpContext.HttpContext, ex, logger);
            return false;
        }
    }
}
