// CLI / MCP usage examples for the current input (GU-06). Command shapes follow
// REQUIREMENTS §4.1 and CONTRACT §4: generate <request.json> --out <dir> [--zip].
// These are text examples only; the GUI never runs them.

export const DOCS_BASE = "https://github.com/kokuren333/Shin-MotionMaker/blob/main/";
export const docLinks = [
  { label: "README（GUI・CLI・MCP の使い方と必要な環境）", href: `${DOCS_BASE}README.md` },
  { label: "docs/CLI.md（コマンド・封筒・終了コード）", href: `${DOCS_BASE}docs/CLI.md` },
  { label: "docs/MCP.md（起動・ツール・run の待ち方・安全）", href: `${DOCS_BASE}docs/MCP.md` },
] as const;

/** Quote one argument so it survives bash, PowerShell and cmd alike when it contains spaces or symbols. */
export function shellArgument(value: string): string {
  return /^[A-Za-z0-9._\/-]+$/.test(value) ? value : `"${value.replaceAll('"', '\\"')}"`;
}

export function generateCommand(requestFile: string, options: { out?: string; zip?: boolean } = {}): string {
  return ["smm", "generate", shellArgument(requestFile), "--out", shellArgument(options.out ?? "jobs"),
    ...(options.zip ? ["--zip"] : [])].join(" ");
}

/** A client-neutral MCP server entry (stdio, MC-01). The root is the folder the agent may touch. */
export function mcpRegistration(root = "<作業フォルダ>"): string {
  return JSON.stringify({
    mcpServers: {
      "shin-motionmaker": { command: "shin-motionmaker", args: ["mcp", "serve", "--root", root] },
    },
  }, null, 2);
}
