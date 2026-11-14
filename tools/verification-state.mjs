import assert from "node:assert/strict";
import path from "node:path";
import { repository, processResult } from "./verification-lib.mjs";

// Development evidence only. Test suites must never import or execute this module.
export async function verifyEvidenceState(expected) {
  const git = async (args) => {
    const result = await processResult("git", args);
    assert.equal(result.code, 0, result.stderr);
    return result.stdout.trim();
  };
  const head = await git(["rev-parse", "HEAD"]);
  if (expected) assert.equal(await git(["rev-parse", "--verify", `${expected}^{commit}`]), head, "指定コミットが HEAD と異なります。");
  assert.equal(await git(["status", "--porcelain=v1", "--untracked-files=normal"]), "", "作業ツリーをクリーンにしてから実行してください。");
  // Rebuild from the verified tree so stale ignored dist files cannot be measured.
  const build = await processResult(process.execPath, [path.join(repository, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.build.json"]);
  assert.equal(build.code, 0, build.stdout + build.stderr);
  const { TEMPLATE_VERSION } = await import("../dist/core/data/version.js");
  return { head, clean: true, template_version: TEMPLATE_VERSION, build: "tsc -p tsconfig.build.json", checked_at: new Date().toISOString() };
}
