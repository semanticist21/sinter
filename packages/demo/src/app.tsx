import { type CodecMap, compress, type ImageFormat } from "@sinter/module";
import { Download, ImageDown, Upload } from "lucide-react";
import { type ChangeEvent, type DragEvent, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImageInfo {
  url: string;
  size: number;
  width: number;
  height: number;
  format: string;
}

interface Result {
  original: ImageInfo;
  compressed: ImageInfo;
  duration: number;
}

type FormatMode = "keep" | "to" | "allow";

const FORMAT_OPTIONS: ImageFormat[] = ["webp", "avif", "jpeg", "png"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

function detectFormatFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "JPEG",
    jpeg: "JPEG",
    png: "PNG",
    webp: "WebP",
    avif: "AVIF",
  };
  return map[ext] ?? ext.toUpperCase();
}

function mimeToLabel(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WebP",
    "image/avif": "AVIF",
  };
  return map[mime] ?? mime;
}

const FORMAT_LABEL: Record<ImageFormat, string> = {
  webp: "WebP",
  avif: "AVIF",
  jpeg: "JPEG",
  png: "PNG",
};

function fileToFormat(file: File | null): ImageFormat | null {
  if (!file) {
    return null;
  }

  const fromMime: Record<string, ImageFormat> = {
    "image/webp": "webp",
    "image/avif": "avif",
    "image/jpeg": "jpeg",
    "image/png": "png",
  };

  if (file.type in fromMime) {
    return fromMime[file.type];
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") {
    return "jpeg";
  }
  if (ext === "png" || ext === "webp" || ext === "avif") {
    return ext;
  }

  return null;
}

function getActiveFormats(
  file: File | null,
  formatMode: FormatMode,
  toFormat: ImageFormat,
  allowedFormats: ImageFormat[],
  fallbackFormat: ImageFormat
): ImageFormat[] {
  if (formatMode === "keep") {
    const inputFormat = fileToFormat(file);
    return inputFormat ? [inputFormat] : [];
  }

  if (formatMode === "to") {
    return [toFormat];
  }

  return [...new Set([...allowedFormats, fallbackFormat])];
}

function buildCodecOptions(
  activeFormats: ImageFormat[],
  webpLossless: boolean,
  avifSpeed: number,
  jpegProgressive: boolean
): Partial<CodecMap> {
  const options: Partial<CodecMap> = {};

  if (activeFormats.includes("webp")) {
    options.webp = { lossless: webpLossless };
  }
  if (activeFormats.includes("avif")) {
    options.avif = { speed: avifSpeed };
  }
  if (activeFormats.includes("jpeg")) {
    options.jpeg = { progressive: jpegProgressive };
  }

  return options;
}

function formatCodecOptionsSnippet(codecOptions: Partial<CodecMap>): string | null {
  const entries = Object.entries(codecOptions);
  if (entries.length === 0) {
    return null;
  }

  const lines = entries.flatMap(([format, options], index) => {
    const props = Object.entries(options).map(([key, value]) => `${key}: ${String(value)}`);
    const suffix = index === entries.length - 1 ? "" : ",";
    return [`    ${format}: { ${props.join(", ")} }${suffix}`];
  });

  return `  .codecOptions({\n${lines.join("\n")}\n  })`;
}

// Relaxed stage type for imperative (conditional) pipeline building in the demo.
// The library returns Omit<this, "method"> to prevent duplicate chained calls,
// but the demo calls methods one-by-one behind if-guards.
interface DemoStage {
  codecOptions(options: Partial<CodecMap>): unknown;
  maxQuality(value: number): unknown;
  dimensions(value: { width?: number; height?: number }): unknown;
  size(value: number, unit: "KB" | "MB"): unknown;
  run(): Promise<Blob>;
}

// ---------------------------------------------------------------------------
// Code snippet
// ---------------------------------------------------------------------------

