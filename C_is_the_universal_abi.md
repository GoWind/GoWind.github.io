# C is the universal ABI
A [ABI](https://en.wikipedia.org/wiki/Application_binary_interface) is a contract between the program and the Operating system / Hardware. 

Lets write a library in Zig and have it "exported" in such a way that it conforms to C ABI (the API required by C to call functions, pass arguments and return values)

```clib.zig
export fn multiplyAndAdd(x: c_int, y: c_int) c_int {
    var k: c_int = x * x;
    return k + y;
}
```
`export` -> This `fn` is to be compiled in a C ABI compatible way.
`c_int` -> an integer whose bit layout can be understood by C. 

Now lets build it into a shared dynamic library
`zig build-lib -fPIC -dynamic clib.zig`

This will output a `libclib.dylib` on the `macOS` (will be `libclib.so` on Linux)

Lets see if we can call this fn from C code. After all, this is why we exported the fn in the first place.
```main.c
#include "clib.h"
#include<stdio.h>


int main() {
  int k = 12;
  int j = multiplyAndAdd(k , 16);
  printf("%d\n", j);
}
```

``` clib.h
int multiplyAndAdd(int, int);
```

```
gcc -I. -L. main.c -o main -lclib
```
Executing this, we get
```
./main
160
```

Cool. If this is C ABI, can we use it from other languages as well ? Turns out, we can. Lets call this fn from Python 

```
import ctypes
import pathlib

if __name__ == "__main__":
    # Load the shared library into ctypes
    libname = pathlib.Path().absolute() / "libclib.dylib"
    c_lib = ctypes.CDLL(libname)
    c_lib.multiplyAndAdd.restype = ctypes.c_int
    answer = c_lib.multiplyAndAdd(ctypes.c_int(12), ctypes.c_int(16))
    print(answer)
```

```
> python pythonclib.py
160
```

C is THE universal ABI
