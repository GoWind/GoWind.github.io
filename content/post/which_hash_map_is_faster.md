---
title: Array vs Normal HashMaps in Zig
date: 2024-03-19
---

So you want to use a HashMap in Zig. Its simple as `new std.HashMap<K,V>()` right ? 

Nope ! 

Turns out, since Zig gives you control over memory, it also expects you to manage memory. Which
makes HashMaps a bit tricky. Who owns the values (the Map does, duh !) , but more importantly, who owns 
the keys ? And what about String keys ? 

There is [an excellent blog post](https://devlog.hexops.com/2022/zig-hashmaps-explained/) from hexops about the different types of hashmaps in Zig and the tradeoffs between each type. 

**TL;DR**: You probably want to use maps starting with `Auto`, for they also manage the memory of the keys.


There are 2 types of Hashmap implementation in Zig std. library
Quoted from the blog mentioned above
```
1. Normal HashMap 
  a. Optimized for lookup times primarily
  b. Optimized for insertion/removal times secondarily

2. ArrayHashMap  
  a. Iterating over the hashmap is an order of magnitude faster (a contiguous array)
  b. Insertion order is preserved.
  c. You can index into the underlying data like an array if you like
```

Why would I need to use an ArrayHashMap ? 

I have a piece of code that iteraters through the entries in a map to find a pair with the highest frequency
```zig
/// Return the pair with the highest frequency
pub fn maxFrequency(p: PairCounts) Pair {
    var count: usize = std.math.minInt(usize);
    var pairPtr: *Pair = undefined;
    var iterator = p.iterator();
    while (iterator.next()) |entry| {
        if (entry.value_ptr.* > count) {
            count = entry.value_ptr.*;
            pairPtr = entry.key_ptr;
        }
    }
    return Pair{ .p0 = pairPtr.p0, .p1 = pairPtr.p1 };
}
```
This frequency counting is done atleast 256 times (usually way more), so I want this to be as fast as possible. 
Given that the claim is ArrayHashMaps are upto an order of magnitute faster than a normal hash map when it comes to iterating through them, do we really see such a difference ? Lets test it out !

I wrote a small program to insert a million entries into a map, iterate through them and sum the values
```zig
const std = @import("std");

const ArrayHashMap = std.AutoArrayHashMap(u32, u32); // replace with AutoHashMap(u32, u32) for the non-array version
pub fn main() !void {
    var rndGen = std.rand.DefaultPrng.init(@as(u64, 0));
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    var arrayMap = ArrayHashMap.init(allocator);
    var i: usize = 0;
    while (i < 1000000) { // insert a million entries
        try arrayMap.put(@as(u32, @truncate(i)), @as(u32, @truncate(rndGen.next())));
        i += 1;
    }
    var iter = arrayMap.iterator();
    var sum: u128 = 0;
    const start = std.time.nanoTimestamp();
    while (iter.next()) |entry| {
        sum += entry.value_ptr.*;
    }
    const end = std.time.nanoTimestamp();
    std.debug.print("ArrayHashmap Sum: {} took {} ns\n", .{ sum, end - start });
}
``` 
I ran the program 10 times each for Array and Normal Hash Maps on an M2Pro Macbook 16" 
```
zig build-exe -Doptimize=ReleaseFast program.zig
// ReleaseFast optimizes for producing a fast running binary 
``` 
The results:

```
Normal hashMap: 29610100 ns // 29.6 ms (average of 10 runs)
Array  hashMap: 10426500 ns // 10.4 ms (average of 10 runs)
```

**CONCLUSION**: The ArrayHashMap implementation is roughly 66% faster than the normal map implementation (or put in another way, the array map iteration takes 1/3rd the time it takes to iterate through the normal map). Not quite the order of magnitude I expected (maybe as the size of the map increases this might be true), but nevertheless it is significantly faster the normal hashmap for you to consider it when you need to iterate through all the keys in a HashMap
