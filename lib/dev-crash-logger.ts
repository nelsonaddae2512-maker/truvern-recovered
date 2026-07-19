declare global {
  // eslint-disable-next-line no-var
  var __TRUVERN_CRASH_LOGGER__: boolean | undefined;
}

export function installCrashLogger() {
  if (process.env.NODE_ENV === "production") return;
  if (globalThis.__TRUVERN_CRASH_LOGGER__) return;
  globalThis.__TRUVERN_CRASH_LOGGER__ = true;

  process.on("unhandledRejection", (reason) => {
    console.error("[UNHANDLED_REJECTION]", reason);
  });

  process.on("uncaughtException", (err) => {
    console.error("[UNCAUGHT_EXCEPTION]", err);
  });
}



