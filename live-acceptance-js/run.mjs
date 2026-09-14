import { configuration } from './protocol.mjs';
// Validate before importing the runner: no process/browser/network with missing inputs.
try {
  const config = configuration(process.env);
  const { acceptance } = await import('./runner.mjs');
  console.log('LIVE PUBLIC SDK ACCEPTANCE. Customer Sample UI remains a separate pending gate.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on('SIGINT', cancel);
  process.on('SIGTERM', cancel);
  try {
    await acceptance({ ...config, signal: controller.signal }, async (stage) => {
      const [leg, direction] = stage.split('-');
      if (direction === 'off' || direction === 'on')
        console.log(
          `OPERATOR: set new-dashboard ${direction.toUpperCase()} in the ${leg === 'backend' ? 'backend' : 'frontend'} application now. Awaiting actual WebSocket frame and signed refetch.`,
        );
      else console.log(`Observed ${stage}.`);
    });
  } finally {
    process.off('SIGINT', cancel);
    process.off('SIGTERM', cancel);
  }
  console.log('Public SDK runtime acceptance passed. Connected customer Sample UI not tested.');
} catch {
  // SDK errors may contain key-bearing URLs. Never print caught values or stacks.
  console.error(
    'Acceptance failed or inputs missing. Check documented prerequisites and current operator stage; no credentials or provider URLs are logged.',
  );
  process.exitCode = 1;
}
