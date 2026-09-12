using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Layout;
using Avalonia.Themes.Fluent;
using Avalonia.Threading;

namespace DotnetClientSample;

public sealed class App : Application
{
    internal static bool SmokeRequested;

    public override void Initialize() => Styles.Add(new FluentTheme());

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.MainWindow = new ShowcaseWindow();
        }

        base.OnFrameworkInitializationCompleted();
    }
}

internal sealed class ShowcaseWindow : Window
{
    private readonly Showcase showcase = new();
    private readonly CancellationTokenSource lifetime = new();
    private readonly Dictionary<string, TextBlock> displays = [];
    private readonly Border gatedPanel = new()
    {
        Child = new TextBlock { Text = "New dashboard panel", FontSize = 24 },
        Padding = new Thickness(16),
    };
    private bool closing;

    public ShowcaseWindow()
    {
        Title = "Toggly .NET Client SDK Sample";
        Width = 1060;
        Height = 780;
        var controls = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12 };
        foreach (
            var (label, action) in new (string, Func<Task>)[]
            {
                ("Matching", () => showcase.SetPresetAsync(true, lifetime.Token)),
                ("Non-matching", () => showcase.SetPresetAsync(false, lifetime.Token)),
                ("Refresh", () => showcase.Client.RefreshAsync(lifetime.Token)),
                (
                    "Toggle local prerequisite",
                    () =>
                    {
                        showcase.LocalPrerequisite = !showcase.LocalPrerequisite;
                        return Task.CompletedTask;
                    }
                ),
            }
        )
        {
            var button = new Button { Content = label };
            button.Click += async (_, _) =>
            {
                try
                {
                    await action();
                    Update();
                }
                catch (OperationCanceledException)
                {
                    // Closing the host cancels pending UI work.
                }
            };
            controls.Children.Add(button);
        }

        var tabs = new TabControl();
        var items = new List<TabItem>();
        foreach (var section in Showcase.Sections)
        {
            var text = new TextBlock
            {
                TextWrapping = Avalonia.Media.TextWrapping.Wrap,
                FontFamily = "monospace",
            };
            displays[section] = text;
            var panel = new StackPanel { Spacing = 12 };
            if (section == "Declarative gates")
            {
                panel.Children.Add(gatedPanel);
            }
            panel.Children.Add(text);
            items.Add(
                new TabItem
                {
                    Header = section,
                    Content = new ScrollViewer { Content = panel, Padding = new Thickness(12) },
                }
            );
        }
        tabs.ItemsSource = items;
        var layout = new DockPanel { Margin = new Thickness(16) };
        DockPanel.SetDock(controls, Dock.Top);
        layout.Children.Add(controls);
        layout.Children.Add(tabs);
        Content = layout;
        // SDK events can run on I/O threads; Avalonia controls must be changed on the UI thread.
        showcase.Client.Changed += (_, _) => Dispatcher.UIThread.Post(Update);
        showcase.Client.Error += (_, _) => Dispatcher.UIThread.Post(Update);
        Opened += async (_, _) =>
        {
            try
            {
                await showcase.Client.InitializeAsync(lifetime.Token);
                Update();
                if (App.SmokeRequested)
                {
                    if (!showcase.Client.IsReady || displays.Count != 7)
                    {
                        throw new InvalidOperationException("Desktop startup failed");
                    }

                    await showcase.SetPresetAsync(false, lifetime.Token);
                    Update();
                    Console.WriteLine(
                        "Avalonia native window initialized, seven sections rendered and context changed on UI thread."
                    );
                    // Let Avalonia finish its startup callback before requesting shutdown.
                    Dispatcher.UIThread.Post(Close, DispatcherPriority.Background);
                }
            }
            catch (OperationCanceledException)
            {
                // Closing the host cancels pending UI work.
            }
        };
        Closing += async (_, e) =>
        {
            if (closing)
            {
                return;
            }
            e.Cancel = true;
            closing = true;
            lifetime.Cancel();
            await showcase.DisposeAsync();
            lifetime.Dispose();
            Close();
        };
        Update();
    }

    private void Update()
    {
        if (closing)
        {
            return;
        }

        foreach (var (section, text) in displays)
        {
            text.Text = showcase.Render(section);
        }
        // This is presentation gating; protected operations still need server authorization.
        gatedPanel.IsVisible = showcase.Client.IsEnabled("new-dashboard");
    }
}
