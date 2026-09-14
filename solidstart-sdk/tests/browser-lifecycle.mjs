async function within(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Only pass processes created by this test. A close signal is not proof that the
// child exited: await its close event, then escalate within a second deadline.
export async function stopOwnedProcess(
  child,
  label,
  {
    graceMs = 5000,
    forceMs = 5000,
    close = () => child.kill('SIGTERM'),
    kill = () => child.kill('SIGKILL'),
    report = console.warn,
  } = {},
) {
  let onClose;
  let onError;
  const closed =
    child.exitCode !== null || child.signalCode !== null
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          onClose = resolve;
          onError = reject;
          child.once('close', onClose);
          child.once('error', onError);
        });
  try {
    try {
      await within(Promise.all([closed, Promise.resolve().then(close)]), graceMs, `${label} close`);
    } catch (error) {
      report(`${label}: ${error.message}; forcing shutdown`);
      await within(
        Promise.all([closed, Promise.resolve().then(kill)]),
        forceMs,
        `${label} forced close`,
      );
    }
  } finally {
    if (onClose) child.off('close', onClose);
    if (onError) child.off('error', onError);
  }
}

// Cleanup must run after an assertion failure, and a second failure must never
// replace the assertion that explains why the browser contract failed.
export async function runWithCleanup(run, cleanup) {
  let failed = false;
  let failure;
  try {
    await run();
  } catch (error) {
    failed = true;
    failure = error;
  }
  try {
    await cleanup();
  } catch (error) {
    if (failed) {
      throw new AggregateError([failure, error], 'Browser contract and cleanup failed', {
        cause: failure,
      });
    }
    throw error;
  }
  if (failed) throw failure;
}
