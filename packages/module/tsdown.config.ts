import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    dts: true,
    format: ["esm"],
    clean: true,
    outDir: "dist",
    external: ["upng-js"],
  },
  {
    entry: ["src/worker.ts"],
    dts: false,
    format: ["esm"],
    outDir: "dist",
    external: ["upng-js"],
  },
]);
