import JSZip from "jszip";
import type { MotionForm } from "./form.ts";
import type { BuiltJob, JobAssets, TemplateFiles } from "./types.ts";
import { buildJobFiles } from "./job-files.ts";
import { assertJobPath } from "./template-paths.ts";

export async function zipJobFiles(job: BuiltJob, progress?: (percent: number) => void): Promise<{
  filename: string; data: Uint8Array;
}> {
  assertJobPath(job.rootName);
  const zip = new JSZip();
  const root = zip.folder(job.rootName)!;
  for (const [name, data] of Object.entries(job.files)) {
    assertJobPath(name);
    root.file(name, data);
  }
  return {
    filename: job.filename,
    data: await zip.generateAsync({
      type: "uint8array", platform: "UNIX", streamFiles: true,
      compression: "DEFLATE", compressionOptions: { level: 6 },
    }, (meta) => progress?.(Math.round(meta.percent))),
  };
}

export async function generateJob(form: MotionForm, assets: JobAssets, templates: TemplateFiles,
  progress?: (percent: number) => void): Promise<{ filename: string; data: Uint8Array }> {
  return zipJobFiles(await buildJobFiles(form, assets, templates), progress);
}
