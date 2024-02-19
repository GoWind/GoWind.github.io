---
title: WTF is `glibc`?
---

C is a language + a standard that lists out certain features that has to be provided.
There are 2 standareds - 
1. `ANSI` or `standard` C (open, read, write, printf etc)
2. `POSIX` C (pthreads semaphores, mutexes etc)

Each standard provides a set of functionality, a lot of which need to call operating specific functions (System calls).

`glibc` (or GNU C library), and other C libraries, provide the interface `headers` and `functions`  that  call the operating system specific routines/system calls etc to provide the functionality defined in `ANSI` or `POSIX`

Note; `ANSI` and `POSIX` seem to be the most standard. OSes like Linux have additional APIs that are also provided by `glibc` , but they are probably not standard across operating systems. 

WTF is `musl` ?
`glibc` is heavy, because it provides A LOT of features. 
`musl` is an alternative `glibc` implementation that is more lightweight and can also be **statically linked**. 

`statically` linked => no need of a `libc.so` needed at runtime to run the executable.

For more information look at how Executables in Linux are actually executed in [[From Source Code to Hello World/ELFs and Loaders]]

### How to link an application with `musl`
`glibc` The GNU C library
TODO: 

### Musl  documentation
Start from [Part III - Programmer's Manual](https://musl.libc.org/doc/1.1.24/manual.html)
### Once we link an application, how can we tell the difference ? 
TODO: 