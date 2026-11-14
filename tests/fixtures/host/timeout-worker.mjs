import { pathToFileURL } from "node:url";
const { runWorker } = await import(pathToFileURL(process.argv[2]).href);
await runWorker(process.argv[3], process.argv[4], 500);
