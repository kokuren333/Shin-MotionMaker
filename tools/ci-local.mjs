import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { npmCommand } from "./npm-command.mjs";

const source = fileURLToPath(new URL("../", import.meta.url));
const keepOnFailure = process.argv.includes("--keep-on-failure");
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "smm-ci-"));
const checkout = path.join(temporary, "checkout");
let failed = true;
function execute(label, file, args, cwd) {
  console.log(`実行: ${label}`);
  const result = spawnSync(file, args, { cwd, stdio: "inherit", shell: false });
  if (result.error || result.status !== 0) throw new Error(`${label} が失敗しました（${result.status ?? result.error?.code}）。`);
}
try {
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: source, encoding: "utf8", shell: false });
  if (head.status !== 0) throw new Error("現在のコミットを取得できません。");
  const commit = head.stdout.trim();
  // A local file transport advertises the source worktree's current HEAD.
  execute("深さ1の複製", "git", ["clone", "--depth", "1", pathToFileURL(source).href, checkout], source);
  const clonedHead = spawnSync("git", ["rev-parse", "HEAD"], { cwd: checkout, encoding: "utf8", shell: false });
  if (clonedHead.status !== 0 || clonedHead.stdout.trim() !== commit) throw new Error("複製中に元の HEAD が変わりました。");
  for (const args of [["ci"], ["run", "build"], ["test"], ["test", "--workspaces", "--if-present"], ["run", "build", "--workspaces", "--if-present"]]) {
    const command = npmCommand(args);
    execute(`npm ${args.join(" ")}`, command.file, command.args, checkout);
  }
  failed = false;
  console.log(`CI と同じコマンドが完了しました: ${commit}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (failed && keepOnFailure) console.error(`失敗した複製を保持しました: ${checkout}`);
  else {
    const resolved = path.resolve(temporary);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("smm-ci-"))
      throw new Error("一時フォルダの削除対象を確認できません。");
    await fs.rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
