import fs from "node:fs";
import path from "node:path";

// Invoke npm's JavaScript entry point without a platform shell or .cmd wrapper.
export function npmCommand(args) {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
  ];
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    candidates.push(path.join(directory, "node_modules/npm/bin/npm-cli.js"));
    const launcher = path.join(directory, "npm");
    if (fs.existsSync(launcher)) {
      candidates.push(path.join(path.dirname(fs.realpathSync(launcher)), "npm-cli.js"));
    }
  }
  const entry = candidates.find((candidate) => candidate && candidate.endsWith(".js") && fs.existsSync(candidate));
  if (!entry) throw new Error("npm の実行ファイルが見つかりません。");
  return { file: process.execPath, args: [entry, ...args] };
}
