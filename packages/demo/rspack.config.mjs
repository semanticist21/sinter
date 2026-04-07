import { fileURLToPath } from "node:url";

import { defineConfig } from "@rspack/cli";
import { rspack } from "@rspack/core";
import { ReactRefreshRspackPlugin } from "@rspack/plugin-react-refresh";

const isDev = process.env.NODE_ENV === "development";

export default defineConfig({
  entry: {
    main: "./src/main.tsx",
  },
  resolve: {
    // resolve against dist to simulate the published package
    alias: {
      "@sinter/module": fileURLToPath(new URL("../module/dist/index.mjs", import.meta.url)),
    },
    extensions: [".tsx", ".ts", ".jsx", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.(t|j)sx?$/,
        exclude: /node_modules/,
        use: {
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: "typescript",
                tsx: true,
              },
              transform: {
                react: {
                  runtime: "automatic",
                  development: isDev,
                  refresh: isDev,
                },
              },
            },
          },
        },
      },
      {
        test: /\.css$/,
        type: "css/auto",
        use: [
          {
            loader: "postcss-loader",
          },
        ],
      },
    ],
  },
  plugins: [
    new rspack.HtmlRspackPlugin({
      template: "./index.html",
    }),
    isDev && new ReactRefreshRspackPlugin(),
  ].filter(Boolean),
  experiments: {
    css: true,
  },
  devServer: {
    port: 4173,
    hot: true,
  },
});
