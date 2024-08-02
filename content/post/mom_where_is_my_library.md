---
title: Mom, where is my library ? 
date: 2024-08-02
---

So I wanted to use the [ggml](https://github.com/ggerganov/ggml) library to build some neural networks in C. The recipe was simple
1. Clone the ggml repo into `~/personal/ggml`
2. Build the shared libraries needed to use ggml from my code
3. Use the shared libraries

To build the shared library, I created a `ggml_lib` folder adjacent to the `ggml` library: 
```
.
├── ggml
├── ggml_lib
```

Then, `cd ggml_lib`
Followed by:
```
cmake ../ggml
cmake --build .
cmake --install . --prefix $(PWD)
```

This installs the generated shared library under `ggml_lib/lib` and the headers under `ggml_lib/include`

So these are all we need to start using ggml, here is a simple main that attempts. to create a couple of tensors and then frees them

```
#include "ggml.h"

int main() {
   struct ggml_init_params params  = {
            .mem_size   = 2048,
            .mem_buffer = NULL,
            .no_alloc   = false, 
    };

    // create context
    struct ggml_context* ctx = ggml_init(params);

    struct ggml_tensor* a = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, 5, 5);
    struct ggml_tensor* b = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, 10, 10);

    ggml_free(ctx);
}
```

```
$ gcc use_ggml.c -o use_ggml
use_ggml.c:1:10: fatal error: 'ggml.h' file not found
#include "ggml.h"
         ^~~~~~~~
```
Of course, your compiler cannot find the `ggml.h` Header file, so you have to specify a path to the compiler to search for this Header. We do this by passing the location to the Header file using the `-I` flag

```
$ gcc use_ggml.c -Iggml_lib/include -o use_ggml
ld: Undefined symbols:
  _ggml_free, referenced from:
      _main in use_ggml-0e7b1c.o
  _ggml_init, referenced from:
      _main in use_ggml-0e7b1c.o
  _ggml_new_tensor_2d, referenced from:
      _main in use_ggml-0e7b1c.o
      _main in use_ggml-0e7b1c.o
clang: error: linker command failed with exit code 1 (use -v to see invocation)
```

Now, your compiler can find the header file, but when attempt to create a final executable , it cannot find the code to the actual functions `ggml_init, ggml_free` (the `_` prefix is a macOS platform detail where the names of your functions are prefixed with an `_` ). So now we have to tell the compiler to link against our dynamic library : `ggml`, we do this by passing the `-lggml` flag (the convention is `-lname_of_the_library_providing_your_code`)

So how can my compiler find where a library is located ? The compiler (and the linker) maintain a bunch of "SEARCH PATHS" where dynamic libraries are located and when attempting to link to a shared library, will attempt to find the library in the SEARCH PATHs before giving 

Here is what I found reported as SEARCH PATHS on my mac laptop
```
$ gcc --print-search-dirs
programs: =/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin
libraries: =/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/lib/clang/15.0.0


$ ld -v
@(#)PROGRAM:ld  PROJECT:dyld-1015.7
BUILD 18:48:48 Aug 22 2023
....
Library search paths:
Framework search paths:
```

In addition, there are standard paths like `/usr/lib` or `/usr/local/lib` that your linker and compiler will search for to find shared libraries

Coming back to our example, our installed shared library is not in any of these location, so I must specify the path to `ggml_lib/lib` to the compiler so that it can find the generated ggml dynamic lib (dylib)

```
gcc use_ggml.c -Iinclude/ -Lggml_lib/lib -o use_ggml  -lggml

-lggml , link against the dynamic library ggml
-Lggml_lib/lb, you will find the file libggml.dylib under ggml_lib/lib
```

## Problem 

Okay, it works. Now I just have to run my binary `use_ggml` right ? Right ? 

```
$ ./use_ggml
dyld[35649]: Library not loaded: @rpath/libggml.dylib
  Referenced from: <8B6DF1BE-A897-383F-AB20-DBDB61039351> /Users/govind/personal/use_ggml
  Reason: no LC_RPATH's found
[1]    35649 abort      ./use_ggml
```

What happened ? Didn't we find our `ggml` dynamic library and set its location correctly when compiling the program ? Why is that when we run this code now, we run into some errors about the Library not being loaded ? 

## Answer: The dynamic linker

Recall that a [shared library](https://en.wikipedia.org/wiki/Shared_library) is a piece of executable code, that is shared across multiple binaries. This means that this piece of code can be loaded into other binaries. For example, if you want to use graphics, rather than create big binaries with all the graphics related operations, the OS will provide a shared library for graphics. As an executable, you need not bring your own Graphics related libraries, but just declare a dependency on the shared graphics library and it is the OS's responsibility now to provide you the shared library when your binary is executed. 

Who is responsible for loading this shared library into your binary when it is run ? It is the **[DYNAMIC LINKER](https://en.wikipedia.org/wiki/Dynamic_linker)** which loads and links the needed shared libraries at runtime.  

When you run a binary , example : `./use_ggml`, the dynamic linker `dyld` is executed by the operation system, which then reads "LOAD COMMANDS" from the executable to figure out how to setup the executable in memory, before the executable is actually executed (`main` of your program)

On macOS binaries,  you can inspect your binary's dependencies using the `otool` command
```
otool -l use_ggml
Load command 13
          cmd LC_LOAD_DYLIB
      cmdsize 48
         name @rpath/libggml.dylib (offset 24)
   time stamp 2 Thu Jan  1 01:00:02 1970
      current version 0.0.0
compatibility version 0.0.0
Load command 14
          cmd LC_LOAD_DYLIB
      cmdsize 56
         name /usr/lib/libSystem.B.dylib (offset 24)
   time stamp 2 Thu Jan  1 01:00:02 1970
```

the `LC_LOAD_DYLIB` is a command to the `dyld` to load a dynamic library. Note the `@rpath` macro. 
The `@rpath` is a macro that expands to `RUNTIME_PATH` , a path of locations at runtime (when the executable starts executing) where `dyld` will search for shared libraries. 
The `@rpath` isn't a location in itself, but is set when the executable's image is being created in the memory.

The value of `@rpath` is set by an `LC_RPATH` command that sets the rpath to a particular location (thus providing the location to our dynlib as `/path/to/libggml.dylib`) , which in our case, is missing and thus causing `dyld` to throw an error when attempting to run our executable.

### So how do we fix this ? 

There are a few solutions, each of which will helps us understand a bit further on how loading dynamic libraries work

1. Using `DYLD_LIBRARY_PATH` (command: `DYLD_LIBRARY_PATH=. ./use_ggml`)

The `DYLD_LIBRARY_PATH` is an environment variable that the dynamic linker parses before loading an executable. You can use DYLD_LIBRARY_PATH to provide a colon separated list of directories to search for shared libraries. 

Here is an example of using DYLD_LIBRARY_PATH to let dyld know where to look for libggml.dylib
```
~/personal/ggml-node
$ DYLD_LIBRARY_PATH=./ggml_lib/lib ./use_ggml

~/personal/ggml-node
```

Success !!

2. Setting the `rpath` when creating the executable

We pass flags to the linker when compiling our executable (as an aside, read Sanglard's [brilliant](https://fabiensanglard.net/dc/index.php) articles on how compiler drivers  function). We can expand the `rpath` macro to a location that is dependent on where the executable is located 
```
gcc use_ggml.c -Iinclude/ -Lggml_lib/lib -o use_ggml  -lggml -Wl,-rpath,@executable_path/ggml_lib/lib
```
`-Wl,option1,option2`  is how we pass flags to the linker via `gcc` compiler driver. The `@executable_path` is a placeholder to the location of the executable. What this says is: when looking for `libggml.dylib`, look it in the directory : `LOCATION_OF_EXECUTABLE/ggml_lib`. So if your executable is located at `/Users/personal` then look up `libggml.dylib` in `/Users/personal/ggml_lib` 
There are other placeholders such as `@loader_path` , but lets not look into them now to avoid confusion. 

Once we set the `rpath`, lets look at the LOAD_COMMANDS in the executable to see if anything has changed

```
otool -l use_ggml
Load command 13
          cmd LC_LOAD_DYLIB
      cmdsize 48
         name @rpath/libggml.dylib (offset 24)
   time stamp 2 Thu Jan  1 01:00:02 1970
      current version 0.0.0
compatibility version 0.0.0
Load command 14
          cmd LC_LOAD_DYLIB
      cmdsize 56
         name /usr/lib/libSystem.B.dylib (offset 24)
   time stamp 2 Thu Jan  1 01:00:02 1970
      current version 1336.0.0
compatibility version 1.0.0
Load command 15
          cmd LC_RPATH
      cmdsize 48
         path @executable_path/ggml_lib/lib (offset 12)
```

BINGO ! Remember the missing `LC_RPATH` command that was the cause of the dyld error ? We now have an LC_RPATH command that points to the directory `ggml_lib/lib` relative to the location of the executable. 

So, does this solve the problem ?

```
$ ./use_ggml

~/personal 
```

YES ! A resounding YES !

## Summary

Turns out finding and loading shared libraries is a actually a tricky problem when shipping native applications. A lot of this complexity is thankfully handled by the OS and package managers, but it is good to understand the problems faced by native applications to truly appreciate all the QoL improvements that package managers make for us. 

### Appendix 
The difference between @executable_path and @loader_path in RPATH (Run-time search PATH) variables is illustrated as follows

1. @executable_path:
    - Definition: This variable refers to the directory containing the main executable of the process.
    - Usage: It's primarily used when you want to specify paths relative to the main application executable.
    - Behavior: It always points to the same location, regardless of which library or plugin is currently being loaded.
2. @loader_path:
    - Definition: This variable refers to the directory containing the binary (executable or library) that is currently being loaded.
    - Usage: It's used when you want to specify paths relative to the current library or executable being loaded.
    - Behavior: Its value can change depending on which binary is currently being processed by the dynamic loader.


 @executable_path always refers to the main application executable's directory.
@loader_path refers to the directory of the binary currently being loaded, which could be the main executable, a library, or a plugin.


Example Scenario:

Imagine an application structure like this:

```
/Applications/MyApp.app/
    Contents/
        MacOS/
            MyApp (main executable)
        Frameworks/
            LibA.dylib
            LibB.dylib
        PlugIns/
            PluginC.dylib
```

- Using @executable_path:
    - In MyApp: @executable_path/../Frameworks/LibA.dylib
    - This always refers to /Applications/MyApp.app/Contents/MacOS/
- Using @loader_path:
    - In MyApp: @loader_path/../Frameworks/LibA.dylib (Same as @executable_path in this case)
    - In LibA.dylib: @loader_path/LibB.dylib (Refers to /Applications/MyApp.app/Contents/Frameworks/)
    - In PluginC.dylib: @loader_path/../../Frameworks/LibA.dylib (Refers to /Applications/MyApp.app/Contents/PlugIns/)


