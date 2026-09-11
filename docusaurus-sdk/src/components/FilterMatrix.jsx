import React from "react";
import { useToggly } from "@ops-ai/toggly-docusaurus-plugin/client";
import { useWorkshop } from "../theme/Root";
import catalog from "../sample/catalog.cjs";
export default function FilterMatrix() {
  const { flags } = useToggly();
  const { preset, offline, order, entityFilter } = useWorkshop();
  return (
    <section className="panel" id="filters">
      <h2>06 · Eleven filters, one reference matrix</h2>
      <p>
        {offline
          ? "Recorded fixture outcomes through the native binding."
          : "Live evaluated results from your browser request."}{" "}
        Country, User-Agent and language below are reference inputs, not browser
        overrides. Percentage is illustrative offline, not the production
        bucketing algorithm.
      </p>
      <details>
        <summary>Reference HTTP inputs</summary>
        <pre>{JSON.stringify(catalog.httpPresets[preset], null, 2)}</pre>
      </details>
      <table>
        <thead>
          <tr>
            <th>Flag / filter</th>
            <th>Rule</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {catalog.filters.map(([key, name, rule]) => (
            <tr key={key} data-testid={key}>
              <td>
                <code>{key}</code>
                <br />
                {name}
              </td>
              <td>{rule}</td>
              <td>
                {key === "filter-context-property"
                  ? entityFilter?.order === order &&
                    entityFilter?.identity === catalog.users[preset].identity
                    ? entityFilter.value
                      ? "ON"
                      : "OFF"
                    : "Loading"
                  : flags[key] === true
                    ? "ON"
                    : flags[key] === false
                      ? "OFF"
                      : "Unavailable"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Macintosh is the device value; Mac is the operating system. AlwaysOn
        stays on, TimeWindow stays on within its configured interval, and a 50%
        result is not promised for either preset.
      </p>
    </section>
  );
}
