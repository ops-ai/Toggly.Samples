using DotnetSample.Features;
namespace DotnetSample.Models;

public sealed record ShowcaseModel(SamplePersona Persona, bool Offline,
    Dictionary<string, bool> Flags, string? Variant, string? VariantTitle,
    bool NoEntity, bool UnknownEntity, DateTime? LastDefinitionsCheck, bool Loaded,
    bool Connected, IReadOnlyList<string> JobIds);
