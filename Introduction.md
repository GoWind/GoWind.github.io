---
title: Introduction to ELF
---

The best introduction is the actual ELF description document : http://flint.cs.yale.edu/cs422/doc/ELF_Format.pdf
However, it is kinda hard to read from from scratch and definitely boring.
Not to worry ! I will doing most of the hardwork and spitting out useful information step by step as we go along. 

### What is an ELF ? 
ELF - Executable and Linkable Format. As the name says: an ELF defines files that are either linked together into an Executable or an Executable that can be run by the operating system (via a system call such as  `execve` )

ELF files fall into one of 3 types
1. Relocatable file - A file that is linked with other files to form an executable
2. Executable file - A file that can be run by the operating system 
3. Shared Object file - A file that is loaded into a process at runtime (after an OS loads the executable). Shared object files provide common functionality (like `printf`) that need not be copied into every single executable. 

Since an ELF can be either linked into other files or run, it contains information about linking and loading/Executing the file.This information is provided via 2 parts of the ELF - `Program headers` and `Sections`

All ELFs contain an ELF Header that provides information the ELF : Is it an executable , a relocatable file, or a shared object file ? What architecture is this executable for ? What is the address from which this executable must be run  ? 

If the ELF is an executable , the **Program Headers** tell the Operating system what `virtual` address the program's code and data should be loaded into  and what additional memory addresses has to be allocated to the program etc.

In case of dynamically linked executables (more on that later), it also points to the location of the interpreter that must "interpret" this executable , so that it can be run. 

Lets look at a sample ELF header. 
In order to simplify things, I am going to use a statically compiled binary using `Zig`. I will explain what I mean when I say `statically` compiled. 

Lets take a small program that basically does nothing. 

