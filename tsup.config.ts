import { defineConfig } from "tsup";

export default defineConfig([
  // CLI entry point - with shebang for executable
  {
    entry: {
      "cli/index": "src/cli/index.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    target: "node20",
    outDir: "dist",
    shims: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  // Library entry points - no shebang
  {
    entry: {
      index: "src/index.ts",
      "plugin/index": "src/plugin/index.ts",
    },
    format: ["esm"],
    dts: true,
    clean: false, // Don't clean again, CLI build already cleaned
    sourcemap: true,
    splitting: false,
    treeshake: true,
    target: "node20",
    outDir: "dist",
    shims: true,
  },
]);
