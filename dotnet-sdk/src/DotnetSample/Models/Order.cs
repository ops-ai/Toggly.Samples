namespace DotnetSample.Models;

// The flag answers "may THIS order use express checkout?" User targeting is a
// separate question. Register this domain type once; pass each instance per call.
public sealed record Order(string Id, bool Vip, decimal? Total = null);
