// GU-06: command examples follow REQUIREMENTS §4.1 / CONTRACT §4 and are quoted per shell
// so that the request file name reaches smm as one unchanged argument (M4R R3).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { defaults } from "../../src/core/index.ts";
import { docLinks, generateCommand, mcpRegistration, shellArgument, shells } from "../src/lib/commands.ts";
import { requestFilename } from "../src/lib/request-io.ts";

// Free-text titles keep every one of these characters (only the file-name rule of core safeName applies).
const risky = [
  "$(1+1)", "a`b", "it's", 'say "hi"', "a&b", "空白 あり", "（全角）＆記号", "‘曲’と’", "$env:PATH", "-dash", "a;b|c>d", "x　y",
];
const names = risky.map((title) => requestFilename({ ...defaults, title }));
const values = [...risky, ...names];

test("generate command: generate <request.json> --out <dir> [--zip], one example per shell", () => {
  assert.deepEqual(shells.map((shell) => shell.id), ["powershell", "posix"]);
  for (const shell of ["powershell", "posix"] as const) {
    assert.equal(generateCommand("a.request.json", shell), "smm generate a.request.json --out jobs");
    assert.equal(generateCommand("a.request.json", shell, { zip: true }), "smm generate a.request.json --out jobs --zip");
  }
  assert.equal(generateCommand("虹 と&記号.request.json", "powershell", { out: "出力 先" }), "smm generate '虹 と&記号.request.json' --out '出力 先'");
  assert.equal(generateCommand("虹 と&記号.request.json", "posix", { out: "出力 先" }), "smm generate '虹 と&記号.request.json' --out '出力 先'");
});

test("PowerShell quoting: single quotes, inner ' and typographic single quotes doubled", () => {
  assert.equal(shellArgument("$(1+1).request.json", "powershell"), "'$(1+1).request.json'");
  assert.equal(shellArgument("it's", "powershell"), "'it''s'");
  assert.equal(shellArgument("‘曲’", "powershell"), "'‘‘曲’’'");
  assert.equal(shellArgument("a`b", "powershell"), "'a`b'");
  assert.equal(shellArgument('say "hi"', "powershell"), `'say "hi"'`);
  assert.equal(shellArgument("-dash", "powershell"), "'-dash'");
  assert.equal(shellArgument("jobs/x-1.json", "powershell"), "jobs/x-1.json");
});

test("POSIX quoting: single quotes, inner ' written as '\\''", () => {
  assert.equal(shellArgument("$(1+1).request.json", "posix"), "'$(1+1).request.json'");
  assert.equal(shellArgument("it's", "posix"), "'it'\\''s'");
  assert.equal(shellArgument("a`b", "posix"), "'a`b'");
  assert.equal(shellArgument('say "hi"', "posix"), `'say "hi"'`);
  assert.equal(shellArgument("jobs/x-1.json", "posix"), "jobs/x-1.json");
  // Rule check: '...' pieces joined only by \' with nothing else outside quotes, and decoding gives the value back.
  for (const value of values) {
    const quoted = shellArgument(value, "posix");
    if (quoted === value) continue;
    assert.match(quoted, /^'[^']*'(?:\\''[^']*')*$/, quoted);
    assert.equal(quoted.slice(1, -1).split("'\\''").join("'"), value);
  }
});

test("titles stay free text: only core safeName touches the file name", () => {
  assert.equal(names[0], "$(1+1).request.json");
  assert.equal(names[1], "a`b.request.json");
  assert.equal(names[2], "it's.request.json");
  assert.equal(names[3], "say -hi-.request.json", "core safeName replaces \" in file names");
});

test("PowerShell receives each quoted name as one unchanged argument (powershell.exe -NoProfile -Command)",
  { skip: process.platform !== "win32" && "PowerShell 5.1 は Windows だけ" }, () => {
    // One process for all cases; each command line prints its arguments as one JSON line.
    const script = ["[Console]::OutputEncoding = [Text.Encoding]::UTF8",
      "function smm { ConvertTo-Json -Compress -InputObject @($args) }",
      ...values.map((value) => generateCommand(value, "powershell"))].join("\n");
    const run = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", shell: false });
    assert.equal(run.status, 0, run.stderr);
    const lines = run.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
    assert.deepEqual(lines, values.map((value) => ["generate", value, "--out", "jobs"]));
  });

test("a POSIX sh receives each quoted name as one unchanged argument (when sh is on PATH)", (context) => {
  const probe = spawnSync("sh", ["-c", "exit 0"], { shell: false });
  if (probe.error || probe.status !== 0) { context.skip("sh がありません（文字列の規則は上のテストで確認）"); return; }
  const script = ["smm() { printf '%s\\0' \"$@\"; printf '\\n'; }",
    ...values.map((value) => generateCommand(value, "posix"))].join("\n");
  const run = spawnSync("sh", ["-c", script], { encoding: "utf8", shell: false });
  assert.equal(run.status, 0, run.stderr);
  const lines = run.stdout.split("\0\n").slice(0, -1).map((line) => line.split("\0"));
  assert.deepEqual(lines, values.map((value) => ["generate", value, "--out", "jobs"]));
});

test("MCP registration is a client-neutral stdio entry for mcp serve --root", () => {
  const entry = JSON.parse(mcpRegistration("work")).mcpServers["shin-motionmaker"];
  assert.deepEqual(entry, { command: "shin-motionmaker", args: ["mcp", "serve", "--root", "work"] });
});

test("documentation links point at README, CLI.md and MCP.md", () => {
  assert.deepEqual(docLinks.map((link) => link.href.split("/main/")[1]), ["README.md", "docs/CLI.md", "docs/MCP.md"]);
});
