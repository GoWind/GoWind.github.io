---
title: Transforming async await - I
date: Feb 18, 2024
---

This is the first of the three part series: [Part II](async_await_transforms_part2.html), [Part III](async_await_transforms_part3.html)


When compiling some Typescript code in JS for a backend service at work, I had set the `target` to `es5` and I saw that the emitted code did not have any `async/await` statements.
`async/await` was not introduced in JS until ES2017, but clearly we are able to transpile code with `async/await` into `es5` or `es2015` JS. 

So how does `async/await` work ? Lets transpile this to `ES2015` JS and see for ourselves.

(I could have also chosen `ES5`, but `ES5` does not have native support for Promises and implementing Promises on ES5 would have become even more complicated, so I am sticking to ES2015 (or ES6) which has native Promises, so we only have to figure out how to implement async/await )

This is our code with `async/await`

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
(async () => {
	let k = await getTextOrBust(4);
	console.log(k);
})();
```

`getTextOrBust` makes a https call to "google.com" and if the response is HTTP 200, returns the body (as text) of the response. Both `fetch` and `.text()` methods return a Promise, so to use them as norma values, we need to prefix them with an `await` expression. 

`await` expressions are not allowed, unless they are inside functions marked `async`, so our `getTextOrBust` becomes an `async` function. 

Since top-level `await`s weren't added until ES2022, I am simulating a top-level await by creating an IIFE (immediately invoked function expression, to run the async function in the module till completion)

The [Typescript Playground](https://www.typescriptlang.org/play?target=2&ssl=20&ssc=6&pln=1&pc=1#code/IYZwngdgxgBAZgV2gFwJYHsIwOYFNkCCAcggLYBGuATgBQCUMA3gFAwxX4JVYAsA3MwC+zEaEixEKDFjzIAKrgAeyAPJUAQghDJ6TVjCiZt7XCAAOMALwxgAd2Cpk8fFAAWNAESvkyMyABcAPSB2Ojo2AA2uAB0hqQedAJsqHA0HObR6ADWDCxsbIYQxuToACZgbNZ2Dk7pZtHISjqJ+mwcyFxYJeVJMIIwuBEguHr5MMiuVOi2MACiVFO0HgDCwBAQ6E5wLq44YdgJvcLCIjRi0DC6lgB8ozBRTllWNvaOOPgKymqa2jQ8LQUjOgotEIuEaDkBII6PQ+EA) gave me output code like this 

```js
"use strict";
var __awaiter = (this && this.__awaiter) || function(thisArg, _arguments, P, generator) {
    function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
            resolve(value);
        });
    }
    return new(P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
            try {
                step(generator.next(value));
            } catch (e) {
                reject(e);
            }
        }

        function rejected(value) {
            try {
                step(generator["throw"](value));
            } catch (e) {
                reject(e);
            }
        }

        function step(result) {
            result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};

function getANumber() {
    return __awaiter(this, void 0, void 0, function*() {
        return 4;
    });
}

function getTextOrBust() {
    return __awaiter(this, void 0, void 0, function*() {
        const resp = yield fetch("https://google.com");
        if (resp.ok) {
            const body = yield resp.text();
            return body;
        } else {
            throw Error("Cannot fetch goog");
        }
    });
}(() => __awaiter(void 0, void 0, void 0, function*() {
    let k = yield getTextOrBust();
    console.log(k);
}))();
```

I re-wrote this snippet a little bit to make it easier to understand 

```js
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { 
        return value instanceof P ? value : new P(function (resolve) { resolve(value); }); 
    }
    return new (P || (P = Promise))(function (resolve, reject) {
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
(() => __awaiter(void 0, void 0, void 0, function* () {
    let k = yield getTextOrBust(4);
    console.log(k);
}))();
```


#### async function x  becomes __awaiter(thisArg, ..., function*())

The first thing is to notice how our 

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

became 

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

we removed the `async` keyword and wrapped the body of our function in an `return __awaiter(this, void 0, void 0, function* ()` and replaced `await` with `yield`

What is `yield` ? and what is this `function*`, `void 0`, ?

In JS, `void expr` evaluates `expr` and returns `undefined` as the value of the expression, so `let x = void 10`, evaluates `10` and returns `undefined` as the value of `x`


What is `function*` and `yield` ? For that we must detour into a relatively obscure feature of Javascript : **Generators** 

Lets take a look about Generators in [Part II](https://gowind.github.io/async_await_transforms_part2.html) 

