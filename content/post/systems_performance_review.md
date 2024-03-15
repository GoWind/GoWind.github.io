---
title: "Book: Systems Performance, a rather incomplete review"
date: 25 Feb 2024
---

Brendan Gregg's [System Performance](https://www.brendangregg.com/blog/2020-07-15/systems-performance-2nd-edition.html) is a book that I have been meaning to read for a long time, but didn't get around to. 
Thanks to my workplace's education policy, I get to buy and reimburse technical books, so I grabbed myself a copy

Its a Hyuuuuge book (some 793 pages excluding the Introduction and the Appendix) and I don't think I will ever write a review if I wait until I completed the entire book.

That said, even read a couple of chapters gave me enough intuition on what to pursue further and my two biggest takeaways
have been: 
1. USE and RED Methodologies
2. BPF (or eBPF) based tools 

## USE and RED methodologies 

USE stands for Utilization, Saturation and Errors. 
It is a methodology for investigating systematic bottlenecks in System Resources

**RESOURCE** - components like CPU, RAM, Network bandwidth etc. 
**UTILIZATION** - what % of a resource is used, over time (5-minute avg utilization of a CPU) and space (number of CPUs utilized by a program in a multi-threaded/multi-CPU system)

When utilization reaches 100% and more requests to utilize a resource (such as new processes or incoming packets) come in, they are queued for processing. This is a measure of extra **pressure** on the system and is termed **SATURATION**

**ERRORS** - The number of error events (seg faults, page faults) etc. 

USE is a methodology for measuring how well system resources are used.

As a user of a system (or service ) you don't know (or care) about system resources, rather about how well your requests to use the system are doing. Example, if you are using AWS s3 to store data/files, then you don't care about how efficient s3 is in using system resources, rather you want to know how quickly your request to store and fetch data

In such cases, the **RED methodology***  is a better way to track systematic bottlenecks
RED stands for Requests Rate, Errors and Duration. 

**Request Rate** - The rate at which user requests arrive
**Errors** - The number (or % ) of requests that result in a (non-user induced) error
**Duration** - The duration it takes for requests to be served (measured by 50th, 90th, 99th percentiles etc)


## BPF (eBPF) based tools 

BPF is a way for users on Linux to load programs that run within the kernel, without having to modify the kernel source codeOR load kernel modules. 
While it start off with packet filter (as the name stands for Berkely Packet Filter), it soon extended to other usecases as well.
using BPF, users can attach programs to various hooks in the kernel (for example, you can run a program to track every time a read() system call was executed, or a write()). BPF programs are written in a dialect of C.
Using BPF directly can be cumbersome, so Brendan Gregg's [BCC](https://github.com/iovisor/bcc) project provides some useful tools and utilities to make it easier to write, load and register BPF programs.
There is also a high-level scripting like language, [BPFtrace](https://github.com/bpftrace/bpftrace) that can be programmed like a bash/awk script to do pretty much most of what you need as a user to track application performance without having to write programs in BPF's C dialect
