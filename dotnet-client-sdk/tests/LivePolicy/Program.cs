using LiveAcceptance;

// This regression executable never creates an SDK client or network transport.
// These unsigned objects exercise observation ordering only, not signature acceptance.
const string disabled = """{"defs":{"new-dashboard":false},"kid":"policy-test","timestamp":1}""";
const string enabled = """{"defs":{"new-dashboard":true},"kid":"policy-test","timestamp":2}""";
var evidence = new Evidence();
evidence.RecordSave(disabled, "r1");
var previous = evidence.LastSave!;
var marker = evidence.Sequence;
evidence.RecordRequest();
evidence.RecordResponse();
evidence.RecordSave(enabled, "r2");
Evidence.Require(!evidence.IsPushApplied(marker, previous, true), "poll-must-not-pass");
evidence.RecordFrame("flags-updated");
Evidence.Require(!evidence.IsPushApplied(marker, previous, true), "late-frame-must-not-pass");
evidence.RecordRequest();
evidence.RecordResponse();
evidence.RecordSave(enabled, "r2");
Evidence.Require(evidence.IsPushApplied(marker, previous, true), "ordered-push-must-pass");
Evidence.Require(!evidence.IsPushApplied(marker, previous, false), "wrong-value-must-not-pass");
Evidence.Require(!evidence.IsPushApplied(evidence.Sequence, previous, true), "old-frame-must-not-pass");
evidence.RecordSave(enabled, "r1");
Evidence.Require(!evidence.IsPushApplied(marker, previous, true), "same-revision-must-not-pass");
evidence.RecordSave(disabled, "r3");
Evidence.Require(!evidence.IsPushApplied(marker, previous, false), "same-envelope-must-not-pass");
Evidence.Log("observation-policy-passed");
