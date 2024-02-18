---
title: Transforming async await - III Stepping the Generator
date: Feb 18, 2024
---

This is a continuation of a three part series: [Part I](async_await_transforms_part1.html), [Part II](async_await_transforms_part2.html)



Let us go back to the original example: 

```js
async function getTextOrBust() {
	const resp = await fetch("https://google.com");
	if(resp.ok) {
		const body = await resp.text();
		return body;
	} else {
		throw Error("Cannot fetch goog");
	}
}
```


This was re-written as 
```js
function getTextOrBust() {
    return __awaiter(this, void 0, void 0, function* () {
        const resp = yield fetch("https://google.com");
        if (resp.ok) {
            const body = yield resp.text();
            return body;
        }
        else {
            throw Error("Cannot fetch goog");
        }
    });
}
```

Notice how when we `await` a Promise in our original code, we now `yield` the same Promise in our transpiled code ? And that `async function`s return a `Promise<ReturnType>` and similarly, our Transformed function returns a Promise ? 

1. The body of our original function is transformed from a normal fn's body to that of a Generator Function. 
2. We wrap the Generator Fn inside an `__awaiter` that knows how to resume our body after an operation it is waiting for, is complete. 

The first iteration of our `__awaiter` might have looked something like this:

```js
function __awaiter(..., generatorFn) {
		let generator = generatorFn();
		let val = generator.next();
		if(generator.done) {
			return Promise((res, rej) => { res(val.value)})
		} else {
			if(! val.value instanceof Promise) {
				Promise((resolve) => resolve(val.value)).then((v)
				=> generator.next(v))
			} else {
				val.value.then((v) => generator.next(v))
			}
		}

}
```

So what are we doing here ? 
1. Run our function (Generator instance)
2. If the Generator instance runs till completion, return a Promise that resolves with the value of our generator instance.
3. Else, The Generator instance is waiting for a Promise to resolve. Chain the `generator.next()` to the Promise using `.then` so that we can resume our generator with the resolved value. 

Running the example: 
```js
 return __awaiter(this, void 0, void 0, function* () {
        const resp = yield fetch("https://google.com");
        if (resp.ok) {
            const body = yield resp.text();
            return body;
        }
        else {
            throw Error("Cannot fetch goog");
        }
    });
```

1. We run `function*` inside `__awaiter` by calling `.next()` first.
2.  we reach `const resp = yield fetch(...)` . We suspend the generator instance with the return value of `fetch`: A promise.
3. We check if `generator.done` is true. It is false, as we haven't finished running the body of the generator instance. 
4. We therefore chain our generator to resume once the `fetch` Promise resolves , with the value resolved by the fetch Promise.
5. Execution resumes at `const resp ...` . By now fetch Promise has resolved and the generator is resume with the value of this Promise, so resp will contain the actual response object.
6. We then proceed till we hit the next `yield` or return statement. 


### What happens when we await multiple times in our async fn ?

Note that in the `__awaiter` implementation above , we resume  `Promise.then((v) => { generator.next(v)}))` only once, but our Generator Function can have any number of yield expressions in the body. How do we ensure that we handle an arbitrarily large body with multiple `yield` statements ? (Notice that both fetch and response.text() return Promises, so we need to suspend and resume our generators twice)

We do that by being a bit clever 

```js
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    // if value is not a Promise, then return a Promise that resolves with value
    // else return value as it is
    function adopt(value) { 
        return value instanceof P ? value : new P(function (resolve) { resolve(value); }); 
    }
    // turns the return value of any fn passed into a Promise
    return new (P || (P = Promise))(function (resolve, reject) {
        // create a Generator Instance out of our given fn body 
        const genInstance = generator.apply(thisArg, _arguments || []);
        
        const fulfilled = (value) => { try { 
                      step(genInstance.next(value)); 
                    } catch (e) { reject(e); }
        } 
        const rejected = (value) => { try { step(genInstance["throw"](value)); } catch (e) { reject(e); } }
        
        function step(result) { 
            if(result.done) { 
              resolve(result.value) 
            } else {
              adopt(result.value).then(fulfilled, rejected); 
            }
        }
        step(genInstance.next());
    });
};
```

Lets start with top level statements that will be executed :
1. `return new ((P || (P = Promise))(function (resolve, reject)..` runs first
2. It first creates a `const genInstance` Generator Instance
3. Then `step(genInstance.next())` is executed
4. `step(result)` checks if our generator instance is `done`. If there are no `await` statements in the original code (which are replaced with `yield` in the transpiled code), it runs to completion , thus setting `done` to true. `step` then resolves the Promise from 1. with the value of our generator instance
5. if `result.done` is false, it means we probably hit a `yield/await` statement that needs a Promise to resolve. since `yield fetch(..)` will return a Promise, `result.value` is a Promise. `adopt(result.value).then(fulfilled, rejected);` chains our generator to resume after the Promise is resolved.


The lines we have to pay attention to most is `const fulfilled = (value) {...}` and in the `else` clause in the function `step`

When a promise returned by `yield fetch` or `yield resp.text()` is `adopt`ed , we need to `step` the generator, not just do `generator.next()`. The function `step` is rightly named so, as it steps an execution of the generator and if the generator isn't done, sets itself up recursively to be called again and again till the generator is completed. 

This recursive stepping is captured in the function `fulfilled`:
```js
const fulfilled = (value) => {
	try {
	  step(genInstance.next(value)); // recursive step
	} catch (e) {
		reject(e);  // reject our top level Promise if we encounter errors during
			        // execution
	}
}
function step(result) { 
	if(result.done) { 
	    resolve(result.value) 
    } else {
	    // fulfiled will call step again, thus stepping until at some point
	    // result.done is true, thus breaking the recursion
	    adopt(result.value).then(fulfilled, rejected); 
    }
}
```

If we remove all the noise in our `__awaiter`, keeping the above recursion in mind, we can see essentially the gist of how an `async function` with `await` statements can be transformed into a generator that we step through until it is done, `yield` at every Promise (await) and resuming once the Promise is resolved :

```js
var __awaiter = function (thisArg, _arguments, P, generator) {
    
    // turns the return value of any fn passed into a Promise
    return new (P || (P = Promise))(function (resolve, reject) {
        // create a Generator Instance out of our given fn body 
        const genInstance = generator.apply(thisArg, _arguments || []);
        // function step(result){ if(result.done) { resolve(result.value)} else {...}}
        step(genInstance.next());
    });
};
```


### Conclusion

async/await in Javascript can be implemented using Generators. For a long time I wondered how it was done, but turns out the transpiled code is surprisingly understandable. The only tricky part is to grok how the recursive stepping is setup, using `step` and `fulfilled` (which in return calls step). 
The best way to grok this is by running the [snippet](https://github.com/GoWind/algorithms/blob/master/fetch_transformer.js) under a Debugger and setting a breakpoint in the `fulfilled` and `step` fns. The best way to understand a piece of code is to simulate it step by step and inspect the results, just like the await transformer does ! 

