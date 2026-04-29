import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const MODULE_ROOT = resolve(import.meta.dir, "..");
const REPO_ROOT = resolve(MODULE_ROOT, "../..");
const CRATE_ROOT = join(MODULE_ROOT, "native", "png");
const BUILD_DIR = join(MODULE_ROOT, "native", "build", "png");
const TARGET_DIR = join(BUILD_DIR, "cargo-target");
const CARGO_WASM = join(TARGET_DIR, "wasm32-wasip1", "release", "sinter_png.wasm");
const WASM_OUT = join(BUILD_DIR, "png.wasm");
const SOURCE_WASM = join(MODULE_ROOT, "src", "codecs", "png.wasm");
const DIST_WASM = join(MODULE_ROOT, "dist", "png.wasm");

const copyDistOnly = process.argv.includes("--copy-dist");

if (copyDistOnly) {
  await copyIfExists(WASM_OUT, DIST_WASM);
  process.exit(0);
}

await ensureCargo();
await ensureWasiTarget();
await mkdir(BUILD_DIR, { recursive: true });
await buildPngWasm();
await copyFile(CARGO_WASM, WASM_OUT);
await copyFile(WASM_OUT, SOURCE_WASM);

async function ensureCargo(): Promise<void> {
  const result = await run("cargo", ["--version"], { allowFailure: true });
  if (!result.ok) {
    throw new Error("cargo is required to build the native PNG WASM codec.");
  }
}

async function ensureWasiTarget(): Promise<void> {
  const result = await run("rustup", ["target", "list", "--installed"], { allowFailure: true });
  if (!result.ok || !result.stdout.split("\n").includes("wasm32-wasip1")) {
    throw new Error("Rust target wasm32-wasip1 is required. Run `rustup target add wasm32-wasip1`.");
  }
}

async function buildPngWasm(): Promise<void> {
  await run("cargo", [
    "build",
    "--locked",
    "--manifest-path",
    join(CRATE_ROOT, "Cargo.toml"),
    "--target",
    "wasm32-wasip1",
    "--release",
  ], {
    env: {
      CARGO_TARGET_DIR: TARGET_DIR,
    },
  });
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
  options: { allowFailure?: boolean; env?: Record<string, string> } = {}
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const proc = Bun.spawn([command, ...args], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      ...options.env,
    },
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
