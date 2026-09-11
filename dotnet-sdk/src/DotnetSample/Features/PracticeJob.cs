namespace DotnetSample.Features;

// A harmless, executable job: real Hangfire runs it in this sample process.
// In-memory storage resets on restart; use durable storage in a deployed app.
public sealed class PracticeJob(ILogger<PracticeJob> logger)
{
    public Task RunAsync()
    {
        logger.LogInformation("Feature-gated recurring sample job ran at {Time}", DateTimeOffset.UtcNow);
        return Task.CompletedTask;
    }
}
