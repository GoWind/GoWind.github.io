The `file` view of an ELF is sections - parts that take part in different usecases.
Sections are defined by Section Headers.
Examples of sections are:
`.text` : assembly instructions 
`.rodata` : Read-only data
`.bss`: Read only initialized data 


## Section Headers
Sections, their types and permissions are defined by a `Section Header`. 
Section Headers are stored as an array in the ELF, starting at offset `e_shoff`  (which is defined in the ELF Header)

`readelf -S /path/to/elffile`  lists the sections in the Header file 

How do we know what the name of a section is ? Each section holds a field: `sh_name`, that is an offset into the `String Table`

##### And what is a `String Table` ? 
A `STRTAB` is itself a section in an ELF. It is a linear array, where the first byte is `0x00` followed by NULL terminated strings, ending in an `0x00`.  Each string is used for either naming `symbols` (more on that later) or sections or other purposes (debugging, maybe ?).

#### Convenience
To make computation easy, we can use the following fields in the ELF header, to peek at the String Table. 
1. `e_shoff`  : offset into  file to the section Headers array.
2. `e_shentsize` : Size of each section header.
3. `e_shstrndx`  points to the index of the STRTAB in the Section Header array. 
4. . String Table Header offset = File[`e_shoff` + `e_shentsize` * `e_shstrndx`]
5. 4. Actual String Table = (String Table Header).`sh_offset`
 

 #### Miscellaneous Sections.
 
`.eh_frame` is for Exception Handling frames (for languages that support exceptions , such as C++)
https://refspecs.linuxfoundation.org/LSB_3.0.0/LSB-PDA/LSB-PDA/ehframechpt.html
Can be disabled with `-fno-asynchronous-unwind-tables` (https://stackoverflow.com/questions/26300819/why-gcc-compiled-c-program-needs-eh-frame-section)
DWARF debugging symbols (`gcc -g`) are stored in `.debug_frame`