# Syscalls with Rust

I came to know of the [Doom Fire](http://fabiensanglard.net/doom_fire_psx/) Technique for generating the opening scene of the Doom game and I tried to implement it on the command line.

If you ever wonder how CLI applications show colored output, there are `ANSI escape sequences` that one can output for controlling color, text highlighting etc. 

ANSI escape sequences starts with an `ESC` character `0x1B` followed by a byte in the `0x40-0x5F` range. You can read more about ANSI escape codes [here](https://en.wikipedia.org/wiki/ANSI_escape_code)

Anyway, while my attempt to implement the Doom Fire algorithm using ANSI escape codes ended up looking something like this:

<img src="doomfail.png" width="500" height="500" alt="failure at implementing Doom fire"></img>
I ended up learning a lot more about system calls. 

The algorithm relies on treating the screen as a 2D grid of cells consisting of rows and columns, which lead me to the question: How do I know how many rows and columns does my terminal have ?

Turns out there is a simple command that tells you
`stty -a`

It also displays a lot more information that might not be relevant today (example: it shows Baud rate, which is meaningless in the days of pseudoterminals but were set by real Terminal devices that used a serial connection to the computer in the basement)

Here is the output of `stty -a` from my terminal
```
speed 38400 baud; rows 36; columns 146; line = 0;
intr = ^C; quit = ^\; erase = ^?; kill = ^U; eof = ^D; eol = <undef>; eol2 = <undef>; swtch = <undef>; start = ^Q; stop = ^S; susp = ^Z;
rprnt = ^R; werase = ^W; lnext = ^V; discard = ^O; min = 1; time = 0;
-parenb -parodd -cmspar cs8 -hupcl -cstopb cread -clocal -crtscts
-ignbrk -brkint -ignpar -parmrk -inpck -istrip -inlcr -igncr icrnl ixon -ixoff -iuclc -ixany -imaxbel iutf8
opost -olcuc -ocrnl onlcr -onocr -onlret -ofill -ofdel nl0 cr0 tab0 bs0 vt0 ff0
isig icanon iexten echo echoe echok -echonl -noflsh -xcase -tostop -echoprt echoctl echoke -flusho -extproc

```

Now how do we get this information in our program

### Attempt 1

I wrote a function that creates a new process running `stty` and then reading the `STDOUT` of the process and parsing the output to obtain the `rows` and `columns` value from it. 

Here is how the `fn` looks
```
fn get_tty_rows_columns() -> Result<(i32, i32), String> {
    let c = Command::new("stty")
                    .arg("-a")
                    .stdin(Stdio::inherit())
                    .output()
                    .expect("failed to get terminal attributes");
    let stty_result = std::str::from_utf8(&c.stdout).unwrap().split(";").collect::<Vec<_>>();
    let mut rows = 0;
    let mut cols = 0;
    for setting in stty_result {
        if let Some(idx) = setting.find("rows") {
            let row_setting = setting.trim().split(" ").collect::<Vec<_>>();
            rows = row_setting[1].parse::<i32>().unwrap();
        } else if let Some(idx) = setting.find("columns") {
            let col_setting = setting.trim().split(" ").collect::<Vec<_>>();
            cols = col_setting[1].parse::<i32>().unwrap();
        } else {
        }
    }
    Ok((rows, cols))

}
```

Kinda messy, but gets the job done. 

But wait a minute. We are in UNIX land. Can we not figure out how stty obtains information about the terminal that it formats nicely before displaying to us ? Ofcourse ! Enter `strace` !
`strace` shows the system calls made by a program and their arguments. We could look at the system calls list to figure out which of the system calls provides us with information about the terminal 

Doing a `strace stty -a` gives the following output
```
Elided output that is not relevant currently and is too large to display
ioctl(0, TCGETS, {B38400 opost isig icanon echo ...}) = 0
ioctl(1, TIOCGWINSZ, {ws_row=36, ws_col=146, ws_xpixel=0, ws_ypixel=0}) = 0
fstat(1, {st_mode=S_IFCHR|0620, st_rdev=makedev(136, 7), ...}) = 0
ioctl(0, TIOCGWINSZ, {ws_row=36, ws_col=146, ws_xpixel=0, ws_ypixel=0}) = 0
write(1, "speed 38400 baud; rows 36; colum"..., 50speed 38400 baud; rows 36; columns 146; line = 0;
) = 50
write(1, "intr = ^C; quit = ^\\; erase = ^?"..., 137intr = ^C; quit = ^\; erase = ^?; kill = ^U; eof = ^D; eol = <undef>; eol2 = <undef>; swtch = <undef>; start = ^Q; stop = ^S; susp = ^Z;
) = 137
write(1, "rprnt = ^R; werase = ^W; lnext ="..., 70rprnt = ^R; werase = ^W; lnext = ^V; discard = ^O; min = 1; time = 0;
) = 70
write(1, "-parenb -parodd -cmspar cs8 -hup"..., 66-parenb -parodd -cmspar cs8 -hupcl -cstopb cread -clocal -crtscts
) = 66
write(1, "-ignbrk -brkint -ignpar -parmrk "..., 108-ignbrk -brkint -ignpar -parmrk -inpck -istrip -inlcr -igncr icrnl ixon -ixoff -iuclc -ixany -imaxbel iutf8
) = 108
write(1, "opost -olcuc -ocrnl onlcr -onocr"..., 80opost -olcuc -ocrnl onlcr -onocr -onlret -ofill -ofdel nl0 cr0 tab0 bs0 vt0 ff0
) = 80
write(1, "isig icanon iexten echo echoe ec"..., 108isig icanon iexten echo echoe echok -echonl -noflsh -xcase -tostop -echoprt echoctl echoke -flusho -extproc
) = 108
```

Bingo ! It looks there is an `ioctl` that refers to something called `ws_row` and `ws_col` that contains the values we need. 

Googling about `ioctl` tells me that this is a **REALLY** powerful system call, used (and abused) to control all sorts of Linux devices 

In this case, `ioctl` takes a `TIOCGWINSZ` (terminal config window size?) constant and its argument is a `struct winsize` that is filled with the details of the terminal if the call is successful.

Now comes the next step: How do we make the system call from our `Rust` program? With `C` the answer is as simply as using `ioctl.h`, which contains all the definitions and implementations that we need. 


### Nix and libc

The [libc crate](https://github.com/rust-lang/libc) provides type definitions and structs required for `C` or `C-like` code from Rust programs. This crate contains the definitions that we would need to interact with the Linux system calls
`libc` also has an implementation of `ioctl` but it looked a bit hard to use it, so enter the [nix](https://docs.rs/crate/nix/0.13.0) crate. `Nix`provides a set of of safe bindings over the `libc` crate and has a bunch of macros to make it easier to deal with `unsafe` code

Here is how we now use system calls directly from our code:
```
use libc;
use nix::{ioctl_read_bad, convert_ioctl_res};

nix::ioctl_read_bad!(read_terminal_size, libc::TIOCGWINSZ , libc::winsize);
let mut s: libc::winsize;
unsafe 
{
    s = std::mem::uninitialized();
    read_terminal_size(1, &mut s);
}
println!("\n\n\n\n\n rows {} cols {} \n\n\n\n", s.ws_row, s.ws_col);

```
The `ioctl_read_bad` macro creates a `fn` with the `name` passed to it as the first argument and the rest as arguments to the `ioctl` call. 
When calling the  `name` , you then simply pass in te File descriptor of the device whose info you need and the data structure that serves as the input/output information for the system call. 

 ` rows 36 cols 146` : What we needed, but much more easier to obtain ! 

## Conclusion

`ANSI escape codes` are a lot fun, and you can use them to build some really interesting CLI applications. There is also a `termios` crate if you don't want to use escape codes directly and prefer using a library instead.

