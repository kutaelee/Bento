export function perfSmokeRenderList(count: number) {
  // Minimal deterministic work to simulate render cost without DOM.
  // We avoid Date/perf timers to keep CI stable.
  let acc = 0;
  for (let i = 0; i < count; i += 1) {
    acc = (acc * 31 + i) >>> 0;
  }
  return acc;
}
