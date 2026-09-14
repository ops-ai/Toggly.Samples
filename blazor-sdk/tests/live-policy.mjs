/** Validate before starting a browser or making even a localhost request. */
export function configuration(env = process.env) {
  const origin = new URL(env.SAMPLE_URL ?? "http://localhost:5280");
  if (
    env.TOGGLY_LIVE_ACCEPTANCE !== "1" ||
    !env.TOGGLY_FRONTEND_APP_KEY?.trim() ||
    !env.TOGGLY_ENVIRONMENT?.trim() ||
    !["localhost", "127.0.0.1"].includes(origin.hostname) ||
    origin.protocol !== "http:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("configuration-required");
  return {
    origin: origin.origin,
    key: env.TOGGLY_FRONTEND_APP_KEY,
    environment: env.TOGGLY_ENVIRONMENT,
  };
}

/** A frame must precede a new signed request and its changed response. */
export function isPushApplied(marker, frame, previous, next, expected) {
  return Boolean(
    next &&
      frame > marker &&
      next.requestSequence > frame &&
      next.responseSequence > next.requestSequence &&
      next.hash !== previous.hash &&
      next.revision &&
      next.revision !== previous.revision &&
      next.value === expected,
  );
}
