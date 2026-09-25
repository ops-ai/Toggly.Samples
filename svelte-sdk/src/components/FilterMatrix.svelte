<script>
  import { getContext } from "svelte";
  import { workshopKey } from "../sample/workshop";
  import { filters } from "../sample/catalog";
  const { session } = getContext(workshopKey);
</script>

<section id="filters" class="panel">
  <div class="section-top">
    <span class="number">06</span>
    <h2>Eleven filters, one context</h2>
  </div>
  <p>
    {$session.offline
      ? "These are recorded Matching / Non-matching fixture outcomes consumed by the SDK, not a local copy of the production filter engine. The illustrative percentage result is not production bucketing."
      : "User filters run in the Definitions service. Entity rules are checked locally against the Order. Browser HTTP metadata is not overridden by these controls."}
  </p>
  <details>
    <summary>Inspect the preset’s HTTP reference values</summary>
    <pre>{JSON.stringify(
      {
        country: $session.user.country,
        language: $session.user.language,
        userAgent: $session.user.userAgent,
      },
      null,
      2,
    )}</pre>
    <p>
      Reference values only in live mode. Do not confuse Macintosh (device)
      with Mac (operating system).
    </p>
  </details>
  <div class="table-scroll">
    <table>
      <thead>
        <tr>
          <th>Flag / filter</th>
          <th>Configured rule</th>
          <th>SDK result</th>
        </tr>
      </thead>
      <tbody>
        {#each filters as filter (filter.key)}
          <tr>
            <td>
              <code>{filter.key}</code>
              <small>{filter.name}</small>
            </td>
            <td>{filter.rule}</td>
            <td>
              <span class={$session.snapshot[filter.key] ? "on" : "off"}>
                {$session.snapshot[filter.key] ? "ON" : "OFF"}
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
