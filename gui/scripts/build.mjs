// Pages build entry: node scripts/build.mjs [--out DIR] [--commit SHA] [--built-at ISO]
// The commit comes from --commit, then SMM_COMMIT, then GITHUB_SHA, and only then from
// `git rev-parse HEAD`. This file is a build tool, not a test: tests call scripts/site.mjs
// with an explicit commit and never reach the version-control lookup below.
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { buildSite } from "./site.mjs";

const { values } = parseArgs({ options: {
  out: { type: "string" }, commit: { type: "string" }, "built-at": { type: "string" },
} });

function headCommit() {
  const repository = fileURLToPath(new URL("../../", import.meta.url));
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8", shell: false });
  return result.status === 0 ? result.stdout.trim() : null;
}

const commit = values.commit ?? process.env.SMM_COMMIT ?? process.env.GITHUB_SHA ?? headCommit();
if (!commit) {
  console.error("コミットを決められません。--commit か環境変数 SMM_COMMIT で指定してください。");
  process.exit(2);
}
const builtAt = values["built-at"] ?? process.env.SMM_BUILT_AT ?? new Date().toISOString();
const { outDir, stamp } = await buildSite({ outDir: values.out, commit, builtAt });
console.error(`version.json: ${JSON.stringify(stamp)} → ${outDir}`);
