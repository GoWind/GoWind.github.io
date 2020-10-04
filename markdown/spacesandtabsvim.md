# Understanding `tabstop`, `shiftwidth`, `softtabstop` and `expandtab`

Dealing with tabs and spaces can be tricky with vim. Here I try to explain how 3 options work to configure vim.

## `tabstop`
Tabstop defines how many spaces each tab byte in the file represents. 
If a file has tab bytes, then if `tabstop` (or `ts`) is set to `4`, then each tab **visually** expands to 4 spaces.
`tabstop` does not automatically convert tabs to spaces. It just merely represents each tab as the number of 
spaces it is defined to.

## `shiftwidth`
`shiftwidth` governs by how many spaces, a line has to be indented left or right when a `<<` or a `>>` (indent) command is 
generated in visual mode. 
If `shiftwidth` is set to 2 , each `<<` moves the indentation 2 `spaces` left. 
If `shiftwidth` != `tabstop` , then the `tab` character, is optionally converted to spaces and or tabs.
For example, if you have a `tabstop` of 8 and a `shiftwidth` or 2 and you have a `\tdata`, the `data` appears visually
to have `8spaces data`. Left shifting with `<<`, 6 space chars are inserted.
If `tabstop` were 4, and you have a line `\t\tdata` , with `shiftwidth=2`, and you left-ident the line, the line
is converted to `\t\s\sdata`.
In general, shiftwidth will try to maximize the number of tabs.



## `softtabstop`

`softtabstop` (or `sts`), when editing text, defines how many spaces and tabs are inserted/deleted when a `tab` or a `BS` (backspace) key is pressed.
The number of spaces/tabs added depends on the exact settings.
For example, if `sts=2` and `tabstop=4`, each `tab` or `backspace`, adds or deletes 2 spaces.
If `sts=6` and `tabstop=4`, then each tab press adds a tab and a `\t\s\s` and deletes a `\t\s\s` respectively.

## `expandtab`
When set, expandtab converts `tabs` to spaces when a tab is pressed. The number of spaces that are inserted for every
`tab` depends on the configuration.
If `softtabstop` is set, each tab is expanded to `softtabstop` no. of spaces.
Else, `tabstop` no. of spaces are inserted

## Playing with tab settings
You can play around with `ts`, `sts` and `shiftwidth` settings and understand how they work. 
To visualize tabs nicely, set the following options in your `~/.vimrc` (or other config file, in case of neovim),
so that `tabs` show up as a `>-` visually.

`set list`
`set listchars=tab:>-`
Try setting different
`sts`,`ts` and `shiftwidth` values and turning on and off `expandtab`.


### References
https://vim.fandom.com/wiki/Converting_tabs_to_spaces

https://www.reddit.com/r/vim/comments/99ylz8/confused_about_the_difference_between_tabstop_and/


