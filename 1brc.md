---
title: From 500 secs to 3.5 - The 1brc Challenge
---


All measurements run on an M2Pro Macbook 16" with 32GB RAM. 

For those of you that aren't aware of the [1brc]() challenge, the goal is to parse 1 billion rows in a plain text file, each row mapping a city to the temperature observed on a particular day and computing the min,max,average and total temperatures of each city.
The output has to be alphabetically sorted based on the name of the city.

The title is a little clickbait-y, because I knew that my initial solution was going to be slow, but yet I still ran it for the sake of it.

## If it works, it ain't stupid

My first solution was to write a dumb shell script. Too lazy, I asked chatGPT to generate an `awk` script for me to do it and then I ran it on my local machine. 

```bash
$ cat average.sh
#!/bin/bash

# Input file path
input_file="measurements.txt"

# Check if the file exists
if [ ! -f "$input_file" ]; then
    echo "Error: File not found: $input_file"
    exit 1
fi

# Use awk to calculate average temperature per city
awk -F';' '{
    city = $1
    temperature = $2
    sum[city] += temperature
    count[city]++
}
END {
    for (city in sum) {
        average = sum[city] / count[city]
        printf "City: %s, Average Temperature: %.2f\n", city, average
    }
}' "$input_file"
```

The result ? 487 secs for a single run.

That shell scripts are slow is a known thing. What next ? I didn't want to spend too much time on it, so I wrote a similar script in Javascript with a single thread (I lost the code for it, but it isn't too hard to write). The script didn't do much faster, running at about 460ish seconds (even V8 can only do so much I guess).

## Going brrr

How do I make this faster ? This problem is trivially parallelizable. Since each line is a separate entry, we can split the giant file to be worked on by different `worker` threads and then merge the results of all the `worker` threads together in the main thread. The tricky bit is how do we split the file ? 

