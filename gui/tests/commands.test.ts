// GU-06: command examples follow REQUIREMENTS §4.1 / CONTRACT §4 and quote risky names.
import assert from "node:assert/strict";
import { test } from "node:test";
import { docLinks, generateCommand, mcpRegistration, shellArgument } from "../src/lib/commands.ts";

test("generate command: generate <request.json> --out <dir> [--zip]", () => {
  assert.equal(generateCommand("a.request.json"), "smm generate a.request.json --out jobs");
  assert.equal(generateCommand("a.request.json", { zip: true }), "smm generate a.request.json --out jobs --zip");
  assert.equal(generateCommand("虹 と&記号.request.json", { out: "出力 先" }), 'smm generate "虹 と&記号.request.json" --out "出力 先"');
});

test("shell arguments with spaces, ampersands, full-width symbols or quotes are quoted", () => {
  for (const value of ["a b", "a&b", "（全角）", 'say "hi"']) assert.match(shellArgument(value), /^".*"$/);
  assert.equal(shellArgument('say "hi"'), '"say \\"hi\\""');
  assert.equal(shellArgument("jobs/x-1.json"), "jobs/x-1.json");
});

test("MCP registration is a client-neutral stdio entry for mcp serve --root", () => {
  const entry = JSON.parse(mcpRegistration("work")).mcpServers["shin-motionmaker"];
  assert.deepEqual(entry, { command: "shin-motionmaker", args: ["mcp", "serve", "--root", "work"] });
});

test("documentation links point at README, CLI.md and MCP.md", () => {
  assert.deepEqual(docLinks.map((link) => link.href.split("/main/")[1]), ["README.md", "docs/CLI.md", "docs/MCP.md"]);
});
