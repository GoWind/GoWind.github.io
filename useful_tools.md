`readelf`
`nm`
`pwndbg`
`gdb`
`objdump`


`objdump` uses GAS (GNU assembly) syntax ? 
Anywhere, here is how it works : 

operand source -> destination
`movb $0x05, %al`
`$` prefixed immediates
`%`prefixed registers



#### gdb commands

`file myexec` -> loads the excutable `myexec` for debugging
`start` -> starts executing the file

`starti` -> start and execute only the next instruction
(This is cool, as `start` or `break main` and `start` go directly to the user-defined main
, and most C libraries have a ton of code executed before the user-defined main is called)

`break fnname` -> sets a breakpoint at a given fnname (if it exists)
`break *0xAddress` -> sets a breakpoint at the given address (* is important)
`stepi` -> step into the next instruction
`x/Nx address` -> display N bytes of values starting at `address` in hex format. 
`x/Ni address` -> display N bytes of values starting at `address` interpreting them as instructions.
`frame` -> shows the frame of the current function under exection. 
`info proc mappings` -> shows the address space and mapping of the 
`print X` -> when you are stopped at a breakpoint, print the value of the variable `X`
`display $registerName` -> Display the value stored in the register `registerName` (e.g. eax, ebx, rax etc)
`info threads`-> show the threads launched by the process.
`info regs` -> shows the value in all the registers.