We can use the [stat](https://linux.die.net/man/2/stat) api to find the size of a file without having to read the entire file.
Once we know the size of the file, we can split it into chunks , where chunk size = `sizeof(file)/num_threads`. Each thread will read the lines present between bytes : [ `thread_index * chunk_size` ... `(thread_index + 1) * chunk_size`] and in a thread local HashMap, map each city => number of times we saw an entry for the city , the min , max temperatures and the total sum of all the temperatures we have seen. 
Once the threads sum up their chunk of the file, we then merge the results of these local HashMap into a global HashMap to calculate each city's min, max and avg. temperatures.

The file is made of lines like `Vienna;19.1\nPhoenix;16.1\n`. The `\n` at the end and the `V` at the beginning might not align exactly for all the chunks of our threads. What do we do in that case ?

Before a thread begins to process a chunk, we need to adjust its start and end offsets such that the start offset starts at a character right after a `\n` (thus a new entry) and adjust the end character so that it aligns with a `\n` .

Here is how I did it in my code
```js

if(startOffset > 0) {
 let buf = await readHundred(handle, startOffset-1);
 if(buf[0] == '\n') {
 } else {
    let nextPos = nextNewLine(buf, "start");
    startOffset = nextPos + startOffset;
 }
}
async function readHundred(handle, pos) {
  let b = Buffer.alloc(100);
  let results = await handle.read(b, 0, 100, pos);
  return results.buffer.slice(0, results.bytesRead-1).toString();
}
```

I took the liberty that each line is less than a 100 chars long, so that we can always find the `\n` by just reading 100 chars past the start offset.

Similarly for the end offset 
```js
if(endOffset < totalSize) {
  let buf = await readHundred(handle, endOffset);
  if(buf[0] == "\n" || buf[0] == "\x00") {
  } else {
    let nn = nextNewLine(buf, "end");
    endOffset = nn + endOffset;
  }
}

function nextNewLine(buffer, ev) {
  let x = 0;
  let j = buffer.toString();
  while(x < j.length) {
    if(j[x] == '\n') {
      return x;
    }
    x += 1;
  }
  return x;
}
```

Once the thread finds the start and the end offsets for each chunk,it creates a stream between the 2 offsets and iterates through them line by line :

```js
const readStream = await handle.createReadStream({start: startOffset, end: endOffset});
const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity // To handle Windows line endings
  });

rl.on('line', (row) => {
  processRow(row);
});

rl.on('close', () => {
 wrapUp();
});
```

You can find this version of code in [this](https://github.com/GoWind/1brc/commit/7a64018720365608c5ba8fcb080c63f61cb54f2e) commit. Running this code with 12 threads (8 E cores and 4 P cores on my M2 Pro machine), I got it run at about 48 secs on avg. 

Readline is a rather slow way to iterate over a chunk of data because it reads a chunk of text line by line. When looping over a ReadStream, we can loop over Text Chunks rather than lines and this might be faster (you can find this version of my solution in [this](https://github.com/GoWind/1brc/commit/3d3be7fd1c51d9304b3cce34bde4d29818db565b)commit)

```diff
-const rl = readline.createInterface({
-    input: readStream,
-    crlfDelay: Infinity // To handle Windows line endings
-  });

-rl.on('line', (row) => {
-  processRow(row);
-});
+for await (const chunk of readStream) {
+    let res = await handler(chunk);
+    if(res == false) {
+      break;
+    }
+}

-rl.on('close', () => {
- wrapUp();
-});
+async function handler(chunk) {
+  let updatedChunk = globalBuffer.concat(chunk);
+  let rows = updatedChunk.split("\n");
+  if(rows.length) {
+     if(rows[rows.length-1] == "") {
+        globalBuffer = "";
+        processRows(rows.slice(0, -1));
+     } else {
+       globalBuffer = rows[rows.length-1];
+       processRows(rows.slice(0, -1));
+     }
+  }
+}
+wrapUp();
```

Using chunking as opposed to ReadLine improved the solution by roughly 20%. I was able to get the solution to run on an avg. of 40secs. 


### Faster ? 

I was running out of ideas to improve the speed in JS, so time to bring out the BFG 9000: Zig. 
As a statically-typed, compiled language, we should be able to (hopefully) run much faster in Zig.
I used the same approach to build a multi-threaded Zig program, using the same offset calculation with threads swapping the JS for Zig. 

#### Timing ? 
6.7 secs ! 

I initially got a shock, because I was doing a Debug build and the Debug build ran with an average of 56secs. For a few moments, I was questioning my life decisions and existence in a world where JS was faster than Zig. Running `zig build` with the `Doptimize=ReleaseFast` flag turned on optimizations that literally 8xed the speed of my [solution](https://github.com/GoWind/1brc/commit/7760c6dda6930ff4464cc2cc049bf35988960441)


I was happy, but by this point, the Java peeps had made the Java solution complete in under 6 secs. Can I beat that ? 

### Moaaar power 

I wanted to do a couple of tweaks before calling it quits. These tweaks were stuff I found in Danny Van Kooten's [solution](https://github.com/dannyvankooten/1brc/blob/main/analyze.c) in C.

1. Use `mmap` to map the file into the virtual memory, instead of trying to read chunks of the file in each thread to find the start and the end offsets
2. A faster hashMap implementation 
3. not trying to parse the temperatures as floats 

[mmap](https://man7.org/linux/man-pages/man2/mmap.2.html) takes the contents of a file and maps it into the virtual memory of a process. This makes reading the file as simple as updating a pointer , while the Filesystem + OS takes care of swapping in and out the parts of the files currently being read. We are not updating the mapping/file, only reading it , so `mmap`ing the file turned out to be a simple choice

```diff
-    const file = try std.fs.openFileAbsoluteZ(filepath, .{});
-    defer file.close();
-    const stat = try file.stat();
-    std.debug.print("file size is {}\n", .{stat.size});
+    const fd = try std.os.open(filepath, std.os.O.RDONLY, 0);
+    defer std.os.close(fd);
+    const stat = try std.os.fstat(fd);
+    const mapping = try std.os.mmap(null, @as(u64, @intCast(stat.size)), std.os.PROT.READ, std.os.MAP.PRIVATE, fd, 0);
+    defer std.os.munmap(mapping);

```

```diff
@@ -43,146 +44,60 @@ fn calculate(
     idx: usize,
     workerSize: u64,
     allocator: std.mem.Allocator,
-    filepath: [*:0]u8,
+    file: []u8,
 ) !void {
-    var buffer = [_]u8{'a'} ** 80000;
-    const waterMarkSize: usize = 80000;
-    const slice = buffer[0..100];
-    const View = struct { slice: []u8, len: usize };
-    const file = try std.fs.openFileAbsoluteZ(filepath, .{});
-    const stat = try file.stat();
-    defer file.close();
+    const finalEndOffset = file.len - 1;
     var startOffset = idx * workerSize;
     var endOffset = (idx + 1) * workerSize - 1;
     if (startOffset > 0) {
         const prev = startOffset - 1;
-        try file.seekTo(prev);
-        const read = try file.readAll(slice);
-        if (read == 0) {
-            @panic("failed to read from starting offset");
-        }
-        if (buffer[0] != '\n') {
-            var i: usize = 1;
-            while (i < read) : (i += 1) {
-                if (buffer[i] == '\n') {
-                    startOffset += i;
-                    break;
-                }
+        if (file[prev] != '\n') {
+            while (file[startOffset] != '\n') {
+                startOffset += 1;
             }
-        }

```

I didn't record the timings for [this] change alone, but my measurements varied anywhere from ~5.5-9secs (probably depending on filesystem caches in memory being cold/warm)

The next trick I attempted to use was to parse each temperature as an `i32` and not as a `f32`. Float parsing is tricky, and slower than parsing integers. Since each temperature entry in the challenge has only one digit after the decimal point, we can parse `16.1` as `161` and divide the final result only by `10`, thus saving a lot of time spent parsing 
```diff
-pub const Record = struct { min: f32 = 0, max: f32 = 0, total: f32 = 0, count: u32 = 0 };
+const SliceList = std.ArrayList([]const u8);
+const writer = std.io.getStdOut().writer();
+pub const Record = struct { min: i32 = 0, max: i32 = 0, total: i32 = 0, count: u32 = 0 };
...
-            const temp = try std.fmt.parseFloat(f32, num);
+            const temp = parsei32(num);
```

(Again, I did not record the timings for this change [this](https://github.com/GoWind/1brc/commit/23fafbfebbb82bafcd9433e1230f89a6c6cdf52a) change alone)

The last trick I wanted to try was using a custom Hash function / HashMap for tracking city -> temperature stats. From profiling my application with flamegraphs, it was clear that most of the time was spent in looking up a city's existing entry in the threadlocal HashMap. Since our keys are strings, we can use a simple hash function to hash the city names. A simple function that is easy to compute is [djb2](https://t.co/C2ZfSSiYSW). I decided to use this as my hash fn 

```ts
fn hashSlice(data: []u8, totalSize: usize) usize {
    var k: usize = 0;
    var hash: usize = 0;
    while (k < data.len) : (k += 1) {
        hash = (hash * 31 + data[k]) & (totalSize - 1);
    }
    return hash;
}
```

As for a HashMap, is there a faster way ? We know that there aren't a lot of cities in the entry, so we probably can get away with replacing the thread local HashMap with an array instead (actually 2 arrays)
1. We create a threadlocal array with 2^16 entries and fill each of them with a `0`.
2. We create another array: `entries`, with index `i` starting at 0. Each new string is provided a new index in this array. The values of entries are all set to a sentinel value.
3. We hash each string and then perform a module of that hash with (2^16-1) thus getting a number N between [0, 2^16-1]. 
4. We then start at array[N] and proceed with N = (N+ 1) % 2^16-1 , till array[N] == Sentinel Value or array[N] == N.
5. if entries[N] is a Sentinel Value, it means we have not encountered string S yet. We create a Record for this city at `entries[N]` and set Array[N] = N
6. Else, it means we already have a valid entry for the city S. We then simply update the count and the min,max and average of the City at entries[N]

It is probably much simpler to understand the code:

```diff
+    var hashList = try NumList.initCapacity(allocator, maxSize);
+    var indexList = try NumList.initCapacity(allocator, maxSize);
+    hashList.appendNTimesAssumeCapacity(0, maxSize);
+    indexList.appendNTimesAssumeCapacity(1 << 16, maxSize);
// 1 << 16 is the sentinel value

-
-            const maybeEntry = threadMap[idx].getEntry(city);
-            if (maybeEntry) |entry| {
-                entry.value_ptr.*.count += 1;
-                entry.value_ptr.*.total += temp;
-                entry.value_ptr.*.max = @max(entry.value_ptr.*.max, temp);
-                entry.value_ptr.*.min = @min(entry.value_ptr.*.min, temp);
+            var hashVal = hashSlice(city, maxSize);
+            while (hashList.items[hashVal] != hashVal and hashList.items[hashVal] != 0) {
+                hashVal = (hashVal + 1) & (maxSize - 1);
+            }
+            const entryIdx = indexList.items[hashVal];
+            if (entryIdx == 1 << 16) {
+                const cityNameForRec = try allocator.alloc(u8, city.len);
+                @memcpy(cityNameForRec, city);
+                const rec = Record{ .city = cityNameForRec, .count = 1, .min = temp, .max = tem
p, .total = temp };
+                try threadMap[idx].append(rec);
+                indexList.items[hashVal] = threadMap[idx].items.len - 1;
+                hashList.items[hashVal] = hashVal;
             } else {
-                const rec = Record{ .count = 1, .min = temp, .max = temp, .total = temp };
-                const k = try allocator.alloc(u8, city.len);
-                @memcpy(k, city);
-                try threadMap[idx].put(k, rec);
+                threadMap[idx].items[entryIdx].count += 1;
+                threadMap[idx].items[entryIdx].total += temp;
+                threadMap[idx].items[entryIdx].max = @max(threadMap[idx].items[entryIdx].max, t
emp);
+                threadMap[idx].items[entryIdx].min = @min(threadMap[idx].items[entryIdx].min, t
emp);
             }
```

We replaced the zig HashMap with our custom one. So how did the end result go ? 

#### Answer: Faaast ! 
The [updated](https://github.com/GoWind/1brc/commit/dfc37a92b5fcb835dc994e48ef54eab060fd03bb?diff=unified&w=1 )solution hit ~3.5 secs on the average. This was almost 2x faster than our previous solution ! I was elated that such simple optimizations could make such a big difference. 


I wanted to proceed with more optimizations to make the solution go even faster, but unfortunately I no longer had the time to pursue the project , and having hit the deadline I set for myself, was happy to have come so far. Also given that my daily driver is a Mac, it was very hard to generate flamegraphs for Zig programs and trying to optimize programs without them is like trying to navigate a race course blind. In the end, I decided to wrap up the experiments and call it a day

## Takeaways

Zig is faaaast ! More than that, it makes doing things that could be done by C (mmap, allocations) etc so much simpler. The only language wart that I still hate is that I never know when it copies a data structure vs when it doesn't , so I ended up spending a lot of time debugging subtle bugs.

For example, take this update in a fn that runs in a worker thread
```ts

const TempMap = std.StringHashMap(Record);
var threadMap: [numWorkers]RecordList = undefined;
var threads: [numWorkers]std.Thread = undefined;
const NumList = std.ArrayList(usize);
const maxSize: usize = 1 << 14;
pub fn main() !void {
}

fn calculate(...) {
                threadMap[idx].items[entryIdx].count += 1;
                threadMap[idx].items[entryIdx].total += temp;
                threadMap[idx].items[entryIdx].max = @max(threadMap[idx].items[entryIdx].max, temp);
                threadMap[idx].items[entryIdx].min = @min(threadMap[idx].items[entryIdx].min, temp);

}
```

In fn `calculate`, I had done 
```ts
		var t = threadMap[idx];
        t.items[entryIdx].count += 1;
        t.items[entryIdx].total += temp;
```

What happened was, this created a new copy of `threadMap[idx]` for each thread  in the fn calculate and the updates were going into this copy `t` , rather than at `threadMap[idx]`. As a result, after my threads finished running, when attempting to merge all the entries from each thread's threadMap, I was running into empty maps, because none of the entries added to `t` were actually added to `threadMap[idx]`. The fix was simple, but the lack of docs or syntax about move semantics or copy constructors makes it sometimes a frustrating experience.

In the end though, the ability of Zig to provide the speed of C with a far better syntax and APIs make these frustrations vanish. Happy Hacking ! 

