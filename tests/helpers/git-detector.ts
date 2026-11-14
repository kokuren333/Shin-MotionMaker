// Static guard for process-launch literals, including common imported aliases.
export function gitLaunches(source: string): string[] {
  const names = new Set(["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "execa", "execaSync", "execaCommand", "execaCommandSync"]);
  for (const match of source.matchAll(/(?:import\s*\{([^}]+)\}\s*from\s*["'](?:node:)?child_process["']|(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(["'](?:node:)?child_process["']\))/g)) {
    for (const member of (match[1] ?? match[2]).split(",")) {
      const parts = member.trim().split(/\s+as\s+|\s*:\s*/);
      if (names.has(parts[0])) names.add(parts[1] ?? parts[0]);
    }
  }
  const executable = "g" + "it";
  const calls = new RegExp(`\\b(?:${[...names].join("|")})\\s*\\(\\s*(["'\x60])(?:[^"'\x60\\r\\n]*[/\\\\])?${executable}(?:\\.exe)?(?:\\1|\\s)[^\\r\\n]*`, "g");
  return [...source.matchAll(calls)].map((match) => match[0]);
}
