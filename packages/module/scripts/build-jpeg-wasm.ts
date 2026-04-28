import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const MODULE_ROOT = resolve(import.meta.dir, "..");
const REPO_ROOT = resolve(MODULE_ROOT, "../..");
const CACHE_ROOT = join(homedir(), ".cache", "sinter");
const MOZJPEG_VERSION = "4.1.5";
const MOZJPEG_TAG = `v${MOZJPEG_VERSION}`;
const MOZJPEG_COMMIT = "6c9f0897afa1c2738d7222a0a9ab49e8b536a267";
const MOZJPEG_SOURCE_DIR = join(CACHE_ROOT, `mozjpeg-${MOZJPEG_VERSION}`);
const BUILD_DIR = join(MODULE_ROOT, "native", "build", "jpeg");
const WASM_OUT = join(BUILD_DIR, "jpeg.wasm");
const SOURCE_WASM = join(MODULE_ROOT, "src", "codecs", "jpeg.wasm");
const DIST_WASM = join(MODULE_ROOT, "dist", "jpeg.wasm");
const WASM_C_FLAGS = "-DNO_GETENV -DNO_PUTENV";
const JPEG_SOURCES = [
  "jcapimin.c",
  "jcapistd.c",
  "jccoefct.c",
  "jccolor.c",
  "jcdctmgr.c",
  "jchuff.c",
  "jcext.c",
  "jcicc.c",
  "jcinit.c",
  "jcmainct.c",
  "jcmarker.c",
  "jcmaster.c",
  "jcomapi.c",
  "jcparam.c",
  "jcphuff.c",
  "jcprepct.c",
  "jcsample.c",
  "jctrans.c",
  "jdapimin.c",
  "jdapistd.c",
  "jdatadst.c",
  "jdatasrc.c",
  "jdcoefct.c",
  "jdcolor.c",
  "jddctmgr.c",
  "jdhuff.c",
  "jdicc.c",
  "jdinput.c",
  "jdmainct.c",
  "jdmarker.c",
  "jdmaster.c",
  "jdmerge.c",
  "jdphuff.c",
  "jdpostct.c",
  "jdsample.c",
  "jdtrans.c",
  "jerror.c",
  "jfdctflt.c",
  "jfdctfst.c",
  "jfdctint.c",
  "jidctflt.c",
  "jidctfst.c",
  "jidctint.c",
  "jidctred.c",
  "jquant1.c",
  "jquant2.c",
  "jutils.c",
  "jmemmgr.c",
  "jmemnobs.c",
  "jsimd_none.c",
] as const;

const copyDistOnly = process.argv.includes("--copy-dist");

if (copyDistOnly) {
  await copyIfExists(WASM_OUT, DIST_WASM);
  process.exit(0);
}

const zig = await findZig();
await ensureMozjpegSource();
await buildMozjpeg(zig);
const objects = await compileMozjpegObjects(zig);
await linkWasm(zig, objects);
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

async function ensureMozjpegSource(): Promise<void> {
  if (
    (await exists(join(MOZJPEG_SOURCE_DIR, "CMakeLists.txt"))) &&
    (await gitHeadMatches(MOZJPEG_SOURCE_DIR, MOZJPEG_COMMIT))
  ) {
    return;
  }

  await mkdir(CACHE_ROOT, { recursive: true });
  const tmp = join(CACHE_ROOT, `mozjpeg-${MOZJPEG_VERSION}-tmp`);
  await rm(tmp, { recursive: true, force: true });

  await run("git", [
    "clone",
    "--depth",
    "1",
    "--branch",
    MOZJPEG_TAG,
    "https://github.com/mozilla/mozjpeg.git",
    tmp,
  ]);
  await run("git", ["-C", tmp, "checkout", "--detach", MOZJPEG_COMMIT]);
  if (!(await gitHeadMatches(tmp, MOZJPEG_COMMIT))) {
    throw new Error(`MozJPEG checkout did not match pinned commit ${MOZJPEG_COMMIT}.`);
  }
  await rm(MOZJPEG_SOURCE_DIR, { recursive: true, force: true });
  await run("mv", [tmp, MOZJPEG_SOURCE_DIR]);
}

