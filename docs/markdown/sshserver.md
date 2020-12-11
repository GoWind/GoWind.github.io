# Configuring your SSH server

### Written on: Nov 21 2020

Should you ever decided to host your own website via a VM, 
it is essential that you should do some basic configuration
for the purpose of security

## SSH server
To login to your remote system, you usually have an `sshd` process running
that is the server process. 

`sshd` config is usually present in `/etc/ssh/sshd_config`.
Check your particular Linux vendor's documentation on where the config file
is located if it is not present in `/etc/ssh`

SSH server normally listens at port 22.

## Logging in 

You login using your username and a password or a `SSH key`.

A SSH key is a asymmetric key pair (public and private keys) that is used
by you to verify your authenticity to the server.

To login with a key instead of a password , upload a copy of your public key
into the directory of your user, on the remote VM.
There exists a handy tool `ssh-copy-id` that can be used to copy your SSH keys 
into the remote VM. More details available [here](https://linuxhandbook.com/add-ssh-public-key-to-server/)

## Disable root login.

Do not use root login to login to your remote VM.
Traditional sysadmins might tell you to even disable root user entirely,
although I am not sure and neither do I have any thing other than some static HTML files
in my VM, so us your own judegement

Sadly, my provider `DigitalOcean` allows users to spin up VMs by providing a Root password during 
the creation phase. Any leakage of the root user's password means that not only might your systems be compromised, you 
might also lose access to it, thus making it hard to recover it, unless you actually delete the VM instance. 

Disable Root Logins by setting the option `PermitRootLogin` to `no`.

## Disable password login

I would really recommend turning off password logins and use only Keys.
You can do that by setting `PermitAuthentication` to `no`.

Set `MaxAuthTries` to a really low number, say `2` or `3` so that a user cannot try their password multiple times
If you still need password auth.

Note: Within 2 weeks of creating my VM, my VM was flooded with a large number of requests
trying to login to my server using various common usernames (rsync, root, admin, etc). 

## Remap SSH port

To add a level of security, obfuscation isn't a bad idea.

Sure its not perfect security, but it will do a good job of preventing the script-kiddie attacks
from n00bs or bots from taking over your VM and will possibly take a dedicated, skilled,
hacker to actually hijack your machine.

Set the `Port` to a random. port number above 1024, so that automatic port scanners won't pick up your
instance (and dont reveal it to anyone).

## TODO:
Scripts to check `auth.log`. `/var/log/auth.log` usually has logs on which user/port no. tried to access your account
I would recommend adding scripts to check this file for possible  intrusions
