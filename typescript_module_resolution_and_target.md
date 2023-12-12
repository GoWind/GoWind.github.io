# Module, ModuleResolution and Target in NodeJS

I did (**A LOT**) of reading and testing out various config options in my local machine to understand how `module`,`moduleResolution` and `target` configurations in `tsconfig.json` work. 

First let us setup some terminology and explanations to understand the terms involved: 

[A host](https://www.typescriptlang.org/docs/handbook/modules/theory.html#who-is-the-host)

Simplest point to understand: Typescript is **NOT** a host

A host is the runtime where JS executes (NodeJS, browser) or a bundler that transforms the output of typescript 


[Module output format](https://www.typescriptlang.org/docs/handbook/modules/theory.html#the-module-output-format): 

In any project, the first question about modules we need to answer is what kinds of modules the host expects, so TypeScript can set its output format for each file to match.

The `module` compiler option provides this information to the compiler. Its primary purpose is to control the module format of any JavaScript that gets emitted during compilation

[Module Resolution](https://www.typescriptlang.org/docs/handbook/modules/theory.html#module-resolution) 

ECMAScript specification defines how to parse and interpret `import` and `export` statements.

But it doesn't specify the actual algorithm of how an import specifier ("./path/to/module" or "node-fetch", "semver") is resolved into a module

This also clarifies why TypeScript doesn’t modify import specifiers during emit: the relationship between an import specifier and a file on disk (if one even exists) is host-defined, and TypeScript is not a host.

[Module Specifier](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#module-name)

The module to import from (example: "node-fetch" or something relative like "./../shared" or "./../shared/logger.js")


I tested a project with both local and non-local import specifiers. The most important config option was the `type` option `package.json`, which changes how NodeJS interprets the module type (ESM vs Common JS ) of `.js` files. I have written a summary of how my `tsc` step works with the given config values for `module`, `moduleResolution` and `target`

Node Version used : `20.6.1` (on macOS)

#### No `type`: `module` in `package.json`

`.cjs` files are considered CommonJS modules.
`.mjs` files are considered ESM modules.
`.js` files are considered CommonJS modules.



| target | module | moduleResolution | result of `tsc` | output format |
|-------| --------| -------------------|------| ---------------|
| es2022| None| None | Error: cant resolve modules |  |
|es2022| nodenext | nodenext | works[1] | commonjs modules
|es2022| commonjs | None | works[2] | common js modules |
|es2022 | es2022 | Nonde | doesn't work (can't resolve modules in node_modules)|
|es2022 | es2022 | node16| doesn't work (moduleResultion must match module)|




[2] works only if `esModuleInterop` is also set to `True`, otherwise runs into problems 

both [1] and [2]  can use `await` syntax 
both [1] and [2] have CommonJs module syntax in the emitted code: 
```
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
....
....
....
exports.default = fetchInformation
```


#### With `type`: `module` in package.json 

all relative import specifiers (example: `import { logger } from "./../shared/lib/logger-wrapper.js";`) MUST always  have the suffix (`.js` `.mjs`) present in the import specifier, else Node will refuse to import the module. 


| target | module | moduleResolution | result of `tsc` | output format |
|-------| --------| -------------------|------| ---------------|
| es2022| None| None | Error: can't resolve modules |  |
|es2022| nodenext | nodenext | doesn't work |  |
|es2022| commonjs | None | compiles but fails at runtime[2] | common js modules |
|es2022 | es2022 | None | doesn't work (can't resolve modules in node_modules)|
|es2022 | es2022 | node16| doesn't work (moduleResultion must match module)|

`.cjs` files are considered common js modules.
`.mjs` files are considered esm modules
`.js` files are considered esm modules.

[2] tsc compiles successfully but code fails at runtime when running use `node /path/file.js`
with the following error message: 
```
ReferenceError: exports is not defined in ES module scope
This file is being treated as an ES module because it has a '.js' file extension and '/path/to/package.json' contains "type": "module". To treat it as a CommonJS script, rename it to use the '.cjs' file extension.
```

To use Typescript code with `type: module`, you can specify the import specifier for a relative module, say, `./../shared/lib/logger-wrapper.ts`  as `./../shared/lib/logger-wrapper.js`. `tsc` seems to pick it up compile successfully 

Also, In Typescript, module specifiers such as the `./myfile.js` in `import {a} from "./myfile.js"` are [never](https://www.typescriptlang.org/docs/handbook/modules/theory.html#module-specifiers-are-not-transformed) transformed ! This means that your transpiled code with the `.js` suffix in the import specifier should work on a NodeJS runtime correctly.

The Reason why this is so, is simple: The resolution of module specifier is `host` specific (host: browser, Node runtimer, bundler etc). Since TS is not a host, it leaves the import statement untouched (IMO, so much pain could have been avoided if TS could do this)

