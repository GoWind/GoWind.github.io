# GOT, `__stubs` and Linking 

#### This is a version of the Procedure Link Tables article I wrote for x86_64, but for macOS and aarch64. 

Lets start with a simple program
```main.c

#include<stdio.h>

int moorthySir(int k) {
  return k - 1;
}
int blarty = 46;
extern int malarchy(int);
extern int martyMcBoe;
int main() {
  int a = martyMcBoe;
  a += blarty;
  printf("%d\n", a);
  int mal = malarchy(683);
  printf("%d\n", mal);
  printf("%d\n", moorthySir(346));
  return 0;
}

```

We have a small helper `shared` library
```helper.c

int martyMcBoe = 895;

int malarchy(int b) {
  return b * 4;
}

```
`gcc -c -fpic helper.c`
`gcc -shared -o libhelper.so helper.o`

Our `main` depends on functionality from `libhelper.so` (a global variable and a function). What problems are we solving when linking them together ? 

1. main.c might be compiled with other `.o` (object files) to create the final executable. If we rely on an hardcoded address for `blarty`, when we create the final executables, this address will be invalid. This is because other `.o` or libraries will also have statically initialized data and in the final executable, we will have only one `.data` section that concatenates all the `.data` sections of the object files.
2. We declare that we depend or need a global variable `martyMcBoe` and a fn `malarychy` (and `printf`). We don't know which other object file or shared library will provide it, just that we need an `int` martyMcBoe and a `int -> int fn` named `malarchy`.

So how do we figure out the right addresses to load our global variables from, or the right addresses to jump to ? 
Enter `relocations`.

Now let us look at relocations in the file.

```
objdump --reloc  main.o

main.o:	file format mach-o arm64

RELOCATION RECORDS FOR [__text]:
OFFSET           TYPE                     VALUE
00000000000000b8 ARM64_RELOC_BRANCH26     _printf
00000000000000a0 ARM64_RELOC_BRANCH26     _moorthySir
0000000000000098 ARM64_RELOC_BRANCH26     _printf
0000000000000078 ARM64_RELOC_BRANCH26     _malarchy
0000000000000070 ARM64_RELOC_BRANCH26     _printf
0000000000000068 ARM64_RELOC_PAGEOFF12    l_.str
0000000000000064 ARM64_RELOC_PAGE21       l_.str
0000000000000044 ARM64_RELOC_PAGEOFF12    _blarty
0000000000000040 ARM64_RELOC_PAGE21       _blarty
0000000000000034 ARM64_RELOC_GOT_LOAD_PAGEOFF12 _martyMcBoe
0000000000000030 ARM64_RELOC_GOT_LOAD_PAGE21 _martyMcBoe
```

The `offset` of a relocation depends on what kind of file we are looking at. In an object file, the `offset` is an offset into the `_text` section of the file and indicates what must be changed.
For example `ARM64_RELOC_BRANCH26` _printf indicates that at an offset 70 into the file, we should do a relocation so that the code there can call the fn printf.

We can see that at 70 offset into `_text`, there is indeed a `bl` instructions there (similar to call/jmp in x86)

[Side Note] Relocations in macOS for global variables is a little tricky, which is why you will see 2 relocations for each global variable, such as `_martyMcBoe` (in macOS, all names of C fns or variables is prefixed with an `_)

There is also another problem with aarch64. All instructions (including operands) in aarch64 are 32 bits wide. How do you then jump to another 64-bit address ?

This is how the linker does this on aarch64: 
1. Provide a 26-bit (+/- 128 MB) offset relative to the current instruction pointer (PC) as arg. to the `bl` instruction. 
2. control jumps to that addres. There, we load the actual address of `printf` from a special location. 
3. Once the actual address of `printf` is in a register, we then use the `br` instruction to jump to the 64-bit address in the register


Lets now compile our object file into an executable with the shared library 
`gcc -L. -g -o test main.c -lhelper`

`test` is the name of our executable. We can verify that all the relocations we needed are patched 

```

100003f88: 08 00 00 94 	bl	0x100003fa8 <_printf+0x100003fa8>
100003f8c: e0 13 40 b9 	ldr	w0, [sp, #16]
100003f90: fd 7b 42 a9 	ldp	x29, x30, [sp, #32]
100003f94: ff c3 00 91 	add	sp, sp, #48
100003f98: c0 03 5f d6 	ret
```

Our executable first `trampolines` into a `__stubs` section. From there it knows how to call into `printf`

1. Jump into the the trampoline in `__stubs`. 
2. Load the address of `printf` from the `GOT` (Global Offset Table) into `x16`.
3. Jump to `printf`. 


```

Disassembly of section __TEXT,__stubs:

0000000100003f9c <__stubs>:
100003f9c: 10 00 00 b0 	adrp	x16, 0x100004000 <__stubs+0x4>
100003fa0: 10 02 40 f9 	ldr	x16, [x16]
100003fa4: 00 02 1f d6 	br	x16
100003fa8: 10 00 00 b0 	adrp	x16, 0x100004000 <__stubs+0x10>
100003fac: 10 0a 40 f9 	ldr	x16, [x16, #16]
100003fb0: 00 02 1f d6 	br	x16
```

We can verify that the `GOT` is at the address `0x100004000`

```
objdump -s -j __got test

test:	file format mach-o arm64
Contents of section __DATA_CONST,__got:
 100004000 00000000 00001080 01000000 00001080  ................
 100004010 02000000 00000080                    ........
```

The dynamic linker knows which shared libraries (like `libc` ) our executable needs and loads the shared libraries into memory and maps the address of fns we need into the GOT. 

Running this program in the debugger, we see that from `__stubs` , we can jump into `printf` without knowing the exact address of `printf`  

```
test`printf:
->  0x100003fb0 <+8>: br     x16
    0x100003fb4:      .long  0x000a6425                ; unknown opcode
    0x100003fb8:      udf    #0x1
    0x100003fbc:      udf    #0x1c
Target 0: (test) stopped.
(lldb) register read x16
     x16 = 0x000000018c7351d0  libsystem_c.dylib`printf
(lldb) disassemble
test`printf:
    0x100003fa8 <+0>: adrp   x16, 1
    0x100003fac <+4>: ldr    x16, [x16, #0x10]
->  0x100003fb0 <+8>: br     x16
(lldb) image lookup -n printf
1 match found in /usr/lib/system/libsystem_c.dylib:
        Address: libsystem_c.dylib[0x00000001802bd1d0] (libsystem_c.dylib.__TEXT.__text + 192556)
        Summary: libsystem_c.dylib`printf
```
