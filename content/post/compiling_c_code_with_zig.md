---
title: Compiling C code with Zig
---


### This doesn't cover cross-compiling to other targets. 

We will only focus on creating libraries and executables on the same platform. 

This small intro covers creating
1. A static library
2. A shared (dynamic) library
3. and an executable 

I wrote a build file in Zig to built the `whisper` executable in the `whisper.cpp` repo by Greg Gregarinov. This project is a good intro to compiling C/C++ code with Zig.
`whisper.cpp` involves using
1. ggml - A c library for tensor/matrix operations. This library consists of a `.c` file and a corresponding header file.
2. whisper.cpp - A cpp library that can be used for audio transcription 
3. A main file from `main.cpp` and `common.cpp` that uses the previously built `whisper.cpp`

`ggml` performs a lot of intensive math operations, so on each platform we will have to leverage the platform's SIMD intrinsics or special Matrix libraries if available. 

The `builtin` package/library in Zig provides information about the system the program is running in via [this](https://github.com/ziglang/zig/blob/8d6336420b937075e3363f9548adb0092af7f819/src/Compilation.zig#L5083) fn , which is called by [this](https://github.com/ziglang/zig/blob/8d6336420b937075e3363f9548adb0092af7f819/src/Compilation.zig#L3500) in the [main](https://github.com/ziglang/zig/blob/8d6336420b937075e3363f9548adb0092af7f819/src/Compilation.zig#L3008) thread, when we call zig build or `zig build-exe`

1. Based on the `cpu` of the platform (`builtin.cpu`) we decide the C and the C++ flags we need to pass to the compiler 
2. If an accelerator has to be used (Accelerate in macos or OpenBLAS) we also set the corresponding flags. The usage of these accelerators is controlled by passing an option to `zig build` using `zig build -Doption=val`. In our file, for example, setting `-Dmacos_accelerate=true` enables the usage of the AI accelerator in macos. 

We then build a bunch of intermediate object files that will be linked into the static, dynamic and main executables. 
```
    const ggmlObject = b.addObject(.{
        .name = "ggml.o",
        .target = target,
        .optimize = optimize,
    });
    ggmlObject.addIncludePath("./"); 
ggmlObject.addIncludePath("/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include");
    ggmlObject.addCSourceFiles(&.{
        "ggml.c",
    }, c_flags.items);
```
This for example, builds the `ggml` object file from our ggml source code with the C flags we have defined. 
We then build a `whisper` object and then use them both in each of the shared library, static library and the executable. 

We can only install artifacts that are either a shared,static library or an executable file. We **cannot `install` any intermediate object files that were created by Zig** 

To procedurally instruct Zig build to install these files, using `std.build.Builder.installArtifact`

```
var lib_dynamic = b.addSharedLibrary(.{ .name = "whisper", .optimize = optimize, .target = target });
    lib_dynamic.addObject(ggmlObject);
    lib_dynamic.addObject(whisperObject);
    b.installArtifact(lib_dynamic);
    b.installArtifact(lib_static_library);
    b.installArtifact(mainFile);
```

```
const std = @import("std");
const builtin = @import("builtin");

pub fn build(b: *std.build.Builder) !void {
    var basic_cflags = [_][]const u8{ "-I.", "-O3", "-std=c11", "-fPIC", "-pthread" };
    var basic_cppflags = .{ "-I.", "-I./examples", "-O3", "-std=c++11", "-fPIC", "-pthread" };
    var alloc = b.allocator;
    var c_flags = std.ArrayList([]const u8).init(alloc);
    var cpp_flags = std.ArrayList([]const u8).init(alloc);
    defer c_flags.deinit();
    defer cpp_flags.deinit();
    try c_flags.appendSlice(&basic_cflags);
    try cpp_flags.appendSlice(&basic_cppflags);

    const target = b.standardTargetOptions(.{});

    var target_cpu = builtin.cpu;
    var all_features = target_cpu.features;
    if (target_cpu.arch.isX86()) {
        const x86_target = std.Target.x86;
        if (x86_target.featureSetHas(all_features, x86_target.Feature.f16c)) {
            try c_flags.append("-mf16c");
        }
        if (x86_target.featureSetHas(all_features, x86_target.Feature.fma)) {
            try c_flags.append("-mfma");
        }

        if (x86_target.featureSetHas(all_features, x86_target.Feature.avx)) {
            try c_flags.append("-mavx");
        }

        if (x86_target.featureSetHas(all_features, x86_target.Feature.avx2)) {
            try c_flags.append("-mavx2");
        }

        if (x86_target.featureSetHas(all_features, x86_target.Feature.sse3)) {
            try c_flags.append("-msse3");
        }
    }
    if (target_cpu.arch.isPPC64()) {
        const ppc64_target = std.Target.powerpc;
        if (ppc64_target.featureSetHas(all_features, ppc64_target.Feature.power9_vector)) {
            try c_flags.append("-mpower9-vector");
        }
        try cpp_flags.append("-std=c++23");
        try cpp_flags.append("-DGGML_BIG_ENDIAN");
    }

    var maybe_use_accelerate = b.option(bool, "macos_accelerate", "use the accelerate framework in macOS (if available) for ML models");
    if (maybe_use_accelerate) |use_accelerate| {
        if (use_accelerate) {
            try c_flags.append("-DGGML_USE_ACCELERATE");
        }
    }

    var maybe_use_openblas = b.option(bool, "use_openblas", "use open BLAS when available");
    if (maybe_use_openblas) |use_openblas| {
        if (use_openblas) {
            try c_flags.appendSlice(&.{ "-DGGML_USE_OPENBLAS", "-I/usr/local/include/openblas" });
        }
    }
    var maybe_use_gprof = b.option(bool, "gprof", "use gnu prof");
    if (maybe_use_gprof) |use_gprof| {
        if (use_gprof) {
            try c_flags.append("-pg");
            try cpp_flags.append("-pg");
        }
    }

    if (!target_cpu.arch.isAARCH64()) {
        try c_flags.append("-mcpu=native");
        try cpp_flags.append("-mcpu=native");
    }

    if (target_cpu.arch.isARM()) {
        if (!std.mem.startsWith(u8, target_cpu.model.name, "armv6")) {
            try c_flags.appendSlice(&.{ "-mfpu=neon-fp-armv8", "-mfp16-format=ieee", "-mno-unaligned-access" });
        }
        if (!std.mem.startsWith(u8, target_cpu.model.name, "armv7")) {
            try c_flags.appendSlice(&.{ "-mfpu=neon-fp-armv8", "-mfp16-format=ieee", "-mno-unaligned-access", "-funsafe-math-optimizations" });
        }

        if (!std.mem.startsWith(u8, target_cpu.model.name, "armv8")) {
            try c_flags.appendSlice(&.{ "-mfp16-format=ieee", "-mno-unaligned-access" });
        }
    }
    //TODO: Flags for accelerate, aarch64, arm and rpi
    const optimize = b.standardOptimizeOption(.{});
    const ggmlObject = b.addObject(.{
        .name = "ggml.o",
        .target = target,
        .optimize = optimize,
    });
    ggmlObject.addIncludePath("./");
    ggmlObject.addIncludePath("/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include");
    ggmlObject.addCSourceFiles(&.{
        "ggml.c",
    }, c_flags.items);
    if (maybe_use_accelerate) |use_accelerate| {
        if (use_accelerate) {
            ggmlObject.linkFramework("Accelerate");
        }
    }
    if (maybe_use_openblas) |open_blas| {
        if (open_blas) {
            ggmlObject.linkSystemLibraryName("openblas");
        }
    }
    ggmlObject.linkLibC();

    const whisperObject = b.addObject(.{ .name = "whisper.o", .target = target, .optimize = optimize });
    whisperObject.addIncludePath("./");
    whisperObject.addIncludePath("./examples");
    whisperObject.addCSourceFile("whisper.cpp", cpp_flags.items);
    whisperObject.linkLibCpp();

    // zig automatically adds `lib` prefix and a `.a` suffix
    var lib_static_library = b.addStaticLibrary(.{ .name = "whisper", .optimize = optimize, .target = target });
    lib_static_library.addObject(ggmlObject);
    lib_static_library.addObject(whisperObject);

    var lib_dynamic = b.addSharedLibrary(.{ .name = "whisper", .optimize = optimize, .target = target });
    lib_dynamic.addObject(ggmlObject);
    lib_dynamic.addObject(whisperObject);
    b.installArtifact(lib_dynamic);
    b.installArtifact(lib_static_library);
    var mainFile = b.addExecutable(.{ .name = "main" });
    mainFile.addIncludePath("./");
    mainFile.addIncludePath("./examples");
    mainFile.addCSourceFiles(&.{ "examples/main/main.cpp", "examples/common.cpp" }, cpp_flags.items);
    mainFile.addObject(whisperObject);
    mainFile.addObject(ggmlObject);
    if (maybe_use_accelerate) |use_accelerate| {
        if (use_accelerate) {
            mainFile.linkFramework("Accelerate");
        }
    }

    b.installArtifact(mainFile);
}

```


### Alternate ways of setting C macros 

##### In Zig Code:
Setting C preprocess macros with @cDefine or `-Dmacro=value` during compile time.
This compile time macro can be set via `build/build-exe -Dmacro=val` or programatically
object.addCSourceFiles("file", c_cpp_flags);
