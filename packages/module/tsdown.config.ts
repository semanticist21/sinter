import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    dts: true,
    format: ["esm"],
    platform: "browser",
    fixedExtension: true,
    clean: true,
    outDir: "dist",
    deps: {
      neverBundle: ["upng-js"],
    },
  },
  {
    entry: ["src/worker.ts"],
    dts: false,
    format: ["esm"],
    platform: "browser",
    fixedExtension: true,
    outDir: "dist",
    deps: {
      alwaysBundle: ["upng-js"],
      onlyBundle: ["upng-js", "pako"],
    },
    outputOptions: {
      codeSplitting: false,
    },
  },
]);
