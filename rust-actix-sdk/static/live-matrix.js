(() => {
  const POLL_MS = 2000;
  const rows = document.querySelectorAll('tr[data-filter]');
  if (!rows.length) return;

  async function refresh() {
    for (const row of rows) {
      const key = row.getAttribute('data-filter');
      if (!key) continue;
      try {
        const res = await fetch(`/api/check?key=${encodeURIComponent(key)}`);
        if (!res.ok) continue;
        const body = await res.json();
        const cell = row.querySelector('[data-toggly-state]');
        if (!cell) continue;
        const on = body.enabled === true && body.error !== true;
        const state = on ? 'on' : 'off';
        const text = body.error ? 'ERROR → OFF' : on ? 'ON' : 'OFF';
        cell.setAttribute('data-toggly-state', state);
        cell.textContent = text;
        cell.className = `badge ${body.error ? 'error' : on ? 'on' : 'off'}`;
      } catch {
        /* retry on next tick */
      }
    }
  }

  refresh();
  window.setInterval(refresh, POLL_MS);
})();
