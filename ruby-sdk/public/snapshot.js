// Poll only the visible snapshot. Context changes use full form navigation, so
// an old response cannot overwrite the newly selected identity or Order.
(() => {
  const rows = [...document.querySelectorAll('[data-flag]')];
  if (rows.length === 0) return;
  let active = true;
  let timer;
  let controller;
  async function update() {
    controller = new AbortController();
    try {
      const response = await fetch('/api/snapshot', {
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('Snapshot unavailable');
      const data = await response.json();
      if (!active) return;
      for (const row of rows) {
        const flag = data.flags.find(item => item.key === row.dataset.flag);
        if (!flag) continue;
        const badge = row.querySelector('[data-state] .badge');
        badge.textContent = flag.enabled ? 'ON' : 'OFF';
        badge.className = `badge ${flag.enabled ? 'on' : 'off'}`;
        row.querySelector('[data-reason]').textContent = flag.reason;
      }
      document.querySelectorAll('[data-ready]').forEach(node => {
        node.textContent = String(data.ready);
      });
      document.querySelector('[data-snapshot-status]').textContent =
        `Updated ${new Date().toLocaleTimeString()}`;
    } catch (error) {
      if (active && error.name !== 'AbortError') {
        document.querySelector('[data-snapshot-status]').textContent =
          'Refresh unavailable; keeping the last displayed values';
      }
    } finally {
      if (active) timer = setTimeout(update, 3000);
    }
  }
  window.addEventListener('pagehide', () => {
    active = false;
    clearTimeout(timer);
    controller?.abort();
  });
  timer = setTimeout(update, 3000);
})();
