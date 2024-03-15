---
title: Thread Local Storage on macOS
---

How are thread local variables implemented on macOS ? Through some debugging, Googling and reading the source, lets figure out how. 

A thread local variable is a variable declared in the program that is accessed like a common variable, but each thread has a unique copy of the variable. When a thread in the program modifies this variable, the modification is visible only to the thread that modified it and not the other threads (consequently, the other threads might see other values based on if and when they modify the variable)

Lets take an example. The variable `i` is `thread local` (`__thread` is a GNU extension to the C language). We create 3 threads, each of which increment `i` by 1. If all the threads add 1 to `i`, and `i` were a normal variable, then `i` must be 14.
But since `i` is defined as `thread local`, each thread gets a copy of `i`, initialized to `10` and then each thread increments it by `1`, equaling `11` in each thread.
We can verify this behaviour. 

```
#include<stdio.h>
#include<pthread.h>

__thread int i = 10;
void increment_i(void);
int main() {

  pthread_t t1, t2, t3;
  int ret1, ret2, ret3;
  ret1 = pthread_create(&t1, NULL, (void *)increment_i, NULL);
  ret2 = pthread_create(&t2, NULL, (void *)increment_i, NULL);
  ret3 = pthread_create(&t3, NULL, (void *)increment_i, NULL);

  pthread_join(t1, NULL);
  pthread_join(t2, NULL);
  pthread_join(t3, NULL);

  return 0;
}


void increment_i() {
  int k = i + 1;
  i = k;
  printf("value of k is %d\n", k);
}
```

compiling it 
`gcc tlocal.c -o tlocal -lpthread`

and executing it 
```
./tlocal
value of k is 11
value of k is 11
value of k is 11
```

### So how are thread local variables implemented ? 

To understand this, we need to setup a breakpoint in `increment_i` to observe the behavior. Lets load up our executable in lldb and step through the code. 

`>lldb --file tlocal`
```
(lldb) b increment_i
Breakpoint 1: where = tlocal`increment_i, address = 0x0000000100003f64
(lldb) run
Process 95169 launched: '/Users/govind/gowind-whisper/tlocal' (arm64)
Process 95169 stopped
* thread #2, stop reason = breakpoint 1.1
    frame #0: 0x0000000100003f64 tlocal`increment_i
tlocal`increment_i:
->  0x100003f64 <+0>:  sub    sp, sp, #0x20
    0x100003f68 <+4>:  stp    x29, x30, [sp, #0x10]
    0x100003f6c <+8>:  add    x29, sp, #0x10
    0x100003f70 <+12>: adrp   x0, 5
  thread #3, stop reason = breakpoint 1.1
    frame #0: 0x0000000100003f64 tlocal`increment_i
tlocal`increment_i:
->  0x100003f64 <+0>:  sub    sp, sp, #0x20
    0x100003f68 <+4>:  stp    x29, x30, [sp, #0x10]
    0x100003f6c <+8>:  add    x29, sp, #0x10
    0x100003f70 <+12>: adrp   x0, 5
  thread #4, stop reason = breakpoint 1.1
    frame #0: 0x0000000100003f64 tlocal`increment_i
tlocal`increment_i:
->  0x100003f64 <+0>:  sub    sp, sp, #0x20
    0x100003f68 <+4>:  stp    x29, x30, [sp, #0x10]
    0x100003f6c <+8>:  add    x29, sp, #0x10
    0x100003f70 <+12>: adrp   x0, 5
Target 0: (tlocal) stopped.
(lldb)
```

3 threads are launched and all stop at the beginning of `increment_i`
Lets select one thread and step through it, to make it less confusing. 

```
thread select 4
* thread #4, stop reason = breakpoint 1.1
    frame #0: 0x0000000100003f64 tlocal`increment_i
tlocal`increment_i:
->  0x100003f64 <+0>:  sub    sp, sp, #0x20
    0x100003f68 <+4>:  stp    x29, x30, [sp, #0x10]
    0x100003f6c <+8>:  add    x29, sp, #0x10
    0x100003f70 <+12>: adrp   x0, 5
```

