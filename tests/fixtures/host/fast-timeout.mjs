// Accelerate only the worker's five-minute QC deadline, preserving production dispatch.
if (/[/\\]worker\.(?:ts|js)$/.test(process.argv[1] ?? "")) {
  const original = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay, ...args) => original(callback, delay === 300000 ? 1000 : delay, ...args);
}
