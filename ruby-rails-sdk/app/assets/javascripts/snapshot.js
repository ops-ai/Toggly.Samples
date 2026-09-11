// Progressive enhancement: the full checklist is also rendered by Rails.
// No Toggly key or browser SDK is needed for this same-origin request.
const rows = document.querySelectorAll('[data-flag]');
if (rows.length > 0) {
  const status = document.getElementById('snapshot-status');
  async function refreshSnapshot() {
    try {
      const response = await fetch('/api/snapshot', { cache: 'no-store' });
      if (!response.ok) throw new Error('Snapshot request failed');
      const data = await response.json();
      for (const flag of data.flags) {
        const row = Array.from(rows).find((item) => item.dataset.flag === flag.key);
        if (!row) continue;
        const badge = row.querySelector('.badge');
        badge.textContent = flag.enabled ? 'ON' : 'OFF';
        badge.className = `badge ${flag.enabled ? 'on' : 'off'}`;
        row.querySelector('[data-reason]').textContent = flag.reason;
      }
      status.textContent = `Updated ${new Date().toLocaleTimeString()} · SDK ready: ${data.ready}`;
    } catch (_error) {
      status.textContent = 'Snapshot refresh failed. Last displayed values may be stale.';
    } finally {
      window.setTimeout(refreshSnapshot, 5000);
    }
  }
  window.setTimeout(refreshSnapshot, 5000);
}
