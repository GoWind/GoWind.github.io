A dynamic loader is an executable ? that is used to load a program so that the program's `main` can start executing. 
For some details, check out t he section on `ELFs` and `System` [here](https://en.wikipedia.org/wiki/Dynamic_linker#Unix-like_systems_using_ELF,_and_Darwin-based_systems), and [here](https://greek0.net/elf.html) (https://linux-audit.com/elf-binaries-on-linux-understanding-and-analysis/#why-learn-the-details-of-elf)
and [here](https://unix.stackexchange.com/questions/467999/how-to-run-programs-with-ld-linux-so)

Dynamically linked executables

Basically, dynamically linked executables are interpreted. An interpreter has to read the contents of the elf, `mmap` the sections in the binary to the RAM before executing the `main` section of the executable.
Each `executable` hardcodes the path to the interpreter in the binary, under the `INTERP` entry, under the `dynamic` section of the library. 

This `interpreter` is the linux `ld` libary (`/usr/lib/ld-linux-x86-64.so.2`, etc)

Statically linked executables

Staticalyl linked executables do not link to `libc` statically. When run, they do not have an `mmap` section loading `libc` in their runtime memory.
To generate a statically linked executable , look in [here](https://www.systutorials.com/how-to-statically-link-c-and-c-programs-on-linux-with-gcc/)

`dlopen`
https://linux.die.net/man/3/dlopen - open dll file


## Understanding ELFs
A lot of it is documented in [these](https://stffrdh q 	rn.github.io/hardware/embedded/openrisc/2019/11/29/relocs.html) posts.


https://www.altoros.com/blog/golang-internals-part-5-the-runtime-bootstrap-process/ shows how to start debugging ELF's. `objdump -f elf-file` shows the `start address` of Execution in an ELF file.



`BFD` - binary format description  (+ library) is an abstraction library to work on object files, irrespective of  the object file format. 
`BFD` is used by readelf.



https://zig.news/gw1/learning-about-elf-with-zig-22eb
Is a blog post on learning about ELF's with Zig. 

