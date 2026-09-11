using Xunit;
// Hangfire configures some process-wide infrastructure. Hosts are sequential;
// the explicit 32-request test still exercises simultaneous independent users.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
