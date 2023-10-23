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

### Appendix

#### How does the event loop thread know that the worker is done, therefore the `callback` must be called ? 

It is also crucial that the even loop running in the `main` thread not block in any way for a signal from the worker thread, otherwise we will be preventing other runnables from proceeding on the event thread

Enter UNIX pipes. A pipe is a communication devices across processes / threads with one for writing and another end for reading. 

When the event loop function is  [run() uv_run](https://github.com/libuv/libuv/blob/v1.42.0/src/unix/async.c#L202) , a pipe is created and a reference to the [read](https://github.com/libuv/libuv/blob/v1.42.0/src/unix/async.c#L222) and the [write](https://github.com/libuv/libuv/blob/v1.42.0/src/unix/async.c#L224) ends are stored in the loop's data structures. The read and write ends are UNIX file descriptors.

In the [implementation](https://github.com/libuv/libuv/blob/v1.42.0/src/threadpool.c#L57) of the worker threads, when a work is available,  the `work fn` of the `work` structure is called using `w->work()`. Once the work fn is executed, the worker thread signals the event loop running thread using [uv_async_send](https://github.com/libuv/libuv/blob/v1.42.0/src/threadpool.c#L122). 

`uv_async_send(loop)` then [writes](https://github.com/libuv/libuv/blob/v1.42.0/src/unix/async.c#L188)to the write end of the pipe a single integer. It doesn't matter what is written, so long as the event loop can know that some work was done. The event loop can scan through the work queue for completed tasks during each loop iteration and run the associate callbacks 

The most interesting trick is, because a pipe read-end in UNIX is a file descriptor, it can be `polled` for events (such as READ) in a non-blocking way. The main event loop function [uv_run](https://github.com/libuv/libuv/blob/v1.42.0/src/unix/core.c#L369) constantly  [polls](https://github.com/libuv/libuv/blob/v1.42.0/src/unix/kqueue.c#L112)  descriptors it is interested in (for example, files we have opened, read or written to, client socket for making HTTP requests etc). When our work is done and the client writes to the PIPE, the event loop poller can READ the work done event and then executes all the associated callbacks of `done` events in the queue
