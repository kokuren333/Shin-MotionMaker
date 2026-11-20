// Loaded with `node --import` into CLI and MCP child processes during the Seedance E2E tests.
// Any outbound fetch or socket connection is recorded to SEEDANCE_SENTINEL_LOG and fails loudly.
import fs from "node:fs";
import net from "node:net";
import tls from "node:tls";

const log = process.env.SEEDANCE_SENTINEL_LOG;
function record(kind, target) {
  const line = `${kind} ${String(target).slice(0, 200)}\n`;
  if (log) fs.appendFileSync(log, line);
  process.stderr.write(`SEEDANCE_NETWORK_SENTINEL ${line}`);
  throw new Error(`network access is forbidden in the Seedance E2E tests: ${kind}`);
}
globalThis.fetch = async (input) => record("fetch", typeof input === "string" ? input : input?.url ?? input);
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  // Local IPC pipes are allowed; TCP connections are not.
  if (options && typeof options === "object" && typeof options.path === "string") return connect.apply(this, args);
  if (typeof options === "string" && Number.isNaN(Number(options))) return connect.apply(this, args);
  return record("net.connect", JSON.stringify(options));
};
tls.connect = (...args) => record("tls.connect", JSON.stringify(args[0]?.host ?? args[0]));
