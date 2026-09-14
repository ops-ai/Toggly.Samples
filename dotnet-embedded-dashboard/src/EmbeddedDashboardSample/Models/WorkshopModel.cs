using EmbeddedDashboardSample.Features;

namespace EmbeddedDashboardSample.Models;

public sealed record Order(string Id, bool Vip, decimal Total);
public sealed record WorkshopModel(SamplePersona Persona, IReadOnlyDictionary<string, bool> Flags,
    bool ExpressWithoutEntity, string StorageState, string? Revision);
