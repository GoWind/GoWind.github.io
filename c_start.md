A lot of info is provided [here](https://embeddedartistry.com/blog/2019/04/08/a-general-overview-of-what-happens-before-main/)

`_start` is called by most c,c++ programs before `main`.

It is the linker that controls the programs entry point. 

`_start` is provided by `libc`.
`_start` is often written in assembly and is provided by the object file `crt0.o`

C, C++ standards do not specify `_start` behaviour. They mostly specify what conditions must exist before `main` excecution begins.

TODO: What does `_start` do ? 


Where is `_start` located ? 
Most OSes or platforms provide `_start` in a `crt0.o` file.

A series of `crt0...n.o` files in each platform (OS, barebone hardware etc) provide this functionality.

What does `_start` do ? 
All of the below, but not just limited to this :
1. Configuring registers
2. Initializing external memory
3. enabling caches
4. MMU
5. stack initialization 
6. stack alignment (16 bit address at start of execution in case of x86-64)
7. Frame Pointer initialization
8. C/C++ runtime setup
9. Jumping to main
10. Exiting the program once main finishes



**Note**: In Linux (Ubuntu 19.10, gcc 9.2.1), initialization starts with `_init` that is part of the final executable (questioin, does it come from `crt0.o`. Also linux doesn't seem to have any `crt0.o` file at all ). I followed the tutorial [here](https://0xax.gitbooks.io/linux-insides/content/Misc/linux-misc-3.html)

Linux + glibc defines \_start in `crt1.o` under /usr/lib/x86_64

After following tutorial ^ , you will realize that crt1.o , crti.o, crtn.o define a lot of program startup stuff. WHy does it do so ? Can we directly execute our program from main ? 
Follow this tutorial 
http://www.muppetlabs.com/~breadbox/software/tiny/teensy.html



`objdump -R` shows relocation entries only on compiled dynanic object files (ie, files linked together)