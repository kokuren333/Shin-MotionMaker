import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { schemaIssues, schemas, schemaRegistry, type Envelope } from "../../src/host/index.ts";

export const cliMain = fileURLToPath(new URL("../../src/cli/main.ts", import.meta.url));
export const builtCliMain = fileURLToPath(new URL("../../dist/cli/main.js", import.meta.url));
export async function cli(args: string[], cwd: string, built = false, env = process.env): Promise<{ code: number | null; stdout: string; stderr: string; envelope: Envelope<any> }> {
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [...(built ? [] : ["--experimental-strip-types"]), built ? builtCliMain : cliMain, ...args], { cwd, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8").on("data", (text) => { stdout += text; });
    child.stderr.setEncoding("utf8").on("data", (text) => { stderr += text; });
    child.once("error", reject); child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
  const envelope = JSON.parse(result.stdout) as Envelope<any>;
  assert.deepEqual(schemaIssues(schemas.envelope, envelope, schemaRegistry), [], result.stdout);
  assert.equal(result.stdout.trim().split("\n").length, 1, result.stdout);
  return { ...result, envelope };
}
