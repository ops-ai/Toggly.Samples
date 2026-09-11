import React, { useState } from "react";
import {
  Feature,
  useFlag,
  useToggly,
} from "@ops-ai/toggly-docusaurus-plugin/client";
export default function NativeGates() {
  const { enabled, isReady } = useFlag("new-dashboard");
  const { flags, getFlag } = useToggly();
  const [result, setResult] = useState("No action yet");
  const [device, setDevice] = useState(true);
  // Native binding has only a single-key Feature. This all/any composition
  // deliberately accepts booleans only; an EntityGate object is not truthy ON.
  const values = ["new-dashboard", "api-v2"].map((key) => flags[key] === true);
  return (
    <>
      <section className="panel" id="gates">
        <h2>02 · Let the template follow the flag</h2>
        <p>
          Native Feature removes its children when denied. Negate keeps the
          existing UI available.
        </p>
        <Feature flag="new-dashboard">
          <p data-testid="new-ui">New dashboard visible</p>
        </Feature>
        <Feature flag="new-dashboard" negate>
          <p data-testid="old-ui">Existing dashboard visible</p>
        </Feature>
        <p data-testid="native-hook">
          Native useFlag: {isReady ? (enabled ? "ON" : "OFF") : "Loading"}
        </p>
        <p data-testid="all">
          Sample all composition: {values.every(Boolean) ? "ON" : "OFF"}
        </p>
        <p data-testid="any">
          Sample any composition: {values.some(Boolean) ? "ON" : "OFF"}
        </p>
        <p className="muted">
          Multi-key and variant components are not exposed by this binding.
          These booleans compose two native results; variants have no native
          assignment/configuration API here.
        </p>
      </section>
      <section className="panel" id="actions">
        <h2>03 · Check before an action</h2>
        <p>
          Await the native getFlag helper at the action boundary. Keep a denied
          path, and authorize real mutations on your server.
        </p>
        <button
          onClick={async () =>
            setResult(
              (await getFlag("enhanced-submit")) && device
                ? "Action allowed (demo only)"
                : "Action denied",
            )
          }
        >
          Check submit
        </button>
        <p data-testid="action-result">{result}</p>
        <button onClick={() => setDevice(!device)}>
          Device prerequisite: {device ? "ready" : "not ready"}
        </button>
        <p>
          This local AND is sample composition; the Docusaurus API has no native
          local-gate registry. It can restrict an enabled flag and never enables
          a denied flag.
        </p>
      </section>
    </>
  );
}
