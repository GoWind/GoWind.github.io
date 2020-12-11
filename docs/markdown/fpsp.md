at the start of the function call, `fp` and `sp` are the same
at the end of the call `fp` and `sp` are the same
`fp` has  to be restored once the callee returns

To preserve `fp` , on ARM, each function first push fp onto the stack
and before return, restores it (by popping it from the stack).
```
Begin fn:
          push fp
          push local_var1
          push local_var2
          op
          ..
          ..
          pop local_var1
          pop local_var2
          pop fp
          return 
```

Before calling a function, the caller makes sure that the fp and sp are pointing to the same location,
to create a linked list of frame pointers, that way at the start of any function,
the stack pointer points to the frame pointer of the previous function.

```
Begin fn:
    push fp
    push local_var1
    push local_var2
    mov fp, sp # fp = sp
    jmp loc # fn call
    pop fp
    return 
```

Understanding the address pointed by the stack is interesting as well
`sp` (stack pointer) points to an address X (in the memory)
This is also called the `top of the stack`.
Push:
```
1. Item is stored at location X M[X]. This of the memory as a big linear, 
   array
2. sp is incremented. sp now points to X+1
```
so a push op is basically (2 ops: store + increment pointer).

Pop:
Similarly pop removes items from the top of the stack
top of the stack is always empty
Assuming top of stack is pointint to address X

```
1. sp is decremented. sp is now X-1
2. pop returns the value of M[X-1] in a register
```
Subsequent push will now push the value in address X-1. 

# Program Counter / PC
PC points to the `next` instruction to be executed.
But be a little careful when thinking about it.
When an instruction is being executed, `PC` points to the next
instruction about to be executed.

```
00 ldr r0, =hello ;pc=01
;pc = 01, processor loads instruction at 01 and increments pc
;pc = 02, process then proceeds to execute instruction loaded
01 ldr r1, #42; pc=02
02
03
04
```
