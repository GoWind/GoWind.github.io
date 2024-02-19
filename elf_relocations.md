---
title: ELF relocations
---

Let us try to understand what are relocations and how they happen. 

When we compile our code , there will be certain "things" that we do not know where they exist. For example , in the following snippet, we do not know where `printf` is coming from, but we just assume that `printf` is defined somewhere and is available when we execute our code.

Here is a C file with a `main` function: 

```
#include<stdio.h>
//#include "lib.h"

int main(int argc, char** argv) {
  printf("factorial of 5 is %d\n", factorial(5));
  return 0;
}
```

I haven't defined the `factorial` function yet as well, so if I try to compile it into an executable, it will fail:
```
gcc main.c -o main                              
main.c: In function ‘main’:
main.c:5:36: warning: implicit declaration of function ‘factorial’ [-Wimplicit-function-declaration]
    5 |   printf("factorial of 5 is %d\n", factorial(5));
      |                                    ^~~~~~~~~
/usr/bin/ld: /tmp/ccbCLA27.o: in function `main':
main.c:(.text+0x1e): undefined reference to `factorial'
collect2: error: ld returned 1 exit status
```
`collect2` is the GNU `linker` that will link object files into an Executable 


We can compile our C file into a relocatable object file (`.o`). 
This relocatable can be linked with other libraries or relocatables into an EXE and contains `relocatable` sections (`.rela.`) that say which symbols should be relocated.

`gcc -c main.c`

`readelf -h main.c`  gives the following output

```
ELF Header:
  Magic:   7f 45 4c 46 02 01 01 00 00 00 00 00 00 00 00 00 
  Class:                             ELF64
  Data:                              2's complement, little endian
  Version:                           1 (current)
  OS/ABI:                            UNIX - System V
  ABI Version:                       0
  Type:                              REL (Relocatable file)
  Machine:                           Advanced Micro Devices X86-64
  Version:                           0x1
  Entry point address:               0x0
  Start of program headers:          0 (bytes into file)
  Start of section headers:          888 (bytes into file)
  Flags:                             0x0
  Size of this header:               64 (bytes)
  Size of program headers:           0 (bytes)
  Number of program headers:         0
  Size of section headers:           64 (bytes)
  Number of section headers:         14
  Section header string table index: 13
```

(Question to self: How does the linker know which section defines the `main` function, and set it as the starting point of the executable)

Let us look at the symbols in our Relocatable file

`readelf --symbols main.o`

```
Symbol table '.symtab' contains 14 entries:
   Num:    Value          Size Type    Bind   Vis      Ndx Name
     0: 0000000000000000     0 NOTYPE  LOCAL  DEFAULT  UND 
     1: 0000000000000000     0 FILE    LOCAL  DEFAULT  ABS main.c
     2: 0000000000000000     0 SECTION LOCAL  DEFAULT    1 
     3: 0000000000000000     0 SECTION LOCAL  DEFAULT    3 
     4: 0000000000000000     0 SECTION LOCAL  DEFAULT    4 
     5: 0000000000000000     0 SECTION LOCAL  DEFAULT    5 
     6: 0000000000000000     0 SECTION LOCAL  DEFAULT    7 
     7: 0000000000000000     0 SECTION LOCAL  DEFAULT    8 
     8: 0000000000000000     0 SECTION LOCAL  DEFAULT    9 
     9: 0000000000000000     0 SECTION LOCAL  DEFAULT    6 
    10: 0000000000000000    60 FUNC    GLOBAL DEFAULT    1 main
    11: 0000000000000000     0 NOTYPE  GLOBAL DEFAULT  UND _GLOBAL_OFFSET_TABLE_
    12: 0000000000000000     0 NOTYPE  GLOBAL DEFAULT  UND factorial
    13: 0000000000000000     0 NOTYPE  GLOBAL DEFAULT  UND printf
```

While we use `factorial`  and `printf` even though we haven't defined (or declared) them, the symbol table in our `main.o`  contains entries for them. 

`$ readelf --relocs main.o`

```
Relocation section '.rela.text' at offset 0x2a0 contains 3 entries:
  Offset          Info           Type           Sym. Value    Sym. Name + Addend
00000000001e  000c00000004 R_X86_64_PLT32    0000000000000000 factorial - 4
000000000027  000500000002 R_X86_64_PC32     0000000000000000 .rodata - 4
000000000031  000d00000004 R_X86_64_PLT32    0000000000000000 printf - 4

Relocation section '.rela.eh_frame' at offset 0x2e8 contains 1 entry:
  Offset          Info           Type           Sym. Value    Sym. Name + Addend
000000000020  000200000002 R_X86_64_PC32     0000000000000000 .text + 0
```

Our relocations are of different types. We can be relocating calls to functions (R_X86_64_PLT32) or to data (R_X86_64_PC32). 