```
fn factorial(x: u32) u32 {
    if (x <= 1) return 1;
    var i: u32 = 1;
    var res: u32 = 1;
    while (i <= x) : (i += 1) {
        res *= i;
    }
    return res;
}

pub fn main() void {
    _ = factorial(4);
}
```
This program computes a factorial (but doesn't print it). I left out printing the result, as it would have resulted in bloating our executable and making it too hard to understand how an ELF works. 

Build an executable out of this using: 
` zig build-exe -O ReleaseSmall -fsingle-threaded zig_factorial.zig`
This should net us an executable named `zig_factorial`.
For now , ignore the `ReleaseSmall` and `single-threaded` flags to the compiler. This is just to make our binary small enough and readable for learning purposes.

#### Tool 1: readelf is your best friend
`readelf` as the name suggests, reads ELFs and prints out useful information for us. 
Let us look at the ELF header. 

`readelf -h zig_factorial`

```
ELF Header:
  Magic:   7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00 
  Class:                             ELF64
  Data:                              2's complement, little endian
  Version:                           1 (current)
  OS/ABI:                            UNIX - System V
  ABI Version:                       0
  Type:                              EXEC (Executable file)
  Machine:                           Advanced Micro Devices X86-64
  Version:                           0x1
  Entry point address:               0x205e60
  Start of program headers:          64 (bytes into file)
  Start of section headers:          581424 (bytes into file)
  Flags:                             0x0
  Size of this header:               64 (bytes)
  Size of program headers:           56 (bytes)
  Number of program headers:         8
  Size of section headers:           64 (bytes)
  Number of section headers:         19
  Section header string table index: 17
```

You will find a lot of interesting info: 1. this is a 64 bit executable (Class : ELF64), built for the x86-64 architecture running System V (Linux and UNIX like OS) and the address from which we must start executing code is `0x205e60`

Lets run `ldd` on this exectuable: 

`$ ldd zig_factorial`
`           not a dynamic executable`

`ldd` tells us that this .exe file does not depend on any other libraries on the operating system. Hence it is `static`. 

Lets look at the elf using another tool `nm`
`nm zig_factorial`

It should produce a large output like this 

```
0000000000204e20 t std.debug.assert
0000000000226330 t std.debug.attachSegfaultHandler
000000000020e4d0 t std.debug.chopSlice
000000000021c6d0 t std.debug.Config.setColor
000000000020a9c0 t std.debug.DebugInfo.getModuleForAddress
000000000020a460 t std.debug.DebugInfo.init
000000000020b070 t std.debug.DebugInfo.lookupModuleDl
0000000000207940 t std.debug.detectTTYConfig
0000000000206770 t std.debug.dumpCurrentStackTrace
00000000002064e0 t std.debug.dumpStackTrace
0000000000233c50 t std.debug.dumpStackTraceFromBase
0000000000207880 t std.debug.getDebugInfoAllocator
0000000000207730 t std.debug.getSelfDebugInfo
000000000021d0b0 t std.debug.getSymbolFromDwarf
000000000022ca60 t std.debug.handleSegfaultPosix
0000000000225880 t std.debug.LineInfo.deinit
000000000020e200 t std.debug.mapWholeFile
```

We aren't interested in any of these symbols except what lies at address `0x205e60` , as this is our entry point into the executable, so let us grep for that. 
`$ nm zig_factorial | grep 0x205e60`

`0000000000205e60 T _start`

Curiourser and curiouser. In our program , we defined a `main` function and assumed that that is what gets executed when we run our program. What then is `_start` ? 

When you execute your program, there has to be a lot of things that have to be done before `main` is called. Some of the tasks are like ensuring that the `argc` and `argv` parameters to the function are passed in the right registers, any state needed by the program before main is executed is updated . These might vary from platform to platform and runtime to runtime (zig, c, c++, insert prog. lang. of your choice).

The convention therefore is to point the entry point of the executable to `_start` which does the initialization and calls `main`. Similarly, once your program exists , either by returning from main or calling some sort of `exit` function, an optional `exit`  like section runs, cleaning up resources before the program actually exits. 

(Self note: Glic binaries have no `exit` sections defined)

Infact, the ELF defines 2 special sections`.init` and `.fini` to hold code for these entry and cleanup routines. We will discuss this in detail later. 

In case of our zig based program, the `zig` compiler (more specifically: the `musl` C library) provides all the necessary startup/cleanup code and compiles this into our executable, which then calls our `main` .


## Static vs dynamically linked Executables

`Static`:  Executable contains a copy of all the code it needs to interact with the Operating system and other systems
`Dynamic`: Executable tells what code it needs, but doesn't have it bundled in the same file. Instead it is the duty of the `dynamic linker`, to load this exe and link the code that executable needs before the executable actually starts executing the code. 

##### Why are executables dynamic ? 
1. A lot of code (such as `printf`) are commonly used by most programs. When programs are executed, they are loaded into memory  first so that they can be run.  In the old days, when memory was scarce, each executable loading code for the same function `printf`, `read`, `write` etc. meant wasting memory due to duplication
2. Thanks to virtual memory, the memory addresses that processes see is not the same as the actual addreses in RAM. This meant that you can load `printf` in one RAM location and share it with many different processes , with a different virtual address in each process, thus reducing memory usage. 
3. `glibc` or the C standard library is probably the most commonly used layer to interact with Linux. Therefore by shipping one instance of glibc with all Linux based OS, applications need not worry about the API to Linus and can rely on glibc to provide the functionality.

The `dynamic linker` is a program that links your executable to `glibc` before the executable is run. All dynamically linked executables have an `INTERP` section (more on sections later), that points to the location of the `dynamic linker`. 

When you do something like `./my-executable` in your shell, your shell invokes `execve(./executable)`. 
`execve` is a family of Linux system calls that create a Process and to run your executables. When they see that your executable is a `dynamic` one, they invoke the `dynamic linker` present in the `INTERP` section of your executable, which then links your executable to `glibc` before running it. 

##### Problems
1. Like any dependency versioning is a problem. Your user's OS might have a different version of Glibc that might not have the features your application needs , thus breaking the experience for the user.
2. Platform inconsistencies: Dynamically linked executables hardcode the path to the `dynamic linker`. If you run your executable on an OS or a Linux installation with the dynamic linker at a different location, then your application will not be run (however, this can be solved by setting the `LD_LIBRARY_PATH` environment variable in the shell if the `dynamic linker` is present in a differnt location)


##### Why are executables static ? 
1. All code/data needed in one single file. No need to worry about dependencies. 

