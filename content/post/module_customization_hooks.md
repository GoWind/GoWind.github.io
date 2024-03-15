---
title:  Module customization hooks in Node 20 
---

Node 20 changed/added behaviour to handle `import` statements in `.js` files. 
We will go through some code to see how it works. 

### No `type: module` in `package.json`

1. `import` statements in `.js` files won't work.
```

$ cat my-app.js
import { hello } from './my-app-x';
import crypto from "node:crypto";
console.log(hello());
console.log(crypto.randomBytes(32).toString('hex'));
```

```
~/personal/node_hooks ⌚ 22:28:57
$ cat my-app-x.js
export function hello() {
  return 4;
}
```

```
~/personal/node_hooks ⌚ 22:29:04
$ node my-app.js
(node:58013) Warning: To load an ES module, set "type": "module" in the package.json or use the .mjs extension.
(Use `node --trace-warnings ...` to show where the warning was created)
/Users/govind/personal/node_hooks/my-app.js:1
import { hello } from './my-app-x';
^^^^^^
```

#### Solution: change `.js` files to `.mjs` files (and rename import `specifiers` ) to work with modules

```
$ cat my-app.mjs
import { hello } from './my-app-x.mjs';
import crypto from "node:crypto";
console.log(hello());
console.log(crypto.randomBytes(32).toString('hex'));

~/personal/node_hooks ⌚ 22:37:34
$ cat my-app-x.mjs
export function hello() {
  return 4;
}

~/personal/node_hooks ⌚ 22:37:38
$ node my-app.mjs
4
0ad44de8f3ffa9e769f593b9228c13e7b765c78aa50b3e3909c991bb96aaee1f
```
### Adding `type: module` in package.json 

Will allow you to use `import` statements within `.js` files

```
node my-app.js
node:internal/process/esm_loader:48
      internalBinding('errors').triggerUncaughtException(
                                ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/govind/personal/node_hooks/my-app-x' imported from /Users/govind/personal/node_hooks/my-app.js
Did you mean to import ../my-app-x.js?
```

**However, You cannot import from js modules (that are single files) without a `.js` suffix**

```
$ cat my-app.js
import { hello } from './my-app-x.js';
import crypto from "node:crypto";
console.log(hello());
console.log(crypto.randomBytes(32).toString('hex'));

~/personal/node_hooks ⌚ 22:33:30
$ node my-app.js
4
b287ab28bd13f778ffb49df44c7a5eac942e119fee786b6f9a196b21aa497ceb
```

**The solutions work fine for new code , but what about existing JS code where you might already be using js modules without a `.js` suffix in the code ?**

### Module customization hooks

You can use [Module customization hook](https://nodejs.org/docs/latest-v20.x/api/module.html#customization-hooks) to customize module resolution and loading.
The hook is provided in a `.mjs`/`.js` that is run in a separate thread , before your entry file is executed.
The hook is executed as thus: 
```
```bash
node --import ./register-hooks.js ./my-app.js
```
Where `register-hooks` calls the `register` method of `node:module` builtin with the path to a file containing the hooks

```
const { register } = require('node:module');
const { pathToFileURL } = require('node:url');

const { port1, port2 } = new MessageChannel();

const pfUrl = pathToFileURL(__filename);
console.log(pfUrl);
register('./hooks.mjs', {parentURL: pfUrl.href, data: {number: 1, port: port2 }, transferList: [port2]});
```

The `hooks.mjs` exports 3 fns: `initialize`, `resolve` and `load` that will allow you to resolve import specifiers (`./my-app` or `crypto` or `@package/some-name` etc) and then allow you to customize how they are loaded
You will find a sample implementation [here](https://github.com/GoWind/algorithms/tree/master/node_hooks).

I [customized](https://github.com/GoWind/algorithms/tree/master/node_hooks) the hooks to import es modules with a `.mjs` or a `type`: "module" in package.json.

The output is something like this 

```
$ node --import ./register-hooks.cjs ./my-app.js
URL {
  href: 'file:///Users/govind/personal/algorithms/node_hooks/register-hooks.cjs',
  origin: 'null',
  protocol: 'file:',
  username: '',
  password: '',
  host: '',
  hostname: '',
  port: '',
  pathname: '/Users/govind/personal/algorithms/node_hooks/register-hooks.cjs',
  search: '',
  searchParams: URLSearchParams {},
  hash: ''
}
got file:///Users/govind/personal/algorithms/node_hooks/my-app.js to resolve
calling load for file:///Users/govind/personal/algorithms/node_hooks/my-app.js
got ./my-app-x to resolve
got node:crypto to resolve
calling load for file:///Users/govind/personal/algorithms/node_hooks/my-app-x.js
calling load for node:crypto
4
32a902c4ec08d14308ed0ac00b5e2340b31dd298e964e07a4635997939e5041b
```

Happy hacking !
