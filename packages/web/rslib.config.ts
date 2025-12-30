import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [
    {
      format: "esm",
      syntax: "esnext",
    },
  ],
  source: {
    entry: {
      index: "./src/index.ts",
    },
  },
});
