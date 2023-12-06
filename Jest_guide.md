## Jest Guide

some notes I took when trying to understand the `jest` library for unit testing in js/ts


`Expectation` objects - `expect(X)`
`Matchers` - `.toBe(Y)`, `.toEqual(Z)` etc

ExpectationObject.Matchers - pattern for testing.

`test("Test description", func() {}` - how to write tests 

```
test("Testing async functions", async () => {
   y = await some_async_func();
   expect(y).toBe(z);
}
```

Look up the Jest documentation on the list of available `matchers`


### Setup and Teardown. 

```
beforeEach(() => {
   initializer_fn(); // setup before each test
});

afterEach(() => {
	teardown_fn(); // teardown after each test
});
```

```
beforeAll( () => {
	// one time setup before running tests in this file
});

afterAll( () => {
	// one time teardown after running tests in the file
});
```

```

describe("a block to scope tests", () => {
	beforeEach(() => {
		// runs only before tests in this scope
	});
	test('description', () => {})
})`
```


`describe`s can be nested. 


### Order of Execution.

1. Tests inside `describes` are collected first, before they are run. 

2. The tests inside `describe`s are run in the order they were collected (top-down). 
3. Top level test (outside of any describe-scope) are run in the order they are seen (tests inside `describes` *before* the top-level tests are run *after* the top-level test) 

```
 //action.test.ts 

beforeEach(() => console.log('connection setup'));
beforeEach(() => console.log('database setup'));

  

afterEach(() => console.log('database teardown'));
afterEach(() => console.log('connection teardown'));

  

describe("first scoped block", () => {
	test('test inside first describe', () => {
		console.log('hai i am test inside first describe');
		expect(1).toBe(1);
	});

});

test('test 1', () => {
	console.log("hi, i am top level test");
	expect(2).toBe(2);
});

  

describe('extra', () => {

beforeEach(() => console.log('extra database setup'));

afterEach(() => console.log('extra database teardown'));

  

test('test 2', () => console.log('test 2'));

});
```


 ```
 PASS  action.test.ts
  ✓ test 1 (3 ms)
  first scoped block
    ✓ test inside first describe (5 ms)
  extra
    ✓ test 2 (6 ms)
```

You can see that top-level test is run *before* tests in the scope `first scoped block`, even though the scope comes before the top-level test in the file.


## Mocking

`jest.fn()`  -> Mock Function, that creates an object that can be called as a constructor, or as an object with attached methods

```

let k = jest.fn({create: jest.fn()});
k.create(44);
k.create(66);
```

`.mock` property of a `jest.fn`  is where data about how the function has been called and what the function returned is kept. The `.mock` property also tracks the value of `this` for each call, so it is possible to inspect this as well.

```
const myMock1 = jest.fn();
const a = new myMock1();
console.log(myMock1.mock.instances);
// > [ <a> ]const myMock2 = jest.fn();
const b = {};
const bound = myMock2.bind(b);
bound();
console.log(myMock2.mock.contexts);
// > [ <b> ]
```

### Mocking a return value for a fn 

```
const myMock = jest.fn();
myMock.mockReturnValue(66);
console.log(myMock(400, 88, "hai"));
// > 66
console.log(myMock());
// > 66
```

### Mocking Modules

1. Import module (for references to the classes, objects or functions within the module)
2. use `jest.mock('module-name')` , to mock all the classes, objects or functions within the module. 

```

import axios from 'axios';
import Users from './users';
jest.mock('axios');
test('should fetch users', () => {  
	const users = [{name: 'Bob'}];  
	const resp = {data: users};  axios.get.mockResolvedValue(resp);  
	return Users.all().then(data => expect(data).toEqual(users));});
```


#### Mocking a Module partially

1. import the exports of a module that you need. 
2. Use `jest.mock('module-to-be-partially-mocked', () => {}`
3. In the `() => {..` return a module, with the exports needed to be mocked, replaced with the mocked values



```
//foo-bar-baz.js 
// we want to mock `foo` in one of our tests 

export const foo = 'foo';
export const bar = () => 'bar';
export default () => 'baz';
```

```
//test.js

import defaultExport, {bar, foo} from '../foo-bar-baz';
jest.mock('../foo-bar-baz', () => {  
	const originalModule = jest.requireActual('../foo-bar-baz');  
	//Mock the default export and the named export 'foo'  
	return {    __esModule: true,    
				...originalModule,    
				default: jest.fn(() => 'mocked baz'),   
				foo: 'mocked foo',  }
				;});
test('should do a partial mock', () => {  
		const defaultExportResult = defaultExport();
		expect(defaultExportResult).toBe('mocked baz');    
		expect(defaultExport).toHaveBeenCalled();  
		expect(foo).toBe('mocked foo'); 
		expect(bar()).toBe('bar');});
```


You can also use it in a diff. way

```
jest.mock('node-fetch');
import fetch from 'node-fetch';
// we obtain the original implementation for the Response class
const {Response} = jest.requireActual('node-fetch');

test('somewhere where we have to mock a fetch request', async () => {  
	fetch.mockReturnValue(Promise.resolve(new Response('4')));
	let resp = await fetch("/some-resource");
	expect(resp.text()).toBe('4');

```

### Open Handles

When Jest finishes running tests, it can checks to see if there are any events preventing the event loop from exiting.
This is useful for example, to find connection objects that aren't closed or (maybe unresolved Promises as well?) that might keep the loop alive. You can detect this by using `jest --detectOpenHandles`. It has helped me figure out connections objects that I opened and never closed