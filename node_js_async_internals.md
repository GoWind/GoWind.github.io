
# Node JS internals: How async file system calls work

### Note: The internal details of NodeJs (parts that are not exposed as an API) will always be subject to change. 
This post was written based on the Node JS source code at commit [f09a50c39d92efd5ed65a87fb07f64675baa8774](https://github.com/nodejs/node/blob/f0995d14768b36c3cbb2d75d57b0ff92b254b334/src/node_file-inl.h#L307). The info in this post might become
obsolete if and when Node JS internals change (althought that might be rare, but nevertheless still possible)

As discussed in our [lib_uv primer](https://github.com/GoWind/GoWind.github.io/blob/master/libuv_primer.md) , we know how we can execute a fn (`work`) to be run in a worker on libuv's threadpool and then have a callback fn execute on the main thread, once `work` is executed on a worker thread) 

The fn `uv_fs_open` is used to open a file without blocking the main/event thread (as `open` in most UNIXes is a blocking call). It does so by submitting a `work` fn that is the `open` call with a `uv__fs_done` callback fn. 

In the `uv_fs_open` implementation , we are expanding the `INIT, PATH and POST` macros, to show what happens under the hood. 

Node JS `open` wraps `uv_fs_open` in a way that we can open the file in a worker thread and have the user provided JS callback fn execute on the event thread. We are basically looking at how this flow works.
```
int uv_fs_open(uv_loop_t* loop,
               uv_fs_t* req,
               const char* path,
               int flags,
               int mode,
               uv_fs_cb cb) {
  INIT(OPEN);
  PATH;
  req->flags = flags;
  req->mode = mode;
  POST;
}
```
INIT, PATH and POST are macros that expand to code like
```
do {                                                                        \
    if (req == NULL)                                                          \
      return UV_EINVAL;                                                       \
    UV_REQ_INIT(req, UV_FS);                                                  \
    req->fs_type = UV_FS_OPEN                                        \
    req->result = 0;                                                          \
    req->ptr = NULL;                                                          \
    req->loop = loop;                                                         \
    req->path = NULL;                                                         \
    req->new_path = NULL;                                                     \
    req->bufs = NULL;                                                         \
    req->cb = cb;                                                             \
  }                                                                           \
  while (0)


  do {                                                                        \
    assert(path != NULL);                                                     \
    if (cb == NULL) {                                                         \
      req->path = path;                                                       \
    } else {                                                                  \
      req->path = uv__strdup(path);                                           \
      if (req->path == NULL)                                                  \
        return UV_ENOMEM;                                                     \
    }                                                                         \
  }                                                                           \
  while (0)
 .req->flags = flags;
  req->mode = mode;

  do {                                                                        \
    if (cb != NULL) {                                                         \
      uv__req_register(loop, req);                                            \
      uv__work_submit(loop,                                                   \
                      &req->work_req,                                         \
                      UV__WORK_FAST_IO,                                       \
                      uv__fs_work,                                            \
                      uv__fs_done);                                           \
      return 0;                                                               \
    }                                                                         \
    else {                                                                    \
      uv__fs_work(&req->work_req);                                            \
      return req->result;                                                     \
    }                                                                         \
  }                                                                           \
  while (0)
```

If we pass a callback function (which is almost always), `uv_fs_open` submits a req of type `FAST_IO` using [uv__work_submit](https://github.com/libuv/libuv/blob/v1.42.0/src/threadpool.c): 
```
void uv__work_submit(uv_loop_t* loop,
                     struct uv__work* w,
                     enum uv__work_kind kind,
                     void (*work)(struct uv__work* w),
                     void (*done)(struct uv__work* w, int status)) {
  uv_once(&once, init_once);
  w->loop = loop;
  w->work = work;
  w->done = done;
  post(&w->wq, kind);
}
```

`w->work` is the function that is executed by the worker thread. `post` adds this work item to the work queue.
The worker fn [picks](https://github.com/libuv/libuv/blob/v1.42.0/src/threadpool.c#L122) up the work and executes the work function

The flow of code from JS -> C++ -> C is as follows

[JS `open`](https://github.com/nodejs/node/blob/main/lib/fs.js#L563) : `fs.open(path, options, callback)`
           1. create a `req: FSReqCallback` = `Req(context(callback))`
          `req` has an `oncomplete` member, that will be called after req is done
          the oncomplete simply calls `callback()`, which is the User provided callback
          2. call into Node C++ : `binding.open(path, flags, mode:666, req)`
          
[binding.Open](https://github.com/nodejs/node/blob/main/src/node_file.cc#L1958): 
		 1.If a `req` argument is provided, the file is opened asynchronously
		 2. make `req_wrap_async: FSReqBase = FSReqBase(req)` 
		 3. why do we wrap req ? req is a `FSReqCallback` which is an object that lives in JS land. We need to wrap it in a `BaseObject`,which is the abstraction used to tie JS objects to the C++ world.
            (I am not sure why we can't just pass around a v8::object without wrapping it in a BaseObject, probably because we need to increment the ReferenceCount to this object so that it isn't GC'ed while waiting for something to happen in CPP/C land)
        Some understanding of Class Hierarchy is needed here:  
	    The order of sub-classes (super -> sub) : BaseObject -> ReqWrap -> FSReqBase (ReqWrap<uv_fs_t>)
	      FSReqBase is a parametrized sub-class of ReqWrap<uv_fs_t> which => that it deals with fs `requests` (A `request` in lib_uv is a short action (such as opening a file, reading a file etc))
	From Open, we call `uv_fs_open`, the `libuv` file that is used to open a file, asynchronously, via `AsyncCall`
 
[AsyncCall](https://github.com/nodejs/node/blob/main/src/node_file.cc#L1981)
          This is a wrapper over `AsyncDestCall` with a extra `nullptr` argument
          
[AsyncDestCall](https://github.com/nodejs/node/blob/main/src/node_file-inl.h#L295) 
`AsyncDestCall(env, req_wrap_async, args, "open",UTF8,nullptr,0,AfterInteger,
                                                `uv_fs_open, *path, flags, mode)
         `req_wrap_async`: A C++ land wrapper over our user passed JS Callback (which is FSReqCallback(user_provided_callback)) 
         Before calling `uv_fs_open`, we have to do a few things
         Init req_wrap_async with a name of the syscall we want to do (`open` in this case)
         call `req_wrap_async->Dispatch(uv_fs_open, ..args, AfterInteger)`
         
[Dispatch](https://github.com/nodejs/node/blob/f0995d14768b36c3cbb2d75d57b0ff92b254b334/src/req_wrap-inl.h#L139): 
`int ReqWrap<T>::Dispatch(LibuvFunction fn, Args... args) {`
         Dispatch is where `uv_fs_open` is actually called
         The signature of `uv_fs_open` looks like: `int uv_fs_open(uv_loop_t *loop, uv_fs_t *req, const char *path, int flags, int mode, uv_fs_cb  cb)`
          What is the responsibility of each arg to `uv_fs_open` ? 
          1. `loop` -> The event loop to which we submit our `work` that is opening a file.
          2. `req` -> denotes that we are operating on a file (`uv_fs_t`). `req` can contain a pointer to some arbitrary data that will be of use later
          3. `char* path` : The path to the file that we want to open
          4. `flags` and `mode`: The flags and mode with we want to open the file (lookup `man 2 open`  on macOS)
          5. `cb`: A callback function to be called once our file is opened. This callback function will be passed the `req` that we passed in the `uv_fs_open`. We have a C++ function: `AfterInteger` that is passed as the callback function.
              There is a lot of funkiness about how `AfterInteger` is called. It is first  [Wrapped](https://github.com/nodejs/node/blob/main/src/req_wrap-inl.h#L129) in some sort of C++ template magic.This is done so that our `JS` function can be called by the C `uv__fs_done` function (that is run after our `open` call)
              
[AfterInteger](https://github.com/nodejs/node/blob/main/src/node_file.cc#L828)
    If you do not understand this section , feel free to ignore it. Basically, our original JS callback, provided by the user to `fs.open(...)` is called in AfterInteger, thus finishing our code cycle.
    
When AfterInteger  is called, our `open` call is done and we have the result of the call. Assuming, we opened the file successfully, we need to fetch the callback passed by the user, so that we can execute it. Recall that our `uv_fs_open` calls the callback with a `uv_fs_t` data structure. So how do we get back the original FSReqCallback structure, from a `uv_fs_t` data structure ? We use the [container_of](https://github.com/nodejs/node/blob/main/src/node_file.cc#L820) magic to get the wrapping data structure of our `uv_fs_t`  (which is FSReqCallback). AfterInteger calls [Resolve](https://github.com/nodejs/node/blob/main/src/node_file.cc#L717) on `FSReqCallback`, which finally executes our user provided callback fn 



