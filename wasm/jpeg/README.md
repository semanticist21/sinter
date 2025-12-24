# JPEG wasm modules

Two single-purpose translation units expose the primitives used by the higher-level
TypeScript API once compiled with Emscripten:

- `jpeg_decode(const uint8_t *buffer, uint32_t length)` – reads JPEG/JFIF bytes and
  returns an RGBA buffer (4 channels) together with the decoded dimensions **and**, when
  present, the raw EXIF APP1 payload. Each returned pointer (`data`, `exif_data`) is owned
  by the module and must be released via `jpeg_decode_free`.
- `jpeg_encode(const uint8_t *pixels, uint32_t width, uint32_t height, uint32_t channels, int quality)` –
  accepts 3-channel RGB or 4-channel RGBA pixels, ignoring alpha for encoding, and
  returns a JPEG blob. The buffer is freed with `jpeg_encode_free`.

Both files use libjpeg and are annotated with `EMSCRIPTEN_KEEPALIVE` so the symbols remain
reachable from JavaScript once compiled to WebAssembly.
