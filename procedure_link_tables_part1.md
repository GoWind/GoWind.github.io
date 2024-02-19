---
title: Procedure Link Tables Part I
---

		TODO: Start with example from ELF Relocations.
**Note**: A lot seems to have changed in how PLTs and GOTs are resolved and loaded, especially from 32 bits to 64 bits . A lot of my Google searches (example [here](https://www.youtube.com/watch?v=kUk5pw4w0h4&t=271s)) ended up showing stuff like `dl_resolve` that no longer seemed to be used anymore ???? 
Anyway, we can still get a rough idea of how PLTs and GOTs work, nevertheless. 

Let me start from the previous source listing of a `main.c` and `lib.c` from the [[From Source Code to Hello World/ELF Relocations]] post. 

We saw that the (static) linker was able to resolve the reference to `factorial` in our `main`  when creating the executable. Resolve here means it can place the code for factorial in our executable file and generate a `call` instruction: 

```
11a7:       e8 9d ff ff ff          call   1149 <factorial>
```

However, `printf` is part of `glibc`, which will be dynamically linked during runtime by the dynamic linker. The Executable does not know what address `printf` will be loaded at, so how will it know which memory address the `call` should jump to ? 

ELFs solve this problem using `PLT`s or Procedure Link Tables. The idea is simple:

1. For each dynamically linked function (`printf` etc), generate a `stub` or a `trampoline` entry in the PLT. 
2.In the user's functions, generate a `call` or a `jmp` instruction to this `stub`.
3. This stub will then `jmp` to some location (`GOT`), that can then figure out where printf is located and further `jmp` or `call` that location.
3a. At 3, every function call from the application code to the dynamically linked function will need 2 jumps. Therefore, as an optimization, at 3) once we know the address of `printf`, we can put this address directly in our `GOT`, so that our `stub` can `jmp` to `printf` instead of having to get it resolved  everytime. 

In th executable, 2 things have to be  done: 
1. We need to signal the dynamic linker, that we need  `printf`

This is done using `relocation` sections (`readelf --relocs main`).
```
Relocation section '.rela.plt' at offset 0x5e8 contains 1 entry:
  Offset          Info           Type           Sym. Value    Sym. Name + Addend
000000003fd0  000200000007 R_X86_64_JUMP_SLO 0000000000000000 printf@GLIBC_2.2.5 + 0
```

The `Offset` has different meanings, depending on if our file is Relocatable file (`.o`) or an executable. `main` here is an executable, so `Offset` here is a virtual address (this will be changed when our executable is run as a process anyway). 

Let us look at our `main` to see how it indirectly calls `printf`. 
`objdump -M intel -dS main` (`-M` is for setting assembly syntax flavor. Intel flavor is a little easier to understand than the default AT&T syntax).

```
000000000000118a <main>:
... some assembly dropped
11b5:       b8 00 00 00 00          mov    eax,0x0
11ba:       e8 91 fe ff ff          call   1050 <printf@plt>
```
We `call` to location `0x1050`. Lets inspect what is at location `0x1050`.

```
Disassembly of section .plt.sec:

0000000000001050 <printf@plt>:
    1050:       f3 0f 1e fa             endbr64 
    1054:       f2 ff 25 75 2f 00 00    bnd jmp QWORD PTR [rip+0x2f75]        # 3fd0 <printf@GLIBC_2.2.5>
    105b:       0f 1f 44 00 00          nop    DWORD PTR [rax+rax*1+0x0]
```

Okay, so we have a `PLT entry for printf` . Lets ignore the `endbr64`instruction and focus on the next instruction (0x1054). 
We still don't know the address of the actual `printf`. What we see here is an `indirect jump`, like dereferencing a pointer. The `[]` means, look up the value stored at address `rip + 0x2f75` and then jmp to that value. 
When executing `0x1054`, `rip` points to the next instruction (`0x105b`). The jmp value is stored at `rip + 0x2f75` => `0x3fd0`.
**Note** that `0x3fd0` is the address where we request our dynamic linker to place the address of `printf` in our `relocs` section. 

To really probe the next step, we have to fire up `gdb` and execute our exe file step by step. 
This will be turned into Part 2. 



#### Reference: 
https://www.youtube.com/watch?v=kUk5pw4w0h4

Why you need PLT AND GOT 
https://stackoverflow.com/questions/45355013/why-trampoline-from-plt-to-got-instead-of-directly-jumping-to-got (hint: When stub from PLT jumps to GOT, it pushes information in the stack for the resolving function in the GOT that `printf` or whatever function is called via the `plt` needs to be resolved.)

Also https://stackoverflow.com/questions/43048932/why-does-the-plt-exist-in-addition-to-the-got-instead-of-just-using-the-got
(It is hard to know if you have to do a `jmp` vs if you have to do a `call` , so there in seems to be the biggest problem)