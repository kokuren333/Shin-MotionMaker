import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import JSZip from "jszip";
import type { Request } from "../../src/core/index.ts";
import { cli } from "./cli.ts";
import { connectMcp, envelope } from "./mcp.ts";

/** Compare browser-produced bytes with all four public disk generation routes. */
export async function compareEntrances(request: Request, assetsDirectory: string, expected: Record<string, Uint8Array>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "smm-entrances-"));
  const connection = await connectMcp(root);
  try {
    for (const name of new Set([...(request.assets?.sources ?? []),
      ...[request.assets?.character, request.assets?.secondCharacter, request.assets?.bgm, request.assets?.music].filter((name): name is string => !!name)]))
      await fs.copyFile(path.join(assetsDirectory, name), path.join(root, name));
    await fs.writeFile(path.join(root, "request.json"), JSON.stringify(request));
    const check = async (result: { job: string | null; archive: string | null }) => {
      const files: Record<string, Uint8Array> = {};
      if (result.job) {
        const walk = async (relative = "") => {
          for (const entry of await fs.readdir(path.join(root, result.job!, relative), { withFileTypes: true })) {
            const name = relative ? `${relative}/${entry.name}` : entry.name;
            if (entry.isDirectory()) await walk(name);
            else files[name] = await fs.readFile(path.join(root, result.job!, name));
          }
        };
        await walk();
      } else {
        const zip = await JSZip.loadAsync(await fs.readFile(path.join(root, result.archive!)));
        const prefix = Object.values(zip.files).find((entry) => !entry.dir)!.name.split("/")[0] + "/";
        for (const entry of Object.values(zip.files).filter((entry) => !entry.dir)) {
          assert.ok(entry.name.startsWith(prefix));
          files[entry.name.slice(prefix.length)] = await entry.async("uint8array");
        }
      }
      assert.deepEqual(Object.keys(files).sort(), Object.keys(expected).sort());
      for (const [name, bytes] of Object.entries(expected))
        assert.ok(Buffer.from(files[name]).equals(Buffer.from(bytes)), name);
    };
    for (const format of ["dir", "zip"] as const) {
      const out = `output-${format}`;
      const generated = await cli(["generate", "request.json", "--out", out, ...(format === "zip" ? ["--zip"] : [])], root, true);
      assert.equal(generated.code, 0, generated.stdout + generated.stderr);
      assert.ok(generated.envelope.ok);
      await check(generated.envelope.result);
      // Reuse exactly the same input and output paths to compare the complete result.
      await fs.rm(path.join(root, out), { recursive: true });
      const remote = envelope<"generate">(await connection.call("job_generate", { request, out, format }));
      assert.ok(remote.ok, JSON.stringify(remote));
      assert.deepEqual(remote.result, generated.envelope.result);
      await check(remote.result);
    }
  } finally {
    await connection.close();
    if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("smm-entrances-")) throw Error("Unexpected cleanup target");
    await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
