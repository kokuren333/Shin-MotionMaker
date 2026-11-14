import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";

// Fail only the detached worker launch, leaving process inspection available.
const spawn = childProcess.spawn;
childProcess.spawn = (file, args, options) => {
  if (options?.detached) return spawn(file + ".missing-worker", args, options);
  return spawn(file, args, options);
};
syncBuiltinESMExports();
