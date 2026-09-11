// Progressive enhancement: keep the sample POST endpoint calling native client.refresh(), and show its JSON in
// the page because some embedded browsers download JSON navigations. The SDK's
// refresh result means an attempt finished, not that a revision changed.
const refresh = document.querySelector('[data-native-refresh]');
refresh?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = refresh.querySelector('button');
  const output = document.querySelector('#refresh-result');
  button.disabled = true;
  output.textContent = 'Requesting native refresh…';
  try {
    const response = await fetch(refresh.action, {method: 'POST', signal: AbortSignal.timeout(45000)});
    output.textContent = response.ok
      ? 'Native refresh attempt completed. Reload Home to inspect current flags and any error warning.'
      : `Native refresh unavailable (HTTP ${response.status}). Check configuration.`;
  } catch {
    output.textContent = 'Refresh request did not complete. Check the local server and try again.';
  } finally {
    button.disabled = false;
  }
});
