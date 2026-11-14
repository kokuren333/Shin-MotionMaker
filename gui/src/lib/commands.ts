// CLI / MCP usage examples for the current input (GU-06). Command shapes follow
// REQUIREMENTS §4.1 and CONTRACT §4: generate <request.json> --out <dir> [--zip].
// These are text examples only; the GUI never runs them.

export const DOCS_BASE = "https://github.com/kokuren333/Shin-MotionMaker/blob/main/";
export const docLinks = [
  { label: "README（GUI・CLI・MCP の使い方と必要な環境）", href: `${DOCS_BASE}README.md` },
  { label: "docs/CLI.md（コマンド・封筒・終了コード）", href: `${DOCS_BASE}docs/CLI.md` },
  { label: "docs/MCP.md（起動・ツール・run の待ち方・安全）", href: `${DOCS_BASE}docs/MCP.md` },
] as const;

/** The shells a command example is written for. Each needs its own quoting. */
export type Shell = "powershell" | "posix";
export const shells: { id: Shell; label: string }[] = [
  { id: "powershell", label: "PowerShell（Windows）" },
  { id: "posix", label: "bash・zsh などの POSIX シェル（macOS・Linux・WSL）" },
];

/**
 * Quote one argument so that the shell passes it through unchanged as a single argument.
 * Single quotes are used in both shells because nothing inside them is expanded
 * ($(), $var, backticks, &, spaces). PowerShell treats the typographic single quotes
 * U+2018–U+201B as quote characters too, so those are doubled along with '.
 */
export function shellArgument(value: string, shell: Shell): string {
  if (/^[A-Za-z0-9._/][A-Za-z0-9._/-]*$/.test(value)) return value;
  return shell === "powershell"
    ? `'${value.replace(/['‘’‚‛]/g, (quote) => quote + quote)}'`
    : `'${value.replaceAll("'", "'\\''")}'`;
}

export function generateCommand(requestFile: string, shell: Shell, options: { out?: string; zip?: boolean } = {}): string {
  return ["smm", "generate", shellArgument(requestFile, shell), "--out", shellArgument(options.out ?? "jobs", shell),
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
