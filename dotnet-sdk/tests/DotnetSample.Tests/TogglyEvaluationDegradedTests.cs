using DotnetSample.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Xunit;

namespace DotnetSample.Tests;

public class TogglyEvaluationDegradedTests
{
    [Fact]
    public void MarkDegraded_logs_when_http_context_is_missing()
    {
        var logger = new ListLogger();
        var exception = new InvalidOperationException("background evaluation failure");

        TogglyEvaluationDegraded.MarkDegraded(null, exception, logger);

        var entry = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Error, entry.Level);
        Assert.Same(exception, entry.Exception);
        Assert.Contains("outside an HTTP request", entry.Message);
    }

    [Fact]
    public void MarkDegraded_sets_request_flag_only_when_http_context_exists()
    {
        var logger = new ListLogger();
        var context = new DefaultHttpContext();
        var exception = new InvalidOperationException("request evaluation failure");

        TogglyEvaluationDegraded.MarkDegraded(context, exception, logger);

        Assert.True(TogglyEvaluationDegraded.IsDegraded(context));
        var entry = Assert.Single(logger.Entries);
        Assert.Contains("for this request", entry.Message);
    }

    private sealed class ListLogger : ILogger
    {
        public List<(LogLevel Level, Exception? Exception, string Message)> Entries { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) =>
            Entries.Add((logLevel, exception, formatter(state, exception)));
    }
}
