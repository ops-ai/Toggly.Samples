function bounded(promise, milliseconds, label) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds}ms`)), milliseconds)
    }),
  ]).finally(() => clearTimeout(timer))
}

function exited(child) {
  return child.exitCode !== null || child.signalCode !== null
}

async function closeBrowser(resources, { connectionMs, serverMs, killMs, exitMs }) {
  const errors = []
  const server = resources.browserServer
  const processHandle = server?.process()
  const processClosed = processHandle && !exited(processHandle)
    ? new Promise((resolve) => processHandle.once('close', resolve))
    : Promise.resolve()
  let gracefulFailed = false

  if (resources.browser) {
    try {
      await bounded(Promise.resolve().then(() => resources.browser.close()), connectionMs, 'browser connection close')
    } catch (error) {
      errors.push(error)
      gracefulFailed = true
    }
  }
  if (server) {
    try {
      await bounded(Promise.resolve().then(() => server.close()), serverMs, 'browser server close')
    } catch (error) {
      errors.push(error)
      gracefulFailed = true
    }
    if (gracefulFailed || !exited(processHandle)) {
      try {
        await bounded(Promise.resolve().then(() => server.kill()), killMs, 'browser server kill')
      } catch (error) {
        errors.push(error)
      }
    }
    try {
      await bounded(processClosed, exitMs, 'browser process exit')
    } catch (error) {
      errors.push(error)
      // A graceful close may have resolved without the process exiting.
      try {
        await bounded(Promise.resolve().then(() => server.kill()), killMs, 'browser server kill after exit timeout')
        await bounded(processClosed, exitMs, 'browser process forced exit')
      } catch (killError) {
        errors.push(killError)
      }
    }
  }
  return errors
}

async function closeChild(child, { gracefulMs, forcedMs }) {
  if (!child || exited(child)) return
  const closed = new Promise((resolve) => child.once('close', resolve))
  child.kill('SIGTERM')
  try {
    await bounded(closed, gracefulMs, 'Nuxt graceful shutdown')
  } catch (error) {
    if (!String(error).includes('timed out')) throw error
    child.kill('SIGKILL')
    await bounded(closed, forcedMs, 'Nuxt forced shutdown')
  }
}

async function closeInterceptor(interceptor, milliseconds) {
  if (!interceptor?.listening) return
  const closed = new Promise((resolve, reject) => {
    interceptor.close((error) => error ? reject(error) : resolve())
  })
  interceptor.closeAllConnections?.()
  await bounded(closed, milliseconds, 'interceptor shutdown')
}

export async function cleanupOwnedResources(resources, {
  connectionMs = 2_000,
  serverMs = 2_000,
  killMs = 2_000,
  exitMs = 2_000,
  gracefulMs = 2_000,
  forcedMs = 2_000,
  interceptorMs = 2_000,
} = {}) {
  const results = await Promise.allSettled([
    closeBrowser(resources, { connectionMs, serverMs, killMs, exitMs }),
    closeChild(resources.child, { gracefulMs, forcedMs }),
    closeInterceptor(resources.interceptor, interceptorMs),
  ])
  return results.flatMap((result) => result.status === 'fulfilled' ? (result.value ?? []) : [result.reason])
}

export async function withOwnedResources(run, resources, timeouts) {
  let result
  let primaryError
  try {
    result = await run()
  } catch (error) {
    primaryError = error
  }
  const cleanupErrors = await cleanupOwnedResources(resources, timeouts)
  if (primaryError) {
    if (cleanupErrors.length) primaryError.cause = new AggregateError(cleanupErrors, 'Resource cleanup failed')
    throw primaryError
  }
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Resource cleanup failed')
  return result
}
