using Avalonia;

namespace DotnetClientSample;

internal static class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        App.SmokeRequested = args.Contains("--smoke");
        AppBuilder
            .Configure<App>()
            .UsePlatformDetect()
            .LogToTrace()
            .StartWithClassicDesktopLifetime(args);
    }
}
