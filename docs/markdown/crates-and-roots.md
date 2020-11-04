# So you want to modularize your Rust code


22 May 2019


### Rant 

The module system in Rust is probably the most confusing module system I have ever encountered in programming languages I have used so far. 
Not that it is bad or has a serious flaw, but the documentation about how it works is very obfuscated and involves reading multiple, confusing, sources (assuming you can get to the right documentation in the first place. Attempting to find the right Rust book references via Google search is like playing Mario on the NES: the princess is always in another castle)

So you have a binary crate with a `main.rs`.
You want to organize your `fn`s , types and struct definitions to another file so that your source code is better organized. 
You try to use `modules` by reading up on the docs and run into all sorts of weird error messages that the compiler is unable to find your module definitions. 

You pull your hair out in frustration (if there is still some left), read the `rustc --explain` messages and still don't find out what went wrong and how to organize your code.

A moment of silence for my fellow warriors new to Rust

### Motivation

The rant is to be taken lightly. 
The Rust module system is well designed, though I wish there were better newbie-friendly introduction to them. 
This article is meant to help newbies better understand how to organize their modules and how the module system works.

### The crate root

The code and the documentation below is written against the Rust 2018 edition. This 
Rust code is organized into `crates`. Crates are of 2 types `binary`, that gets turned into an executable or `library` that is consumed by other applications

**Note**: You can also ship your crate as a binary and a library, but lets get to it

The **ROOT** of the crate, forms the root node of the tree-like module structure of your code. 
You declare your sub-modules in the root and the chain commences thereon. 

#### So what is the crate root? 
For a binary crate, the root is `main.rs` You can declare your modules in `main.rs` and then either
a) implement them in `main.rs` 
b) implement them in a `modulename.rs` or
c) implement them in a `modulename/mod.rs`

Lets illustrate each of the way with an example

Here is the layout of our illustrative application
````
$ cargo new --bin moduleblog
Created binary (application) moduleblog package`
cd moduleblog 
$ tree .
├── Cargo.toml
└── src
    └── main.rs
````
A) Lets implement a module in `main.rs`
````
mod foo {
    pub fn bar(s: String) -> String {
        format!("Hai {} from bar", s)
    }
}

fn main() {
    println!("{}", foo::bar(String::from("baz")));
}
````
You can use the module directly in your `main` fn like you would use any other module. 

**The `mod` keyword has 2 different meanings:** 
A `mod foo;` statement means that you are declaring that a module `foo` exists and which is implemented either in `foo.rs` or `foo/mod.rs` relative to where it is declared. 
 This declaration is akin to a C type `#include "library.h"` where the library is included in your code and the source code for it is usually present in a `library.h` and a `library.c` file. 

The declaration of a module `mod foo;` is usually done in the root of the crate (in this case, `main.rs`)

Let us implement `foo` via b) and c).

````
>cat main.rs
mod foo;
fn main() {
    println!("{}", foo::bar(String::from("baz")));
}
>cat foo.rs
pub fn bar(s: String) -> String {
        format!("Hai {} from bar", s)
}
````
Note that you no longer have to wrap `bar` with a `mod foo{}` as it is implied that this belongs to `foo` module from the filename

Here is `foo` implemented as `foo/mod.rs`
````
> cat foo/mod.rs 
pub fn bar(s: String) -> String {
        format!("Hai {} from bar", s)
}
````

You can also implement submodules this way
```` 
> cat foo/mod.rs 
pub mod max;
pub fn bar(s: String) -> String {
        format!("Hai {} from bar", s)
}
> cat foo/max.rs
pub fn baz(s: String) -> String {
    format!("Hi {} from max::baz", s)
}
> ls foo
max.rs  mod.rs
> cat main.rs
mod foo;
fn main() {
    println!("{}", foo::bar(String::from("baz")));
    println!("{}", foo::max::baz(String::from("baz")));
}
````

#### Library crate

A library crate that serves as a library for other applications
To create a library crate, one uses `cargo new --lib libraryname` 

Here is what a `lib` crate looks like
````
>tree libmodule
libmodule
├── Cargo.lock
├── Cargo.toml
└── src
    └── lib.rs
    
> cat libmodule/src/lib.rs
pub mod libfoo {
    pub fn gimme_a_song() -> String {
        String::from("Ace of Spades")
    }
}
````
The `lib.rs` file now forms the root of the libcrate

You can now use the libmodule library in your code just like you would use any other library (std, rng, etc)

Here is the main from our previous application using our new library
````
>cat main.rs 
mod foo;
fn main() {
    println!("{}", foo::bar(String::from("baz")));
    println!("{}", foo::max::baz(String::from("baz")));
    println!("{}", libmodule::libfoo::gimme_a_song());
}
````
Update our new library as a dependency in the Cargo manifest file
````
> cat Cargo.toml
[package]
name = "moduleblog"
version = "0.1.0"
authors = ["Govindarajan <ngovind@protonmail.com>"]
edition = "2018"

[dependencies]
libmodule = {path = "libmodule"} 
````

### What if there is `lib.rs` AND a `main.rs` ?

I have been building up this article to address this very point.
 For a long time, longer than the last time Liverpool won the PL, I have always been confused by the presence of both a `lib.rs` and `main.rs` in a binary crate.
 
  **Who among you reigns supreme ?**

In this case, the `main.rs` becomes a **consumer** of your application. The `lib.rs` is assumed to be the crate root. Your `main.rs` then treats your application code as an external crate and then imports the modules/fns/structs as needed.

With both a `lib.rs` and `main.rs`  
````
> tree moduleblog
.
├── foo
│   ├── max.rs
│   └── mod.rs
├── lib.rs
└── main.rs

> cat lib.rs
pub mod foo;
> cat main.rs
use moduleblog;
fn main() {
    println!("{}", moduleblog::foo::bar(String::from("baz")));
    println!("{}", moduleblog::foo::max::baz(String::from("baz")));
    println!("{}", libmodule::libfoo::gimme_a_song());
}
````
Note how one now **consumes** the application itself as a library in the `main` module.
For someone not using rust versions before `2018` you have to add an `external crate moduleblog` before the `use` statement;

## Conclusion

I haven't covered modules fully as it wasn't my intention (and neither have I used all of the features)

I had run into this pain point of organizing my code and not knowing how the heirarchy works and while the compiler was nice enough to get me to a solution without having to fully understand (a testament to how friendly the Rust compiler is)
I wrote this blog with the intention of understanding crates and crate roots and I hope it helps.

You can find the source code for the post [here](https://github.com/GoWind/modulenotes)

## References
It wouldn't have been possible to understand all of this without help from others. These are the references that helped me the most (and I remembered). Thanks to the community for being helpful as always ! 


https://github.com/rust-lang/book/issues/721
https://doc.rust-lang.org/1.1.0/book/crates-and-modules.html
https://learning-rust.github.io/docs/d4.crates.html










