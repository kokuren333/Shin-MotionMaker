// Vite configuration shared by the dev server and scripts/site.mjs.
// base "./" keeps every asset reference relative, so the same build works at
// the site root, under /Shin-MotionMaker/ on GitHub Pages and from a local server (GU-15).
import { fileURLToPath } from "node:url";

const gui = fileURLToPath(new URL("./", import.meta.url));
const repository = fileURLToPath(new URL("../", import.meta.url));

export default {
  root: gui,
  base: "./",
  publicDir: "public",
  // The GUI reads src/core, job-template and job-assets/fonts from the repository root.
  server: { fs: { strict: true, allow: [repository] } },
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 4096 },
  define: {
    __SMM_BUILD__: JSON.stringify({ commit: "dev", built_at: null }),
  },
};