function buildCodeSnippet(
  formatMode: FormatMode,
  toFormat: ImageFormat,
  allowedFormats: ImageFormat[],
  fallbackFormat: ImageFormat,
  codecOptions: Partial<CodecMap>,
  quality: number,
  width: string,
  height: string,
  sizeValue: string,
  sizeUnit: "KB" | "MB"
): string {
  const lines: string[] = ["compress(file)"];

  if (formatMode === "keep") {
    lines.push("  .keepFormat()");
  } else if (formatMode === "to") {
    lines.push(`  .toFormat("${toFormat}")`);
  } else {
    const allowed = allowedFormats.map(f => `"${f}"`).join(", ");
    lines.push(`  .allowFormats([${allowed}], "${fallbackFormat}")`);
  }

  const codecOptionsSnippet = formatCodecOptionsSnippet(codecOptions);
  if (codecOptionsSnippet) {
    lines.push(codecOptionsSnippet);
  }

  if (quality < 100) {
    lines.push(`  .maxQuality(${quality})`);
  }

  const w = width ? Number(width) : null;
  const h = height ? Number(height) : null;
  if (w && h) {
    lines.push(`  .dimensions({ width: ${w}, height: ${h} })`);
  } else if (w) {
    lines.push(`  .dimensions({ width: ${w} })`);
  } else if (h) {
    lines.push(`  .dimensions({ height: ${h} })`);
  }

  const sv = sizeValue ? Number(sizeValue) : null;
  if (sv && sv > 0) {
    lines.push(`  .size(${sv}, "${sizeUnit}")`);
  }

  lines.push("  .run();");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Format config
  const [formatMode, setFormatMode] = useState<FormatMode>("keep");
  const [toFormat, setToFormat] = useState<ImageFormat>("webp");
  const [allowedFormats, setAllowedFormats] = useState<ImageFormat[]>(["avif", "webp"]);
  const [fallbackFormat, setFallbackFormat] = useState<ImageFormat>("webp");
  const [webpLossless, setWebpLossless] = useState(false);
  const [avifSpeed, setAvifSpeed] = useState("8");
  const [jpegProgressive, setJpegProgressive] = useState(false);

  // Other options
  const [quality, setQuality] = useState(80);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [sizeValue, setSizeValue] = useState("");
  const [sizeUnit, setSizeUnit] = useState<"KB" | "MB">("KB");

  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<Result | null>(null);

  useEffect(() => {
    return () => {
      if (resultRef.current) {
        URL.revokeObjectURL(resultRef.current.original.url);
        URL.revokeObjectURL(resultRef.current.compressed.url);
      }
    };
  }, []);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f?.type.startsWith("image/")) {
        handleFile(f);
      }
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) {
        handleFile(f);
      }
    },
    [handleFile]
  );

  const toggleAllowedFormat = useCallback((fmt: ImageFormat) => {
    setAllowedFormats(prev => {
      if (prev.includes(fmt)) {
        return prev.filter(f => f !== fmt);
      }
      return [...prev, fmt];
    });
  }, []);

  const activeFormats = getActiveFormats(
    file,
    formatMode,
    toFormat,
    allowedFormats,
    fallbackFormat
  );
  const codecOptions = buildCodecOptions(
    activeFormats,
    webpLossless,
    Number(avifSpeed) || 0,
    jpegProgressive
  );

  const handleCompress = useCallback(async () => {
    if (!file) {
      return;
    }
    setProcessing(true);
    setError(null);

    if (resultRef.current) {
      URL.revokeObjectURL(resultRef.current.original.url);
      URL.revokeObjectURL(resultRef.current.compressed.url);
    }

    try {
      const originalUrl = URL.createObjectURL(file);
      const originalDims = await getImageDimensions(originalUrl);

      const start = performance.now();

      // Build pipeline based on format mode
      // Cast needed: demo calls methods conditionally (imperative style),
      // while the library uses Omit<this, ...> to prevent duplicate calls in chains.
      const stage = (
        formatMode === "keep"
          ? compress(file).keepFormat()
          : formatMode === "to"
            ? compress(file).toFormat(toFormat)
            : compress(file).allowFormats(allowedFormats, fallbackFormat)
      ) as DemoStage;

      if (Object.keys(codecOptions).length > 0) {
        stage.codecOptions(codecOptions);
      }

      if (quality < 100) {
        stage.maxQuality(quality);
      }

      const w = width ? Number(width) : null;
      const h = height ? Number(height) : null;
      if (w || h) {
        stage.dimensions({
          ...(w ? { width: w } : {}),
          ...(h ? { height: h } : {}),
        });
      }

      const sv = sizeValue ? Number(sizeValue) : null;
      if (sv && sv > 0) {
        stage.size(sv, sizeUnit);
      }

      const blob = await stage.run();
      const duration = performance.now() - start;

      const compressedUrl = URL.createObjectURL(blob);
      const compressedDims = await getImageDimensions(compressedUrl);

      const res: Result = {
        original: {
          url: originalUrl,
          size: file.size,
          width: originalDims.width,
          height: originalDims.height,
          format: detectFormatFromName(file.name),
        },
        compressed: {
          url: compressedUrl,
          size: blob.size,
          width: compressedDims.width,
          height: compressedDims.height,
          format: mimeToLabel(blob.type),
        },
        duration,
      };

      resultRef.current = res;
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  }, [
    file,
    formatMode,
    toFormat,
    allowedFormats,
    fallbackFormat,
    codecOptions,
    quality,
    width,
    height,
    sizeValue,
    sizeUnit,
  ]);

  const reduction = result
    ? Math.round((1 - result.compressed.size / result.original.size) * 100)
    : 0;

  const codeSnippet = buildCodeSnippet(
    formatMode,
    toFormat,
    allowedFormats,
    fallbackFormat,
    codecOptions,
    quality,
    width,
    height,
    sizeValue,
    sizeUnit
  );

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-20">
      {/* Header */}
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">sinter</h1>
        <p className="mt-1.5 text-muted-foreground">
          Browser image compression powered by WASM codecs
        </p>
      </header>

      {/* Drop zone */}
      <button
        type="button"
        onDragOver={e => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`mb-8 flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : file
              ? "border-border py-4 hover:border-primary/40"
              : "border-border py-12 hover:border-primary/40"
        } ${file ? "py-4" : "py-12"}`}
      >
        {file ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImageDown className="size-4" />
            <span className="font-medium text-foreground">{file.name}</span>
            <span>&middot;</span>
            <span>{formatBytes(file.size)}</span>
            <span>&middot;</span>
            <span className="text-xs">click to replace</span>
          </div>
        ) : (
          <>
            <Upload className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">Drop an image here, or click to browse</p>
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, AVIF</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={handleChange}
        />
      </button>

      {/* Options */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Options</CardTitle>
          <CardDescription>Configure the compression pipeline</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Format row */}
          <div className="space-y-3">
            <Label>Format strategy</Label>
            <div className="flex gap-2">
              {(["keep", "to", "allow"] as const).map(mode => (
                <Button
                  key={mode}
                  variant={formatMode === mode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormatMode(mode)}
                >
                  {mode === "keep" ? "keepFormat" : mode === "to" ? "toFormat" : "allowFormats"}
                </Button>
              ))}
            </div>

            {/* toFormat picker */}
            {formatMode === "to" && (
              <Select value={toFormat} onValueChange={v => setToFormat(v as ImageFormat)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map(f => (
                    <SelectItem key={f} value={f}>
                      {FORMAT_LABEL[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* allowFormats picker */}
            {formatMode === "allow" && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {FORMAT_OPTIONS.map(f => (
                    <Button
                      key={f}
                      variant={allowedFormats.includes(f) ? "default" : "outline"}
                      size="xs"
                      onClick={() => toggleAllowedFormat(f)}
                    >
                      {FORMAT_LABEL[f]}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">fallback:</span>
                  <Select
                    value={fallbackFormat}
                    onValueChange={v => setFallbackFormat(v as ImageFormat)}
                  >
                    <SelectTrigger className="w-28 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAT_OPTIONS.map(f => (
                        <SelectItem key={f} value={f}>
                          {FORMAT_LABEL[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label>Codec options</Label>
            {activeFormats.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Upload an image to configure codec-specific options for `keepFormat()`.
              </p>
            ) : activeFormats.every(format => format === "png") ? (
              <p className="text-sm text-muted-foreground">PNG has no codec-specific options.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {activeFormats.includes("webp") && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">WebP lossless</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={webpLossless ? "outline" : "default"}
                        size="sm"
                        onClick={() => setWebpLossless(false)}
                      >
                        Lossy
                      </Button>
                      <Button
                        variant={webpLossless ? "default" : "outline"}
                        size="sm"
                        onClick={() => setWebpLossless(true)}
                      >
                        Lossless
                      </Button>
                    </div>
                  </div>
                )}

                {activeFormats.includes("avif") && (
                  <div className="space-y-2">
                    <Label htmlFor="avif-speed" className="text-xs text-muted-foreground">
                      AVIF speed
                    </Label>
                    <Input
                      id="avif-speed"
                      type="number"
                      min={0}
                      max={10}
                      value={avifSpeed}
                      onChange={e => setAvifSpeed(e.target.value)}
                    />
                  </div>
                )}

                {activeFormats.includes("jpeg") && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">JPEG scan mode</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={jpegProgressive ? "outline" : "default"}
                        size="sm"
                        onClick={() => setJpegProgressive(false)}
                      >
                        Baseline
                      </Button>
                      <Button
                        variant={jpegProgressive ? "default" : "outline"}
                        size="sm"
                        onClick={() => setJpegProgressive(true)}
                      >
                        Progressive
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Other options row */}
          <div className="grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3">
            {/* Quality */}
            <div className="space-y-2">
              <Label>
                Quality <span className="font-normal text-muted-foreground">{quality}</span>
              </Label>
              <div className="flex h-9 items-center">
                <Slider
                  min={1}
                  max={100}
                  step={1}
                  value={[quality]}
                  onValueChange={([v]) => setQuality(v)}
                />
              </div>
            </div>

            {/* Dimensions */}
            <div className="space-y-2">
              <Label>Dimensions</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  placeholder="W"
                  value={width}
                  onChange={e => setWidth(e.target.value)}
                  min={1}
                  className="text-center"
                />
                <span className="shrink-0 text-xs text-muted-foreground">&times;</span>
                <Input
                  type="number"
                  placeholder="H"
                  value={height}
                  onChange={e => setHeight(e.target.value)}
                  min={1}
                  className="text-center"
                />
              </div>
            </div>

            {/* Size limit */}
            <div className="space-y-2">
              <Label>Size limit</Label>
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  placeholder="—"
                  value={sizeValue}
                  onChange={e => setSizeValue(e.target.value)}
                  min={1}
                  className="min-w-0 flex-1"
                />
                <Select value={sizeUnit} onValueChange={v => setSizeUnit(v as "KB" | "MB")}>
                  <SelectTrigger className="w-[4.5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KB">KB</SelectItem>
                    <SelectItem value="MB">MB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compress button */}
      <div className="mb-10">
        <Button onClick={handleCompress} disabled={!file || processing} size="lg">
          {processing ? "Compressing…" : "Compress"}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-8 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <Card className="mb-10">
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
            <CardDescription className="flex items-center gap-2">
              {reduction > 0 ? (
                <span className="font-semibold text-primary">{reduction}% smaller</span>
              ) : reduction === 0 ? (
                <span className="font-semibold text-muted-foreground">same size</span>
              ) : (
                <span className="font-semibold text-destructive">
                  {Math.abs(reduction)}% larger
                </span>
              )}
              <span>&middot;</span>
              <span>{Math.round(result.duration)}ms</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {/* Original */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Original
                </p>
                <div className="mb-3 overflow-hidden rounded-lg border bg-muted/30">
                  <div className="flex aspect-video items-center justify-center">
                    <img
                      src={result.original.url}
                      alt="Original"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Size</dt>
                    <dd className="font-medium tabular-nums">
                      {formatBytes(result.original.size)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Dimensions</dt>
                    <dd className="tabular-nums">
                      {result.original.width} &times; {result.original.height}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Format</dt>
                    <dd>{result.original.format}</dd>
                  </div>
                </dl>
              </div>

              {/* Compressed */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Compressed
                </p>
                <div className="mb-3 overflow-hidden rounded-lg border bg-muted/30">
                  <div className="flex aspect-video items-center justify-center">
                    <img
                      src={result.compressed.url}
                      alt="Compressed"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Size</dt>
                    <dd className="font-medium tabular-nums">
                      {formatBytes(result.compressed.size)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Dimensions</dt>
                    <dd className="tabular-nums">
                      {result.compressed.width} &times; {result.compressed.height}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Format</dt>
                    <dd>{result.compressed.format}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Download */}
            <div className="mt-5 border-t pt-4">
              <Button variant="outline" size="sm" asChild={true}>
                <a
                  href={result.compressed.url}
                  download={`compressed.${result.compressed.format.toLowerCase()}`}
                >
                  <Download className="size-3.5" />
                  Download
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Code snippet */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Code
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-card p-4 font-mono text-sm leading-relaxed text-foreground">
          <code>{codeSnippet}</code>
        </pre>
      </div>
    </main>
  );
}
