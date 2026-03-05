// Dev-only lightweight observability helpers.
// Goal: make error paths / perf bottlenecks reproducible with minimal overhead.

export type ObsEvent = {
  name: string;
  data?: Record<string, unknown>;
};

const isDev = (() => {
  // Prefer Vite env in browser builds. Note: Vite injects `import.meta.env.DEV` at syntax level.
  // We intentionally avoid `globalThis.import.meta` (does not exist at runtime).
  const metaEnv = (import.meta as { env?: { DEV?: unknown } }).env;
  const viteDev = metaEnv?.DEV;
  if (typeof viteDev === 'boolean') return viteDev;

  // Fallback for non-Vite environments (e.g., node scripts/tests).
  return (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') || false;
})();

function safeJson(x: unknown): string {
  try {
    return JSON.stringify(x);
  } catch {
    return '"<unserializable>"';
  }
}

export function obsLog(event: ObsEvent): void {
  if (!isDev) return;
  // eslint-disable-next-line no-console
  console.debug(`[obs] ${event.name}`, event.data ?? {});
}

export async function obsMeasure<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  if (!isDev) return await fn();
  const t0 = (globalThis.performance?.now?.() ?? Date.now());
  try {
    const res = await fn();
    const t1 = (globalThis.performance?.now?.() ?? Date.now());
    obsLog({ name: `measure:${name}`, data: { ms: Math.round((t1 - t0) * 1000) / 1000 } });
    return res;
  } catch (err) {
    const t1 = (globalThis.performance?.now?.() ?? Date.now());
    obsLog({ name: `error:${name}`, data: { ms: Math.round((t1 - t0) * 1000) / 1000, err: safeJson(err) } });
    throw err;
  }
}