Now, what we are interested in is the `adrp` instruction. As covered in the previous [post](https://github.com/GoWind/GoWind.github.io/blob/master/got_stubs_and_linking.md) , we use the `GOT` (global offset table) to load the address of a global variable. The address is at a fixed offset from the base of the GOT. We then fetch the value of the variable from the address. 
`adrp` sets `x0` to an offset into the GOT (GOT + some value), where we will find the address of our global variable. we then load the actual value of our variable from this address (using `ldr x0, [x0]`)

#### In this case, we can't use a GOT. Why ? 
All threads share the same memory space. If var `i` is stored at address `x`, then all threads will see the same address `x` when they try to load the value for `i`. In `increment_i`, we aren't using any thread index or other thread specific identifiers (atleast directly) to load a different address in each thread, so that each thread gets a copy of `i`. 
How does it work then ? 

The answers is how thread local storage works. Thread local data (variables) are stored in a section called `thread_vars` and `thread_bss` (`tdata` and `tbss` on Linux systems). You can see them by dumping the sections present in the image (executable file ) in lldb

```
(lldb) image dump sections tlocal
Sections for '/Users/govind/gowind-whisper/tlocal' (arm64):
  SectID     Type             Load Address                             Perm File Off.  File Size  Flags      Section Name
  ---------- ---------------- ---------------------------------------  ---- ---------- ---------- ---------- ----------------------------
  0x00000100 container        [0x0000000000000000-0x0000000100000000)* ---  0x00000000 0x00000000 0x00000000 tlocal.__PAGEZERO
  0x00000200 container        [0x0000000100000000-0x0000000100004000)  r-x  0x00000000 0x00004000 0x00000000 tlocal.__TEXT
....
  0x00000005 regular          [0x0000000100008000-0x0000000100008018)  rw-  0x00008000 0x00000018 0x00000013 tlocal.__DATA.__thread_vars
  0x00000006 regular          [0x0000000100008018-0x000000010000801c)  rw-  0x00000000 0x00000000 0x00000012 tlocal.__DATA.__thread_bss
  0x00000500 container        [0x000000010000c000-0x0000000100010000)  r--  0x0000c000 0x00000403 0x00000000 tlocal.__LINKEDIT
```

Our thread local variables seem to have an address somewhere between `0x0000000100008000`-`0x000000010000801c`.
Let us see what is the address we get for `i` when we read the value of `i` in each thread
```
(lldb) stepi -c 3
...
* thread #4, stop reason = instruction step into
    frame #0: 0x0000000100003f70 tlocal`increment_i + 12
tlocal`increment_i:
->  0x100003f70 <+12>: adrp   x0, 5
    0x100003f74 <+16>: add    x0, x0, #0x0              ; i
    0x100003f78 <+20>: ldr    x8, [x0]
    0x100003f7c <+24>: blr    x8
...
* thread #4, stop reason = instruction step into
    frame #0: 0x0000000100003f74 tlocal`increment_i + 16
tlocal`increment_i:
->  0x100003f74 <+16>: add    x0, x0, #0x0
    0x100003f78 <+20>: ldr    x8, [x0]
    0x100003f7c <+24>: blr    x8
    0x100003f80 <+28>: ldr    w8, [x0]
Target 0: (tlocal) stopped.
(lldb) register read x0
      x0 = 0x0000000100008000  tlocal`i
(lldb) stepi
...
* thread #4, stop reason = instruction step into
    frame #0: 0x0000000100003f78 tlocal`increment_i + 20
tlocal`increment_i:
->  0x100003f78 <+20>: ldr    x8, [x0]
    0x100003f7c <+24>: blr    x8
    0x100003f80 <+28>: ldr    w8, [x0]
    0x100003f84 <+32>: add    w8, w8, #0x1
Target 0: (tlocal) stopped.
(lldb) register read x0
      x0 = 0x0000000100008000  tlocal`i
(lldb) stepi
* thread #4, stop reason = instruction step into
    frame #0: 0x0000000100003f7c tlocal`increment_i + 24
tlocal`increment_i:
->  0x100003f7c <+24>: blr    x8
    0x100003f80 <+28>: ldr    w8, [x0]
    0x100003f84 <+32>: add    w8, w8, #0x1
    0x100003f88 <+36>: stur   w8, [x29, #-0x4]
Target 0: (tlocal) stopped.
(lldb) register read x8
      x8 = 0x000000018c84d120  libdyld.dylib`tlv_get_addr
(lldb)
```

`adrp x0` gives us the value `0x0000000100008000`. 
Reading the value stored at this address, we see that this value is not the value of `i` proper, but is in turn, another address, that points to a fn `tlv_get_addr` instead. 

`tlv_get_addr`, seems to be an macOS specific fn, which is part of the dynamic linker (`dyld`) on macOS. dyld seems to be mapping itself into the address space of the process, so that the process can , in situations like these, can use fns present in `dyld` .
We can check this using `image lookup`.

```
(lldb) image lookup -r -n tlv_get_addr #lookup a fn using a regex value tlv_get_addr
1 match found in /usr/lib/system/libdyld.dylib:
        Address: libdyld.dylib[0x00000001803d5120] (libdyld.dylib.__TEXT.__text + 3088)
        Summary: libdyld.dylib`tlv_get_addr
```

Stepping over this call to `tlv_get_addr`, we see that this fns returns a value in `x0`. **THIS** seems to be the actual address of our variable `i`  and in the next  instructions, we are adding `1` to our variable `i` (`k = i + 1` in our code)

```
(lldb) thread step-over
Process 95169 stopped
* thread #4, stop reason = instruction step over
    frame #0: 0x0000000100003f80 tlocal`increment_i + 28
tlocal`increment_i:
->  0x100003f80 <+28>: ldr    w8, [x0]
    0x100003f84 <+32>: add    w8, w8, #0x1
    0x100003f88 <+36>: stur   w8, [x29, #-0x4]
    0x100003f8c <+40>: ldur   w8, [x29, #-0x4]
Target 0: (tlocal) stopped.
(lldb) register read x0
      x0 = 0x000060000000c000
(lldb) stepi
Process 95169 stopped
* thread #4, stop reason = instruction step into
    frame #0: 0x0000000100003f84 tlocal`increment_i + 32
tlocal`increment_i:
->  0x100003f84 <+32>: add    w8, w8, #0x1
    0x100003f88 <+36>: stur   w8, [x29, #-0x4]
    0x100003f8c <+40>: ldur   w8, [x29, #-0x4]
    0x100003f90 <+44>: str    w8, [x0]
Target 0: (tlocal) stopped.
(lldb) register read w8
      w8 = 0x0000000a
```

Switching to a different thread, we can see that after the `blr x8` call, our `x0` has a different address, which according to thread #3, is the address of the variable `i`

```
(lldb) thread select 3
* thread #3
    frame #0: 0x0000000100003f80 tlocal`increment_i + 28
tlocal`increment_i:
->  0x100003f80 <+28>: ldr    w8, [x0]
    0x100003f84 <+32>: add    w8, w8, #0x1
    0x100003f88 <+36>: stur   w8, [x29, #-0x4]
    0x100003f8c <+40>: ldur   w8, [x29, #-0x4]
(lldb) register read x0
      x0 = 0x0000600000010000
(lldb) stepi
Process 95169 stopped
* thread #3, stop reason = instruction step into
    frame #0: 0x0000000100003f84 tlocal`increment_i + 32
tlocal`increment_i:
->  0x100003f84 <+32>: add    w8, w8, #0x1
    0x100003f88 <+36>: stur   w8, [x29, #-0x4]
    0x100003f8c <+40>: ldur   w8, [x29, #-0x4]
    0x100003f90 <+44>: str    w8, [x0]
  thread #4, stop reason = trace
    frame #0: 0x0000000100003f84 tlocal`increment_i + 32
tlocal`increment_i:
->  0x100003f84 <+32>: add    w8, w8, #0x1
    0x100003f88 <+36>: stur   w8, [x29, #-0x4]
    0x100003f8c <+40>: ldur   w8, [x29, #-0x4]
    0x100003f90 <+44>: str    w8, [x0]
Target 0: (tlocal) stopped.
(lldb) register read w8
      w8 = 0x0000000a
```

Thread local variables are thus, through one simple indirection, available to userspace programs on macOS.
Linux provides a similar call `tls_get_addr`. You can find more documentation on how TLS works in  [here](https://stffrdhrn.github.io/hardware/embedded/openrisc/2020/01/19/tls.html)
