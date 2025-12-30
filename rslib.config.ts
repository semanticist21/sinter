import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [
    {
      format: "esm",
      syntax: "esnext",
      output: {
        distPath: "./dist",
      },
    },
    {
      format: "cjs",
      syntax: "esnext",
      output: {
        distPath: "./dist",
      },
    },
  ],
  source: {
    entry: {
      index: "./src/index.ts",
    },
  },
});
