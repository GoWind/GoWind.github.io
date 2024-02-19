---
title: Procedure Link Tables Part I
---

This is a continuation of [[From Source Code to Hello World/Procedure Link Tables Part 1]]

Let us fire up good old `gdb`. I use `pwndbg`  extension to `gdb` , as it looks cool and also has some nice additional features (haven't used it to the full extent, maybe will write a post on that)

In you directory with the `main` executable ( `gcc -c lib.c -o lib.o`, `gcc -c main.c -o main.o`, `gcc lib.o main.o -o main`), run `gdb` and load the `main` file using `file main`
Let us set a breakpoint in `main` and step through to understand how `printf` is called.

If you have `pwndbg` also installed, your console will look like this 

```
pwndbg> file main 
Reading symbols from main...
(No debugging symbols found in main)
pwndbg> break main
Breakpoint 1 at 0x118a
pwndbg>
```

We have set a `breakpoint` just before our `main` fn starts (break is set on `main` fn, not the executable. Apologies for the confusing naming!)

Type `run` and press `ENTER` and you will hit the breakpoint 

```
>disas/r
Dump of assembler code for function main:
=> 0x000055555555518a <+0>:     f3 0f 1e fa     endbr64 
   0x000055555555518e <+4>:     55      push   rbp
   0x000055555555518f <+5>:     48 89 e5        mov    rbp,rsp
   0x0000555555555192 <+8>:     48 83 ec 10     sub    rsp,0x10
   0x0000555555555196 <+12>:    89 7d fc        mov    DWORD PTR [rbp-0x4],edi
   0x0000555555555199 <+15>:    48 89 75 f0     mov    QWORD PTR [rbp-0x10],rsi
   0x000055555555519d <+19>:    bf 05 00 00 00  mov    edi,0x5
   0x00005555555551a2 <+24>:    b8 00 00 00 00  mov    eax,0x0
   0x00005555555551a7 <+29>:    e8 9d ff ff ff  call   0x555555555149 <factorial>
   0x00005555555551ac <+34>:    89 c6   mov    esi,eax
   0x00005555555551ae <+36>:    48 8d 3d 4f 0e 00 00    lea    rdi,[rip+0xe4f]        # 0x555555556004
   0x00005555555551b5 <+43>:    b8 00 00 00 00  mov    eax,0x0
   0x00005555555551ba <+48>:    e8 91 fe ff ff  call   0x555555555050 <printf@plt>
   0x00005555555551bf <+53>:    b8 00 00 00 00  mov    eax,0x0
   0x00005555555551c4 <+58>:    c9      leave  
   0x00005555555551c5 <+59>:    c3      ret    
End of assembler dump.
```

Let us set a breakpoint before we call `printf@plt`. You can set up a breakpoint on an instruction's address by doing `break *addressInHex` . Let us set it to 
`break *0x00005555555551ba` and type `continue`. We will hit our breakpoint 
		
```
   0x5555555551b5 <main+43>            mov    eax, 0
 ► 0x5555555551ba <main+48>            call   printf@plt                <printf@plt>
        format: 0x555555556004 ◂— 'factorial of 5 is %d\n'
        vararg: 0x78
 
```

`pwndbg` is cool ! It shows the arguments to my `printf` even, below the instruction. As we can see, we are `call`-in the `printf@plt`. Lets step again to see what is going on. 

**slow here** 
Here is the tricky part. It took me some time to identify what is going on here. 

Lets do `disas/r` , it will show us the raw hex values of the assembly instructions instead of the disassembled instructions. 
```
disas/r
....
=> 0x00005555555551ba <+48>:    e8 91 fe ff ff  call   0x555555555050 <printf@plt>
   0x00005555555551bf <+53>:    b8 00 00 00 00  mov    eax,0x0
```

Note that we are jumping backward to addres `...5050`. Let us set a breakpoint there again (`break *0x555555555050`) and then type `continue`. we will then stop before address `...5050`

```
► 0x555555555050 <printf@plt>      endbr64 
   0x555555555054 <printf@plt+4>    bnd jmp qword ptr [rip + 0x2f75]     <printf>
    ↓
   0x7ffff7e25d70 <printf>          endbr64
```

Note the down arrow point to an address much farther than where we set our breakpoint at. Let us look at the raw assembly again

```
pwndbg> disas/r
Dump of assembler code for function printf@plt:
=> 0x0000555555555050 <+0>:     f3 0f 1e fa     endbr64 
   0x0000555555555054 <+4>:     f2 ff 25 75 2f 00 00    bnd jmp QWORD PTR [rip+0x2f75]        # 0x555555557fd0 <printf@got.plt>
   0x000055555555505b <+11>:    0f 1f 44 00 00  nop    DWORD PTR [rax+rax*1+0x0]
```

Our next instruction is a `jmp QWORD PTR [rip+0x2f75]`. When this instruction is executed, `rip`'s value is  0x000055555555505b. We add 0x2f75 to it (resulting in 0x555555557fd0). 

The `[]` around this addition signified that it is an indirect jump , i.e, we first calculate an address, read the value  `a` at this address and then jmp `a`. 

So our `jmp` reads the value at 0x555555557fd0 and then jumps to the value. Inspect the value  at 0x555555557fd0 by typing in `x/2x 0x555555557fd0` 
```
0x555555557fd0 <printf@got.plt>:        0xf7e25d70      0x00007fff
pwndbg>
```

Since I am running this on my Intel machine, the value is stored in the little-endian format (least significant bytes first). The address should therefore be interpreted as `0x00007ffff7e25d70` (reverse of what is displayed above)

Note that this matches the value when we hit the breakpoint `5050 <printf@plt>` !

This is the real `printf` ! 
**And where does this come from ?** 
Type in `info proc mappings`. 

This will show you which file /library has been loaded at which address in our process' address space. 

```
process 18722
Mapped address spaces:

          Start Addr           End Addr       Size     Offset objfile
      0x7ffff7dc1000     0x7ffff7de6000    0x25000        0x0 /usr/lib/x86_64-linux-gnu/libc-2.30.so
      0x7ffff7de6000     0x7ffff7f5e000   0x178000    0x25000 /usr/lib/x86_64-linux-gnu/libc-2.30.so
      0x7ffff7f5e000     0x7ffff7fa8000    0x4a000   0x19d000 /usr/lib/x86_64-linux-gnu/libc-2.30.so
	  ....
	  0x7ffff7fae000     0x7ffff7fb4000     0x6000        0x0 
      0x7ffff7fcc000     0x7ffff7fcf000     0x3000        0x0 [vvar]
      0x7ffff7fcf000     0x7ffff7fd0000     0x1000        0x0 [vdso]
      0x7ffff7fd0000     0x7ffff7fd1000     0x1000        0x0 /usr/lib/x86_64-linux-gnu/ld-2.30.so
      0x7ffff7fd1000     0x7ffff7ff3000    0x22000     0x1000 /usr/lib/x86_64-linux-gnu/ld-2.30.so
      0x7ffff7ff3000     0x7ffff7ffb000     0x8000    0x23000 /usr/lib/x86_64-linux-gnu/ld-2.30.so
	  ...
      0x7ffff7ffe000     0x7ffff7fff000     0x1000        0x0 
      0x7ffffffde000     0x7ffffffff000    0x21000        0x0 [stack]
  0xffffffffff600000 0xffffffffff601000     0x1000        0x0 [vsyscall]
pwndbg>
```

The address of the actual printf is in the second entry which points to `libc-2.30.so` ! This is loading is taken care of by the dynamic linker, which maps portions of `libc` that we use in our program to the process's actual address space. 

We learnt how `PLTs` can be used to link to functions whose address we do not know, by creating a stub for them and then stating that we need this stub to be filled with the address to the actual function at runtime. 