The `offset` of the relocation tells us where in our code the relocation exists. Let us take a look at it using `objdump`

`objdump -s main.o`

```
0000000000000000 <main>:
   0:   f3 0f 1e fa             endbr64 
   4:   55                      push   %rbp
   5:   48 89 e5                mov    %rsp,%rbp
   8:   48 83 ec 10             sub    $0x10,%rsp
   c:   89 7d fc                mov    %edi,-0x4(%rbp)
   f:   48 89 75 f0             mov    %rsi,-0x10(%rbp)
  13:   bf 05 00 00 00          mov    $0x5,%edi
  18:   b8 00 00 00 00          mov    $0x0,%eax
  1d:   e8 00 00 00 00          callq  22 <main+0x22>
  22:   89 c6                   mov    %eax,%esi
  24:   48 8d 3d 00 00 00 00    lea    0x0(%rip),%rdi        # 2b <main+0x2b>
  2b:   b8 00 00 00 00          mov    $0x0,%eax
  30:   e8 00 00 00 00          callq  35 <main+0x35>
  35:   b8 00 00 00 00          mov    $0x0,%eax
  3a:   c9                      leaveq 
  3b:   c3                      retq
```

Looks scary ! (but pretty understandable)

The first relocation `001e`  points to a value of `00 00 00 00`. This comes after an `e8` value,  which is the opcode for a `callq` instruction. What is being called ? `00` ? 

In our source code, we call 2 functions: `printf` and `factorial`.
`printf("factorial of 5 is %d\n", factorial(5));

We call `factorial` with an argument of `5` and then `printf` with 2 arguments : a format string, and the result of the call of `factorial(5)`. The first `callq` is the `factorial(5)` and the second `callq` at offset `30` is to `printf`. 

We also see that we pass a `5` to `factorial()` by setting `edi` to `5`  (for more info on how parameters to functions are passed, read the [[From Source Code to Hello World/X86 calling convention]] page)

We do not know the address where `printf` or `factorial` will be located in memory, so `gcc` simply sets the address of the `call` instruction to `00 00 00 00` and emits a `relocation` entry in the object file. This will tell the linker when it is generating the executable, to somehow generate an address to `factorial` or redirect the callq to a location, which then knows how to call `factorial`.
(Note to self: is this the `PLT`, aka `Procedure Link Table`  ?)

Lets implement factorial in a `lib.c` file and then link it with our executable. 
```
$ cat lib.c  
int factorial(int base) {
  int res = 1;
  int i = 1;
  if(base == 0) {
    return 1;
  }
  while(i <= base) {
    res *= i;
    i += 1;
  }
  return res;
}
```

`gcc lib.c main.c -o main`

```
000000003db8  000000000008 R_X86_64_RELATIVE                    1140
000000003dc0  000000000008 R_X86_64_RELATIVE                    1100
000000004008  000000000008 R_X86_64_RELATIVE                    4008
000000003fd8  000100000006 R_X86_64_GLOB_DAT 0000000000000000 _ITM_deregisterTMClone + 0
000000003fe0  000300000006 R_X86_64_GLOB_DAT 0000000000000000 __libc_start_main@GLIBC_2.2.5 + 0
000000003fe8  000400000006 R_X86_64_GLOB_DAT 0000000000000000 __gmon_start__ + 0
000000003ff0  000500000006 R_X86_64_GLOB_DAT 0000000000000000 _ITM_registerTMCloneTa + 0
000000003ff8  000600000006 R_X86_64_GLOB_DAT 0000000000000000 __cxa_finalize@GLIBC_2.2.5 + 0

Relocation section '.rela.plt' at offset 0x5e8 contains 1 entry:
  Offset          Info           Type           Sym. Value    Sym. Name + Addend
000000003fd0  000200000007 R_X86_64_JUMP_SLO 0000000000000000 printf@GLIBC_2.2.5 + 0
```

As you can see, `factorial` is no longer a relocatable symbol as the compiler knows where to find it and then generates an address to jump to, when `factorial` is to be called.
We can verify it in our `objdump` output.
```
    119d:       bf 05 00 00 00          mov    $0x5,%edi
    11a2:       b8 00 00 00 00          mov    $0x0,%eax
    11a7:       e8 9d ff ff ff          callq  1149 <factorial>
```
```
0000000000001149 <factorial>:
    1149:       f3 0f 1e fa             endbr64 
    114d:       55                      push   %rbp
    114e:       48 89 e5                mov    %rsp,%rbp
```

What about `printf` ? How do we call printf when we really don't know its address ?
That is the topic of the next section : `PLTs` ,a.ka Procedure Link Tables. 

##### Footnote
Each relocation section denotes which section will be updated.
For example: `.rela.text` means these relocations apply to the `.text` section.
Similar `.rela.plt` means this relocation will apply to the `.plt` section. 
	
