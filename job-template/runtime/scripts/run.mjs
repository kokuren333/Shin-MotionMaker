import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { prepare, root, runtime } from "./lib.mjs";
import {
  ENCODED_RENDERS,
  RUN_MODES,
  encoderLine,
  noteRenderExit,
  remotionArgs,
  selectEncoder,
} from "./encoder.mjs";

const require = createRequire(import.meta.url);
const mode = process.argv[2];
// The Remotion arguments of every mode come from encoder.mjs. preview and
// build first choose the video encoder there: NVENC (GPU) only when a real
// one-frame test encode with Remotion's bundled ffmpeg succeeds, otherwise
// libx264 (CPU). MOTION_JOB_ENCODER=auto|cpu|gpu overrides the choice, and
// the chosen path is printed as one "[encoder]" line on stderr. A failed
// render is not retried with the other encoder.
if (!RUN_MODES.includes(mode)) {
  console.error("Use studio / preview / still / build");
  process.exitCode = 1;
} else {
  try {
    const encoder = ENCODED_RENDERS.includes(mode) ? selectEncoder() : null;
    if (encoder) console.error(encoderLine(encoder));
    await prepare();
    await fs.mkdir(path.join(root, "output"), { recursive: true });
    const cliPackage = require.resolve("@remotion/cli/package.json");
    const cliMeta = JSON.parse(await fs.readFile(cliPackage, "utf8"));
    const executable = path.resolve(
      path.dirname(cliPackage),
      typeof cliMeta.bin === "string" ? cliMeta.bin : cliMeta.bin.remotion,
    );
    const child = spawn(
      process.execPath,
      [executable, ...remotionArgs(mode, encoder), ...process.argv.slice(3)],
      { cwd: runtime, stdio: "inherit" },
    );
    child.on("error", (error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
    child.on("exit", (code) => {
      process.exitCode = code ?? 1;
      noteRenderExit(encoder, process.exitCode);
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
