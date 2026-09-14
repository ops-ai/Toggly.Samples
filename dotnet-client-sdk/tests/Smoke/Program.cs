using DotnetClientSample;

// This smoke check uses explicit defaults; durable signed restart is verified in the SDK suite.
Environment.SetEnvironmentVariable("TOGGLY_APP_KEY", null);
await using var sample = new Showcase();
await sample.Client.InitializeAsync();

if (!sample.Offline || !sample.Client.IsReady || !sample.Client.IsEnabled("new-dashboard"))
{
    throw new Exception("Offline startup defaults failed");
}

if (!sample.Render("Entity context").Contains("fixture (not downloaded flags): True"))
{
    throw new Exception("VIP entity teaching fixture failed");
}

await sample.SetPresetAsync(false);
if (!sample.Render("Entity context").Contains("fixture (not downloaded flags): False"))
{
    throw new Exception("Non-VIP entity failed");
}

sample.LocalPrerequisite = false;
if (sample.Client.IsEnabled("enhanced-submit"))
{
    throw new Exception("Local prerequisite bypassed");
}

foreach (var section in Showcase.Sections)
{
    if (string.IsNullOrWhiteSpace(sample.Render(section)))
    {
        throw new Exception("Missing section " + section);
    }
}

Console.WriteLine("Offline lifecycle, presets, entity fixture, gates and seven sections verified.");
