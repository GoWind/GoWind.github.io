---
title: CLI tools for quick perf. measurement
date: 14-03-2024
---


# Some tools I use

I have been moving away from the venerable `time` utlity to benchmark short running code. 

Here are some of the tools I have using 

### Hyperfine
[Hyperfine](https://github.com/sharkdp/hyperfine) has intuitive CLI options to quickly do multiple runs of a program
along with options to run warmups before executing the program and reports the mean and deviation of the wallclock run times of the program

### flamegraph-rs

[Flamegraphs](https://www.brendangregg.com/flamegraphs.html) are a proven way to profile programs to identify bottlenecks in the code. [flamegraph-rs](https://github.com/flamegraph-rs/flamegraph) makes it very easy to quickly obtain a flamegraph of the program's execution. 


### Termshot

This is not a profiling/benchmarking tool, but [termshot](https://github.com/homeport/termshot) takes a screenshot of your terminal, that you can use for posting to social media / forums etc
