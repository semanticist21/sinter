const std = @import("std");

extern fn consoleLog(ptr: [*]const u8, len: usize) void;

fn log(msg: []const u8) void {
    consoleLog(msg.ptr, msg.len);
}

export fn greet() void {
    log("Hello from Zig WASM!");
}