async function buildMozjpeg(zig: string): Promise<void> {
  await rm(BUILD_DIR, { recursive: true, force: true });
  await mkdir(BUILD_DIR, { recursive: true });

  const toolchain = join(BUILD_DIR, "zig-wasi-toolchain.cmake");
  const ccWrapper = join(BUILD_DIR, "zig-cc");
  await writeFile(ccWrapper, `#!/bin/sh\nexec "${zig}" cc -target wasm32-wasi "$@"\n`);
  await run("chmod", ["755", ccWrapper]);

  await writeFile(
    toolchain,
    [
      "set(CMAKE_SYSTEM_NAME WASI)",
      "set(CMAKE_SYSTEM_PROCESSOR wasm32)",
      `set(CMAKE_C_COMPILER "${escapeCmake(ccWrapper)}")`,
      "set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)",
      "",
    ].join("\n")
  );

  await run("cmake", [
    "-S",
    MOZJPEG_SOURCE_DIR,
    "-B",
    BUILD_DIR,
    "-G",
    "Unix Makefiles",
    `-DCMAKE_TOOLCHAIN_FILE=${toolchain}`,
    "-DCMAKE_POLICY_VERSION_MINIMUM=3.5",
    "-DCMAKE_BUILD_TYPE=Release",
    "-DENABLE_SHARED=OFF",
    "-DENABLE_STATIC=ON",
    "-DWITH_TURBOJPEG=ON",
    "-DWITH_SIMD=OFF",
    "-DWITH_JAVA=OFF",
    "-DWITH_ARITH_ENC=OFF",
    "-DWITH_ARITH_DEC=OFF",
    "-DPNG_SUPPORTED=OFF",
    `-DCMAKE_C_FLAGS=${WASM_C_FLAGS}`,
  ]);

}

async function compileMozjpegObjects(zig: string): Promise<string[]> {
  const objectDir = join(BUILD_DIR, "objects");
  await mkdir(objectDir, { recursive: true });

  const objects: string[] = [];
  for (const source of JPEG_SOURCES) {
    const object = join(objectDir, `${source}.o`);
    await run(zig, [
      "cc",
      "-target",
      "wasm32-wasi",
      "-O3",
      "-g0",
      "-DNDEBUG",
      "-DNO_GETENV",
      "-DNO_PUTENV",
      "-I",
      MOZJPEG_SOURCE_DIR,
      "-I",
      BUILD_DIR,
      "-c",
      join(MOZJPEG_SOURCE_DIR, source),
      "-o",
      object,
    ]);
    objects.push(object);
  }

  return objects;
}

async function linkWasm(zig: string, objects: string[]): Promise<void> {
  const wrapper = join(MODULE_ROOT, "native", "jpeg", "sinter_jpeg.c");

  await run(zig, [
    "cc",
    "-target",
    "wasm32-wasi",
    "-O3",
    "-g0",
    "-DNO_GETENV",
    "-DNO_PUTENV",
    "-I",
    MOZJPEG_SOURCE_DIR,
    "-I",
    BUILD_DIR,
    wrapper,
    ...objects,
    "-Wl,--no-entry",
    "-Wl,--export-memory",
    "-Wl,--export=sinter_jpeg_malloc",
    "-Wl,--export=sinter_jpeg_free",
    "-Wl,--export=sinter_jpeg_decode",
    "-Wl,--export=sinter_jpeg_encode",
    "-Wl,--export=sinter_jpeg_result_ptr",
    "-Wl,--export=sinter_jpeg_result_len",
    "-Wl,--export=sinter_jpeg_result_width",
    "-Wl,--export=sinter_jpeg_result_height",
    "-Wl,--export=sinter_jpeg_release_result",
    "-Wl,--initial-memory=33554432",
    "-Wl,--max-memory=268435456",
    "-Wl,--strip-all",
    "-o",
    WASM_OUT,
  ]);
}

async function commandPath(command: string): Promise<string | undefined> {
  const result = await run("which", [command], { allowFailure: true });
  return result.ok ? result.stdout.trim() : undefined;
}

async function gitHeadMatches(path: string, commit: string): Promise<boolean> {
  const result = await run("git", ["-C", path, "rev-parse", "HEAD"], { allowFailure: true });
  return result.ok && result.stdout.trim() === commit;
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

function escapeCmake(path: string): string {
  return path.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
