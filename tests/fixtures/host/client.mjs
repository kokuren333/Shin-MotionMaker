import { pathToFileURL } from "node:url";
const { startRun } = await import(pathToFileURL(process.argv[2]).href);
const context = { root: process.argv[3], requestDirectory: process.argv[3], restrictToRoot: true, allowDirs: [], allowEngineHosts: [], readOnly: false, enableGeneration: false, startedBy: "cli" };
console.log(JSON.stringify(await startRun(context, "qc", { job: "job & 全角 空白", stage: "pre" })));
