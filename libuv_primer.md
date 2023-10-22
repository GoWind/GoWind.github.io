# A libuv Primer

This is the first part of my post on how async file calls in Node JS works. Before we dive into the Node JS parts, I wanted to write a small primer on how `libuv` handles
`work` requests using a `threadpool`. The work consists of 2 fns : a `work fn` and an optional `callback` fn. With Node, the `work fn` will do the block file calls (`open`, `read`, `write`) etc
and the `callback` triggers the chain of calls that will end with the user provided callback being called in the end. 

The primer article's code does the following: 

1. Launch event loop on main thread
2. submit a `work` to the event loop (from the main thread) that is run in a different thread. The work fn calls `sleep()` to simulate a block operation
3. The `done` fn, which is a callback , is called in the main thread that is running the event loop
4. `uv_run` returns after all work is completed (and the callbacks called). `main` then returns and the program is terminated

```C

#include <unistd.h>

void sleeper_fn(uv_work_t*);
void after_sleeping_is_done_fn(uv_work_t*, int);

int main() {

    uv_loop_t *loop = uv_default_loop();

    pthread_t thread = pthread_self();
    printf("loop running in thread id %p\n", thread);
    uv_work_t req;
    req.data = malloc(sizeof(int));
    uv_queue_work(loop, &req, sleeper_fn, after_sleeping_is_done_fn);
    return uv_run(loop, UV_RUN_DEFAULT);
}


void sleeper_fn(uv_work_t* req) {

   pthread_t thread = pthread_self();
   printf("work function calling sleep done from thread id %p\n", thread);
  sleep(2);
  * (int*) req->data = 6;
  printf("sleeping done from sleeper\n");

}

void after_sleeping_is_done_fn(uv_work_t* req, int status) {
   pthread_t thread = pthread_self();
   printf("call back being done from thread id %p\n with work output %d", thread, * (int *) req->data);
}
```

Compiled with 
`gcc  -g -I./libuvlibs/include hellouvexample.c -L./libuvlibs/lib -o hoev -luv`

**Before compiling the program**

Downloaded [libuv](https://github.com/libuv/libuv/tree/v1.42.0) at tag `1.42.0` (wanted to use a version that doesn't use io_uring, even though it is irrelevant to macOS, to make it easier for me to understand the internal. If you are trying to re-create this blog post on Linux, using 1.42.0 will ensure that you don't use IO_URING thus ensure that my blog post on nodejs -> libuv working will make sense to you)

Follow the instructions for building `libuv` on `macOS`

```bash
./config --prefix=$(pwd)/libuvlibs` 
make
make install
```

I am installing the dynamic lib to the local folder instead of the default `/usr/local/` paths.

### OUTPUT 

```bash
loop running in thread id 0x1dd706080
work function calling sleep done from thread id 0x16fcaf000
sleeping done from sleeper
call back being done from thread id 0x1dd706080
 with work output 6%
```
