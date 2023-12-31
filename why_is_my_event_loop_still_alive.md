# Why is my event loop still running ? 

You can find the [source](https://github.com/GoWind/algorithms/tree/master/async_hooks_demo) to this demo in my repo. 

#### It all started with tests

Well, not a failed test, but I ran into an issue with the node built-in test runner where my unit tests completed, but my test runner wouldn't exit.
Frustrated, I switched to Jest, which detected that there might be `open handles` keeping my code from exiting. 
Running `Jest` with `--detectOpenHandles`, I was able to figure out that there was a Redis connection object in my code
that was opened, but never closed, which prevented the event loop from returning (and thus exiting). 

I didn't really understand why this would keep my event loop from exiting, but digging through the Node API, it 
looks like certain objects (like Timers, Sockets etc) can keep the event loop from exiting. An [`unref`](https://github.com/search?q=repo%3Anodejs%2Fnode%20path%3A%2F%5Edoc%5C%2Fapi%5C%2F%2F%20unref&type=code) API function
is used to detach an object from the event loop's exit condition (and similary a `hasRef()` fn tells us if an object that isn't closed can keep an event loop alive or not)

Asking chatGPT how to detect objects that might keep the event loop alive, I stumbled across [why-is-node-running](https://github.com/mafintosh/why-is-node-running), a library that uses Node's [async hooks](https://nodejs.org/dist/latest-v20.x/docs/api/async_hooks.html) to track the lifecycle of async objects.

Using the [`init`](https://nodejs.org/dist/latest-v20.x/docs/api/async_hooks.html#initasyncid-type-triggerasyncid-resource) hook, we can hook into async objects (such as Promises, Timeouts, Immediate's etc) when they are created.
When running my init and destroy hooks, however, the only kind of info I could access was the `type` of the async object and an `id` associated with it, but nothing else. 

But how do we know which part of the code (is it our code, a library, or an Node JS built-in) created it ? 

Here is where `why-is-node-running` uses an interesting trick. The V8 JS library is used by NodeJS as the JS interpreter/JITcompiler (a lot of the speed of NodeJS can be attributed to just how much wicked fast V8 is). V8 has a API that allows one to customize the `Error` object in Javascript. 
More specifically, V8 adds a `.stack` property to the Error object in Javascript, that contains the trace of the last 10 (customizable) function frames in the stack, leading upto the function where the Error object was created. The trace (stored at .stack propery) is a formatted string.

For example, here is the value of `Error.stack` on my Node Repl:

```js
$ node
Welcome to Node.js v20.6.1.
Type ".help" for more information.
> function myFunc() {
...   let err = new Error("abced");
...   console.log(`${err.stack}`);
... }
undefined
> myFunc();
Error: abced
    at myFunc (REPL14:2:13)
    at REPL15:1:1
    at Script.runInThisContext (node:vm:122:12)
    at REPLServer.defaultEval (node:repl:593:29)
    at bound (node:domain:433:15)
    at REPLServer.runBound [as eval] (node:domain:444:12)
    at REPLServer.onLine (node:repl:923:10)
    at REPLServer.emit (node:events:526:35)
    at REPLServer.emit (node:domain:489:12)
    at [_onLine] [as _onLine] (node:internal/readline/interface:416:12)
```

The formatted string stored at `.stack` can be customized. You can do this by attaching a function to the `prepareStackTrace` property of the error `Error` object. This is a function of 2 params: The Error object created and an array of callsites, where callsite is a function present in the stack above the fn where the Error object is created. The return value of this `prepareStackTrace` function is stored in the `Error.stack` property when `new Error(...)` is created. You can find more information about this in the [Stack Trace API](https://v8.dev/docs/stack-trace-api) documentation. 

`why-is-node-running` uses this trick to store a trace of the code where the async object is created. When a new async object (Promise, Timeout etc) is created, the init hooks runs. In the hook fn, the library creates a error object that is tracked along with the async object, thus pointing to where this object was initialized


```js
  init (asyncId, type, triggerAsyncId, resource) {
    if (type === 'TIMERWRAP' || type === 'PROMISE') return
    if (type === 'PerformanceObserver' || type === 'RANDOMBYTESREQUEST') return
    var err = new Error('whatevs')
    var stacks = stackback(err)
    active.set(asyncId, {type, stacks, resource})
```
`Stackback` is a library that provides some helpers around extracting the info. about the fn frames leading to the Error object

The `active` object is a global Map mapping each `asyncId` to its type, the stack of fns in the Error. 

When you need the information about why your node process is kept alive, you call the `whyIsNodeRunning` function, which iterates through the list of all async object created, identifies the ones that can keep the even loop alive (for example, Unresolved Promises do not keep the event loop alive). The objects that can keep the event loop alive, have a `hasRef` function that returns `true` when called.  An extract from the `why-is-node-running` library:

```js
function whyIsNodeRunning (logger) {
  if (!logger) logger = console

  hook.disable()
  var activeResources = [...active.values()].filter(function(r) {
    if (
      typeof r.resource.hasRef === 'function'
      && !r.resource.hasRef()
    ) return false
    return true
  })

  logger.error('There are %d handle(s) keeping the process running', activeResources.length)
  for (const o of activeResources) printStacks(o)

  function printStacks (o) {
    var stacks = o.stacks.slice(1).filter(function (s) {
      var filename = s.getFileName()
      return filename && filename.indexOf(sep) > -1 && filename.indexOf('internal' + sep) !== 0
    })
```

Well if my Node instance is stuck, how do I trigger this function ? 

Enter Unix Signals. 

We can send a Signal to a process, which triggers a signal handler to handle it. Some Signals (like KILL, SEGV) cannot be handled and the process terminates, but there are standard signals that can be customized and handled by our process. For example, SIGUSR1 and SIGUSR2 can be customized by the program for Interprocess communication or custom signal handling etc (you can also use SIGPIPE, because Node by default ignores SIGPIPE) 

In NodeJS, we can setup a signal handler on our process to execute a function when a signal is received. I set up 
the signal handler in my demo, to trigger the function that iterates through the map of async objects created to see 
what object could possibly keeping the program alive

```js
process.on('SIGUSR1', () => { console.log("captured sigterm") ; showMeTheCulprit(fd)});
```

#### Caveats 

Async Hooks have a [performance impact](https://github.com/nodejs/benchmarking/issues/181). It might be prudent to have this instrumentation as an alternate `main` function of sorts, to be used only when you run into issues and have to debug the program and not running all the time in Production

#### Conclusion
Researching on this topic was a fantastic way for me to learn a bit more about NodeJS internals and how asynchronous object work :) To more such hacking and learning
