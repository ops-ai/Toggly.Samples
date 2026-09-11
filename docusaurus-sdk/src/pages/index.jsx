import React from "react";
import Layout from "@theme/Layout";
import { useToggly } from "@ops-ai/toggly-docusaurus-plugin/client";
import { useWorkshop } from "../theme/Root";
import NativeGates from "../components/NativeGates";
import OrderContext from "../components/OrderContext";
import FilterMatrix from "../components/FilterMatrix";
import catalog from "../sample/catalog.cjs";
export default function Home() {
  const workshop = useWorkshop();
  const { flags, isReady } = useToggly();
  const {
    offline,
    preset,
    setPreset,
    toggles,
    setToggles,
    safeDefaults,
    setSafeDefaults,
  } = workshop;
  return (
    <Layout>
      <main className="workshop">
        <p>D O C U S A U R U S · FEATURE FLAGS, STEP BY STEP</p>
        <h1>
          Ship the guide.
          <br />
          Choose the experience.
        </h1>
        <p>
          Follow one decision from MDX to a button and an Order-specific core
          check.
        </p>
        <div className="notice" data-testid="mode">
          {offline
            ? "OFFLINE DEFAULTS · No App Key configured. Native SDKs consume recorded defaults; no real Toggly requests. Add your public App Key to .env.local and restart."
            : "LIVE SDK · Signed evaluated definitions. Change flags in your Toggly application."}
        </div>
        <nav className="row">
          {[
            ["home", "01 Start"],
            ["gates", "02 Gates"],
            ["actions", "03 Actions"],
            ["identity", "04 Identity"],
            ["order", "05 Order"],
            ["filters", "06 Filters"],
            ["variants", "07 Variants"],
            ["surfaces", "08 Docusaurus"],
          ].map(([id, label]) => (
            <a key={id} href={"#" + id}>
              {label}
            </a>
          ))}
        </nav>
        <section className="panel" id="home">
          <h2>01 · Your first flag: new-dashboard</h2>
          <p>
            Switch new-dashboard off below and watch both native Feature and the
            checklist change. In live mode, change the flag in Toggly; the
            native provider polls its cache for background updates.
          </p>
          <div className="snapshot">
            {catalog.demoKeys.map((key) => (
              <button
                key={key}
                data-testid={"toggle-" + key}
                disabled={!offline || key === "ExpressCheckout"}
                onClick={() => setToggles({ ...toggles, [key]: !toggles[key] })}
              >
                {key}:{" "}
                {key === "ExpressCheckout"
                  ? "See Order"
                  : !isReady
                    ? "Loading"
                    : flags[key] === true
                      ? "ON"
                      : "OFF"}
              </button>
            ))}
          </div>
          <p>
            These results read useToggly directly. No copied snapshot can drift
            from the native components.
          </p>
        </section>
        <NativeGates />
        <section className="panel" id="identity">
          <h2>04 · Target a session, not a permission</h2>
          <button onClick={() => setPreset("matching")}>
            Matching · alice
          </button>{" "}
          <button onClick={() => setPreset("nonmatching")}>
            Non-matching · bob
          </button>
          <pre data-testid="identity">
            {JSON.stringify(catalog.users[preset], null, 2)}
          </pre>
          <p>
            Identity is supported at client creation and is sent before the
            first evaluation. This binding/core release has no groups, claims or
            setContext configuration. Groups/claims shown here explain the
            fixture; they are not sent in live mode. A session change creates
            fresh clients; it does not mutate server-wide identity.
          </p>
        </section>
        <OrderContext />
        <FilterMatrix />
        <section className="panel" id="variants">
          <h2>07 · Variants: capability boundary</h2>
          <p>
            These Docusaurus packages expose boolean/entity evaluations, not
            variant assignments or configuration values. Keep the existing
            layout. A flag being ON does not identify a variant, and this sample
            invents no assignment API.
          </p>
        </section>
        <section className="panel" id="surfaces">
          <h2>08 · Docusaurus: build, browser and edge</h2>
          <p>
            <a href="/docs/beta">Open the MDX Beta guide</a> to inspect native
            Feature/negate and x-feature page mapping. The plugin writes
            page-feature manifests and filters mapped navbar links. Hiding a
            link does not secure the static HTML.
          </p>
          <p>
            This sample uses runtime gating. The build renders both Feature
            branches for complete HTML/headings; browser evaluation then selects
            one. staticGating is a separate build snapshot option requiring a
            rebuild for changes, not a per-user server.
          </p>
          <p>
            Edge stripping requires a separately deployed worker. There is no
            published runnable worker package for this example, so no copied
            private/source-only worker is included and edge protection is not
            claimed.
          </p>
          <button
            disabled={!offline}
            onClick={() => setSafeDefaults(!safeDefaults)}
          >
            {safeDefaults
              ? "Restore recorded defaults"
              : "Exercise safe OFF defaults"}
          </button>
          <p>
            Fetch/signature failures fall back to last-known-good flags or
            configured defaults. These packages may absorb errors instead of
            surfacing useToggly.error; absence of an error message is not proof
            of a fresh successful fetch.
          </p>
        </section>
      </main>
    </Layout>
  );
}
