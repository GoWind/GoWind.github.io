# Transforming async await - II Generators

[Generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator) are objects created by a Generator Function (using the syntax `function*`) 
I thought JS added them into the language spec as a case of Python envy cause Python had generators whereas JS didn't. Turns out that isn't quite the case and Generators have a very valid usecase in JS

Lets take an example of Generators


```js
$ node
Welcome to Node.js v20.6.1.
Type ".help" for more information.
// rangeYielder is a Generator Function
> function* rangeYielder(n) {
... for(let i = 0; i < n ; i++) {
...     yield i;
...  }
... }
undefined

> tillFive = rangeYielder(5);
Object [Generator] {} // This is really a Generator Instance
> tillFive.next()
{ value: 0, done: false }
> tillFive.next()
{ value: 1, done: false }
> tillFive.next()
{ value: 2, done: false }
> tillFive.next()
{ value: 3, done: false }
> tillFive.next()
{ value: 4, done: false }
> tillFive.next()
{ value: undefined, done: true }
>
```

The Generator Function (GenFn from here on) looks like a normal function, but behaves in a different way. When we call GeneratorFunction() , it returns a generator instance, but doesn't run the body of the GenFn right away. 

To do so, you must call the `.next()` method on the instance, whereupon, the body of the GenFn is run until it hits the first `yield` statement (or if there isn't any, it runs till completion)

Calling `next()` will return a value of type `{value: someValue, done: true/false}`. 
`someValue` is the value returned by the `yield someValue` expression.
`done` is `true` when the body of the GenFn is run till its end. In the above example, once our loop ends, we reach the end of the fn, so in the 6th call to `.next()`, we get `done: true`

What happens when we call `.next()` on a generator and it hits a `yield` statement. The generator pauses, and  `yields` to the caller with the value of the `yield` expression. When we call `.next()` on the generator object, the generator will resume from the statement / expression after the yield statement. In the case of 

```js
for(let i = 0; i < n ; i++) {
...     yield i;
...  }
```

when we call `.next()` , we resume the next loop iteration. Note that Generator instances store the state of their local variables (`i` in this case), so when they are resumed, they will continue as if their execution was not interrupted. When `i` equals `n`, we exit the loop and also return from the fn, thus ending the generation of values. In this case the value returned will be `{value: undefined, done: true}`. Call `.next()` on the same Generator will continue return `{value: undefined, done: true}` after the generator is done. 


## Generators can also take values as input

Another nifty feature of generators is that they can also takes values as input when resuming a paused generator

```js 
> function* valuePrinter(n) {
...   const input = yield 5;
...   console.log(`I got ${n + input}`);
... }
undefined
> let vp = valuePrinter(10);
undefined
> let m = vp.next();
undefined
> m
{ value: 5, done: false }
> vp.next(7);
I got 17
{ value: undefined, done: true }
```

Notice the expression `const input = yield 5;`. What does this mean ? 
1. When the generator is run for the first time by calling `.next()`, return with `{value: 5, done: false}`
2. When the generator is resumed using `.next()` again, we can pass `.next` a value `A`. `input` is now assigned/bound this value `A` (or it stays undefined, if we do not pass any value in `.next()`). The execution now proceeds as normal. 

**NOTE**: Please run the example above and write your examples to really understand this way of yielding / resuming generators. This feature is the core aspect of making async/await work without needing `async/await` expressions. 

This feature of generators, to be able to suspend and resume with a input is a way to do `co-operative threading`, where if a `thread of execution` knows it can potentially block on an operation (say, `op1`), it can  `yield` to a controlling thread of execution. The controlling thread of execution, once `op1` is done , can take the value of `op1` and resume the generator by calling it with `generator.next(valueFromOp1)`.


### Yielding and Resuming with Promises

We sometimes have operations that can potentially take an arbitrary amount of time to finish (such as `fetch` a HTTP request, reading a file , writing to a file / socket etc). How can we represent the result of such an operation without blocking on it ? 

Javascript already answers this question using `Promise`s. A Promise is an object, that is resolved once its operation is completed. We can chain operations to be done after a Promise is `resolved` using a Promise's `.then()` method.

```js
fetch("https://google.com").then((response) => {if(response.ok) {..}}})
```

So we have a 
1. Promise: a  primitive for representing operations that might take an arbitrary amount of time
2. Generators: A primitive that can `yield/suspend` when executing an operation that takes arbitrary amounts of time. 

Can we put these two together to simulate async/await ? 

Turns out, we can ! 

[Part III](https://gowind.github.io/async_await_transforms_part3.html) will explain the snippet in Part I based on our current understanding of Generators and Promises.
