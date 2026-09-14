using EmbeddedDashboardSample.Features;
using EmbeddedDashboardSample.Models;
using Microsoft.EntityFrameworkCore;
using Toggly.FeatureManagement.Configuration;
using Toggly.FeatureManagement.Dashboard;
using Toggly.FeatureManagement.Storage.EntityFramework;
using Toggly.FeatureManagement.Storage.EntityFramework.Configuration;
using Toggly.FeatureManagement.Web;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllersWithViews();

// A stable name identifies one authoritative catalog across restarts. The database
// is dedicated to this sample; no SDK key, cloud provider or outbound transport is registered.
var connection = builder.Configuration.GetConnectionString("TogglyCatalog") ?? "Data Source=toggly.sample.db;Pooling=False";
builder.Services.AddTogglyEntityFrameworkCatalogStore(options => options.UseSqlite(connection));
builder.Services.AddTogglyDashboard(options => options.CatalogName = "EmbeddedDashboardSample")
    .WithTogglyTargeting<HttpContextTargetingContextAccessor>();

// Registration describes a domain type. Each evaluation supplies its own Order;
// the registry retains the schema/mapping, not the current request's entity.
builder.Services.AddTogglyEntityContext<Order>("Order", order => order.Id, schema => schema
    .KeyProperty("Id").Property("Vip", "boolean").Property("Total", "number")
    .MapAttributes(order => new Dictionary<string, object?> { ["Vip"] = order.Vip, ["Total"] = order.Total }));

var app = builder.Build();

// EXPLICIT SAMPLE SCHEMA SETUP: EnsureCreated is appropriate only for this empty,
// dedicated SQLite database. Existing host databases need the catalog-only schema
// script or host migrations. This creates tables, never a catalog or demo flags.
await using (var scope = app.Services.CreateAsyncScope())
{
    var factory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<TogglyCatalogDbContext>>();
    await using var database = await factory.CreateDbContextAsync();
    await database.Database.EnsureCreatedAsync();
}

app.UseStaticFiles();
app.UseRouting();
app.Use(SamplePersonas.Apply);
app.MapControllers();
app.MapControllerRoute("workshop", "{controller=Showcase}/{action=Index}");

// Without authorization metadata the package allows only a direct loopback peer
// and rejects forwarding headers. Demo identities do NOT authorize this dashboard.
// A deployed host must configure its real authentication/authorization middleware
// and append .RequireAuthorization("FeatureAdmins") to this mapping.
app.MapTogglyDashboard("/internal/features", new() { ApplicationName = "Embedded Dashboard Sample" });
app.Run();

public partial class Program;
