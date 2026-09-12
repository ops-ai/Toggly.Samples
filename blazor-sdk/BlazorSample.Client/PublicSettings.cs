namespace BlazorSample.Client;
// Explicit public configuration; never add the backend key or claims here.
public sealed record PublicSettings(string? FrontendAppKey, string Environment, bool BackendConfigured = false);
