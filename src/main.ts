import path from "node:path";
import { runCli } from "./cli/index.ts";

// Compose the two entry layers without making either depend on the other.
export async function runApplication(argv: string[], cwd: string, output: Parameters<typeof runCli>[2]): Promise<number> {
  return runCli(argv, cwd, output, async (input) => {
    const { serveMcp } = await import("./mcp/index.ts");
    await serveMcp({ root: path.resolve(cwd, input.root), readOnly: input.read_only,
      enableGeneration: input.enable_generation, allowDirs: input.allow_dir, allowEngineHosts: input.allow_engine_host });
  });
}
