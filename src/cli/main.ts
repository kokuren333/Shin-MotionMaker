#!/usr/bin/env node
import { runApplication } from "../main.ts";

process.exitCode = await runApplication(process.argv.slice(2), process.cwd(), {
  stdout: (text) => { process.stdout.write(text); },
  stderr: (text) => { process.stderr.write(text); },
});
