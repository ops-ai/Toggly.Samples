using DotnetClientSample;
await using var showcase=new Showcase();
using var shutdown=new CancellationTokenSource();
Console.CancelKeyPress+=(_,e)=>{e.Cancel=true;shutdown.Cancel();};
showcase.Client.Changed+=(_,_)=>Console.WriteLine("Flags/context changed; open Home to inspect.");
showcase.Client.Error+=(_,e)=>Console.WriteLine("Refresh warning: "+e.Message);
try
{
    await showcase.Client.InitializeAsync(shutdown.Token);
    Console.WriteLine(showcase.Render("Home"));
    if(args.Contains("--smoke"))
    {
        await showcase.SetPresetAsync(false,shutdown.Token);
        foreach(var section in Showcase.Sections) Console.WriteLine(showcase.Render(section));
        return;
    }
    while(!shutdown.IsCancellationRequested)
    {
        Console.WriteLine("1 Home | 2 Gates | 3 API | 4 Identity | 5 Order | 6 Filters | 7 Lifecycle | m Matching | n Non-matching | l Local prerequisite | r Refresh | q Quit");
        var command=Console.ReadLine();if(command is null or "q")break;
        if(command=="m" || command=="n")await showcase.SetPresetAsync(command=="m",shutdown.Token);
        else if(command=="l")showcase.LocalPrerequisite=!showcase.LocalPrerequisite;
        else if(command=="r")await showcase.Client.RefreshAsync(shutdown.Token);
        else if(int.TryParse(command,out var index)&&index>=1&&index<=Showcase.Sections.Length)Console.WriteLine(showcase.Render(Showcase.Sections[index-1]));
    }
}
catch(OperationCanceledException) when(shutdown.IsCancellationRequested) { }
