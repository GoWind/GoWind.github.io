# Introduction

**Note** : While the title of the Folder is `Linux Stuff`, I am filing this article, which is about x86 architecture in general, under Linux stuff for now

Also a good [source](https://eli.thegreenplace.net/2011/02/04/where-the-top-of-the-stack-is-on-x86/) for understanding how a stack is pushed/popped and the calling convention.

## What is a calling convention ? 

A calling convention is a standardized  way of passing function arguments and return values to and from function in x86 assembly. 

### Why do we need a calling convention ? 
Interoperability. The operating system for eexample, provides a libc: [[[What is `glibc`]], that is in the form of a dynamic  library. 

A lot of other libraries and opeerating systems provide functionality via shared or static libraries `.dll`, `.so`, `.a` files etc. 

The advantage of this format is you can use any language that can compile code to assembly to use these libraries. 

But to do so, you need to know  how to communicate with these dynamic libraries.

The calling convention is the protocol for applications to call into such shared library functions. 

Calling convention depends on the version of the x86 architecture (32-bit vs 64 bit), and there are slightly different versions of Calling Conventions (cdecl, fastcall, slowcall, etc). More information [here](https://en.wikipedia.org/wiki/X86_calling_conventions#Register_preservation)

Here let us take a look `cdecl` and how it deals with the stack. This version deals with the 32-bit architecture

### X86 basics

Memory is linear and addressed in terms of bytes.
The Stack of a function grows towards lower addresses.
The Heap of a the program grows higher.

### Pushing and popping `esp`

esp -> Points to the top of he stack. 
esp is always aligned to a 4-byte address / 16? byte address (esp modulo 32 == 0)

#### Push

push `x` -> Pushes `x` to the top of the stack 
**Basically**: 
esp = esp - 4
Memory[esp] = `x`

#### Pop

pop `target`
pops the top of the stack into `target` (register, or memory address)
Memory[target] (or target registry) = Memory[esp]
esp = esp - 4

### Base Pointer

`ebp`, or the Base pointer, points to the Base of a function's stack.


### Alignment
Stack must be multiple of 8 aligned before doing a `call` instruction, otherwise it will segfault.


### Order of operands
Operands to functions are passed via registers. Registers are chosen as follows

   -   For integers and pointers, `rdi`, `rsi`, `rdx`, `rcx`, `r8`, `r9`.
    -  For floating-point (float, double), `xmm0`, `xmm1`, `xmm2`, `xmm3`, `xmm4`, `xmm5`, `xmm6`, `xmm7`.

### Return values 
return values are stored in `rax` or `rdx:rax` in case of integers and `xmm0` or `xmm1:xmm0` in case of floats.

#### Interesting notes

**LEA**
LEA stands for load effective address. `lea` doesnt manipulate (read or write to memory address), but is only used for calculating addresses, instead of `add` or `mul`. 
															Why ?
1. Add cannot operate on 3 registers at once. Using `lea` once can use the [Base Reg + N* Step REG + offset Reg] notation to calculate mem address and store it an anddress
2. Does not affect `EFLAGS` as opposed to `ADD`

When you see something like `lea RDX, [RCX + 4 * RBX  + RAX]`, ignore the `[]`. It is basically `RDX = RCX + 4 * RBX  + RAX`

