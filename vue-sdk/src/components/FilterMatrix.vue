<script setup>
import { inject } from "vue";
import { workshopKey } from "../sample/workshop";
import { filters } from "../sample/catalog";
const { state } = inject(workshopKey);
</script>
<template>
  <section id="filters" class="panel">
    <div class="section-top">
      <span class="number">06</span>
      <h2>Eleven filters, one context</h2>
    </div>
    <p>
      {{
        state.offline
          ? "These are recorded Matching / Non-matching fixture outcomes consumed by the SDK, not a local copy of the production filter engine. The illustrative percentage result is not production bucketing."
          : "User filters run in the Definitions service. Entity rules are checked locally against the Order. Browser HTTP metadata is not overridden by these controls."
      }}
    </p>
    <details>
      <summary>Inspect the preset’s HTTP reference values</summary>
      <pre>{{
        JSON.stringify(
          {
            country: state.user.country,
            language: state.user.language,
            userAgent: state.user.userAgent,
          },
          null,
          2,
        )
      }}</pre>
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
          <tr v-for="filter in filters" :key="filter.key">
            <td>
              <code>{{ filter.key }}</code
              ><small>{{ filter.name }}</small>
            </td>
            <td>{{ filter.rule }}</td>
            <td>
              <span :class="state.snapshot[filter.key] ? 'on' : 'off'">{{
                state.snapshot[filter.key] ? "ON" : "OFF"
              }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
