import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const MODULE_ROOT = resolve(import.meta.dir, "..");
const REPO_ROOT = resolve(MODULE_ROOT, "../..");
const CACHE_ROOT = join(homedir(), ".cache", "sinter");
const LIBWEBP_VERSION = "1.6.0";
const LIBWEBP_URL = `https://github.com/webmproject/libwebp/archive/refs/tags/v${LIBWEBP_VERSION}.tar.gz`;
const LIBWEBP_SHA256 = "93a852c2b3efafee3723efd4636de855b46f9fe1efddd607e1f42f60fc8f2136";
const LIBWEBP_ARCHIVE = join(CACHE_ROOT, `libwebp-${LIBWEBP_VERSION}.tar.gz`);
const LIBWEBP_SOURCE_DIR = join(CACHE_ROOT, `libwebp-${LIBWEBP_VERSION}`);
const LIBWEBP_SOURCE_MARKER = join(LIBWEBP_SOURCE_DIR, ".sinter-source.sha256");
const BUILD_DIR = join(MODULE_ROOT, "native", "build", "webp");
const OBJECT_DIR = join(BUILD_DIR, "objects");
const WASM_OUT = join(BUILD_DIR, "webp.wasm");
const SOURCE_WASM = join(MODULE_ROOT, "src", "codecs", "webp.wasm");
const DIST_WASM = join(MODULE_ROOT, "dist", "webp.wasm");

const copyDistOnly = process.argv.includes("--copy-dist");

if (copyDistOnly) {
  await copyIfExists(WASM_OUT, DIST_WASM);
  process.exit(0);
}

const zig = await findZig();
await ensureLibwebpSource();
await buildWebpWasm(zig);
await copyFile(WASM_OUT, SOURCE_WASM);

async function findZig(): Promise<string> {
  const candidates = [
    process.env.ZIG,
    await commandPath("zig"),
    join(homedir(), ".local", "bin", "zig"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const result = await run(candidate, ["version"], { allowFailure: true });
    if (result.ok && result.stdout.trim() === "0.16.0") {
      return candidate;
    }
  }

  throw new Error(
    "zig 0.16.0 is required. Install it with `brew install zig` or set ZIG=/path/to/zig."
  );
}

async function ensureLibwebpSource(): Promise<void> {
  await mkdir(CACHE_ROOT, { recursive: true });
  if (!(await archiveMatches())) {
    await downloadFile(LIBWEBP_URL, LIBWEBP_ARCHIVE);
  }
  if (!(await archiveMatches())) {
    throw new Error(`libwebp archive checksum did not match ${LIBWEBP_SHA256}.`);
  }

  if (
    (await exists(join(LIBWEBP_SOURCE_DIR, "src", "webp", "encode.h"))) &&
    (await markerMatches())
  ) {
    return;
  }

  const tmp = join(CACHE_ROOT, `libwebp-${LIBWEBP_VERSION}-tmp`);
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  await run("tar", ["-xzf", LIBWEBP_ARCHIVE, "-C", tmp, "--strip-components", "1"]);
  await Bun.write(join(tmp, ".sinter-source.sha256"), `${LIBWEBP_SHA256}\n`);
  await rm(LIBWEBP_SOURCE_DIR, { recursive: true, force: true });
  await run("mv", [tmp, LIBWEBP_SOURCE_DIR]);
}

async function buildWebpWasm(zig: string): Promise<void> {
  await rm(BUILD_DIR, { recursive: true, force: true });
  await mkdir(OBJECT_DIR, { recursive: true });

  const sources = await sourceFiles(join(LIBWEBP_SOURCE_DIR, "src"), join(LIBWEBP_SOURCE_DIR, "sharpyuv"));
  const objects: string[] = [];
  for (const source of sources) {
    const object = join(OBJECT_DIR, `${basename(source)}-${objects.length}.o`);
    await compileObject(zig, source, object);
    objects.push(object);
  }

  await run(zig, [
    "cc",
    "-target",
    "wasm32-wasi",
    "-O3",
    "-g0",
    "-DNDEBUG=1",
    "-D_THREAD_SAFE=1",
    "-DWEBP_USE_THREAD=0",
    "-I",
    LIBWEBP_SOURCE_DIR,
    join(MODULE_ROOT, "native", "webp", "sinter_webp.c"),
    ...objects,
    "-Wl,--no-entry",
    "-Wl,--export-memory",
    "-Wl,--export=sinter_webp_malloc",
    "-Wl,--export=sinter_webp_free",
    "-Wl,--export=sinter_webp_decode",
    "-Wl,--export=sinter_webp_encode",
    "-Wl,--export=sinter_webp_result_ptr",
    "-Wl,--export=sinter_webp_result_len",
    "-Wl,--export=sinter_webp_result_width",
    "-Wl,--export=sinter_webp_result_height",
    "-Wl,--export=sinter_webp_release_result",
    "-Wl,--initial-memory=33554432",
    "-Wl,--max-memory=268435456",
    "-Wl,--strip-all",
    "-o",
    WASM_OUT,
  ]);
}

async function compileObject(zig: string, source: string, object: string): Promise<void> {
  await run(zig, [
    "cc",
    "-target",
    "wasm32-wasi",
    "-O3",
    "-g0",
    "-DNDEBUG=1",
    "-D_THREAD_SAFE=1",
    "-DWEBP_USE_THREAD=0",
    "-I",
    LIBWEBP_SOURCE_DIR,
    "-c",
    source,
    "-o",
    object,
  ]);
}

async function sourceFiles(...roots: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const root of roots) {
    await collectSources(root, files);
  }
  return files.sort();
}

async function collectSources(dir: string, files: string[]): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectSources(path, files);
    } else if (entry.isFile() && entry.name.endsWith(".c")) {
      files.push(path);
    }
  }
}

async function archiveMatches(): Promise<boolean> {
  if (!(await exists(LIBWEBP_ARCHIVE))) {
    return false;
  }
  const bytes = await readFile(LIBWEBP_ARCHIVE);
  return createHash("sha256").update(bytes).digest("hex") === LIBWEBP_SHA256;
}

async function markerMatches(): Promise<boolean> {
  try {
    return (await readFile(LIBWEBP_SOURCE_MARKER, "utf8")).trim() === LIBWEBP_SHA256;
  } catch {
    return false;
  }
}

async function downloadFile(url: string, to: string): Promise<void> {
  await run("curl", ["-L", url, "-o", to]);
}

async function commandPath(command: string): Promise<string | undefined> {
  const result = await run("which", [command], { allowFailure: true });
  return result.ok ? result.stdout.trim() : undefined;
}

async function copyIfExists(from: string, to: string): Promise<void> {
  if (!(await exists(from))) {
    throw new Error(`Missing ${from}; run \`bun run build:native\` first.`);
  }
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function run(
  command: string,
  args: string[],
  options: { allowFailure?: boolean } = {}
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const proc = Bun.spawn([command, ...args], {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0 && !options.allowFailure) {
    throw new Error(
      [`Command failed (${exitCode}): ${command} ${args.join(" ")}`, stdout, stderr]
        .filter(Boolean)
        .join("\n")
    );
  }

  return { ok: exitCode === 0, stdout, stderr };
}
