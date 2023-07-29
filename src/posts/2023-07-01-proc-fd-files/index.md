---
title: Lifecycle of proc fd files
tags: [linux]
list: true
excerpt: |

  The fd files under <code>/proc/&lt;pid&gt;/fd/</code> are created
  when a user read or list the fd files instead of when the actual
  files are opened.  When an open file is closed, the inode of the
  corresponding fd file stays in the VFS dcache, and could be reused
  later.

---

## 1. Demos

### 1.1. fd times

The times of a fd file tell when the fd file is first accessed (when
the fd file is instantiated).  It has nothing to do with the times of
the target file.  For example, `ls -l` output may have the same time
for all the files, even when they are created at different times:

```text
[root@archlinux fd]# ls -l
total 0
lrwx------ 1 root root 64 Apr 16 21:36 0 -> /dev/pts/2
lrwx------ 1 root root 64 Apr 16 21:36 1 -> /dev/pts/2
lrwx------ 1 root root 64 Apr 16 21:36 2 -> /dev/pts/2
lrwx------ 1 root root 64 Apr 16 21:36 3 -> 'socket:[29645]'
lrwx------ 1 root root 64 Apr 16 21:36 4 -> 'socket:[29649]'
```

We could use `stat -L` to get the target file inode info.  For
example, for a socket fd:

```text
[root@archlinux fd]# stat -L 3
  File: 3
  Size: 0               Blocks: 0          IO Block: 4096   socket
Device: 0,7     Inode: 29645       Links: 1
Access: (0777/srwxrwxrwx)  Uid: (    0/    root)   Gid: (    0/    root)
Access: 1970-01-01 00:00:00.000000000 +0000
Modify: 1970-01-01 00:00:00.000000000 +0000
Change: 1970-01-01 00:00:00.000000000 +0000
 Birth: -
```

Note that all times for socket files are at epoch 0.  Because it is
not set in the [`sock_alloc()`
function](https://github.com/torvalds/linux/blob/649c15c7691e9b13cbe9bf6c65c365350e056067/net/socket.c#L625).

### 1.2. Hidden inodes

To show the existence of hidden fd inodes, we could use a [bpftrace
script]({% srcLink trace.bt %}) to print the real number of inodes
under a `fd` dir.

For example, the following shows a fd dir having only 3 visible files
but 1004 inodes.  1001 inodes are hidden.

```text
[root@archlinux ~]# ls /proc/1408/fd
0  1  2
```

```text
[root@archlinux ~]# bpftrace trace.bt
Attaching 1 probe...
dir fd count 1004
```

## 2. Source Code Study

### 2.1. All fd files are symlinks

Fd files belong to the `proc` filesystem.  Each fd file is a symbolic
link that points to a file in another filesystem.  The [following
code](https://github.com/torvalds/linux/blob/0ec57cfa721fbd36b4c4c0d9ccc5d78a78f7fa35/fs/proc/fd.c#L197)
creates the inode for the fd file:

```c
static struct dentry *proc_fd_instantiate(struct dentry *dentry,
	struct task_struct *task, const void *ptr)
{
	...
	inode = proc_pid_make_inode(dentry->d_sb, task, S_IFLNK);
	...
	inode->i_op = &proc_pid_link_inode_operations;
	...
	ei->op.proc_get_link = proc_fd_link;
	...
}

static int proc_fd_link(struct dentry *dentry, struct path *path)
{
        ...
	task = get_proc_task(d_inode(dentry));
        fd = proc_fd(d_inode(dentry));
        fd_file = fget_task(task, fd);
	*path = fd_file->f_path;
        ...
}
```

The `S_IFLNK` flag makes the returned inode a symlink.  The inode
operation struct `proc_pid_link_inode_operations` has a `readlink`
operator that calls the function `proc_fd_link()` to resolve the
target file path.

The function `proc_fd_link()` gets the task struct and the fd number
from the inode, then it gets the target file path from the task's open
file table.  This way `proc_fd_link()` always returns the current
target file path even when the target file is changed.

## 2.2 Lifecycle of the fd files

A fd file is not created when a process opens the file.  Instead, it
is instantiated when the fd file is accessed, e.g. when we run `ls
/prod/<pid>/fd`.

When the process closes the file, the inode of the fd file is not
removed.  It stays in the `dcache` until the fd file is accessed
again, then the kernel notices that the file is gone and removes the
inode.

If the fd nubmer is reused, the inode of the fd file is not recreated
but reused for the new file.  When the fd is read, the `proc_fd_link`
operator function returns the new target file path.

The kernel function for creating the fd file is `proc_fd_instantiate`.
It is invoked by the `ls /proc/<pid>/fd` command or the `stat
/proc/<pid>/fd/<fd>` command.  The following shows the related code
and call stacks.

```c
static const struct pid_entry tgid_base_stuff[] = {
	DIR("fd", S_IRUSR|S_IXUSR, proc_fd_inode_operations, proc_fd_operations),
	...
}

const struct file_operations proc_fd_operations = {
	.iterate_shared	= proc_readfd,
	...
};

proc_readfd()
--> proc_readfd_common(file, ctx, proc_fd_instantiate);
    --> proc_fd_instantiate()

const struct inode_operations proc_fd_inode_operations = {
	.lookup		= proc_lookupfd,
	...
}

lookup_slow()
--> proc_lookupfd()
    --> proc_lookupfd_common(dir, dentry, proc_fd_instantiate);
        --> proc_fd_instantiate()
```

The `ls` command reads the `fd` directory by calling the VFS file
operator `iterate_shared`, which calls `proc_fd_instantiate` to create
the inode.  Similarly, the `stat` command calls the inode operator
`lookup`, which calls `proc_fd_instantiate`.  Details of the VFS API
can be found [here](https://www.kernel.org/doc/html/next/filesystems/vfs.html).

The call stack for deleting a fd inode is:

```c
lookup_fast()
--> dentry = __d_lookup_rcu(...);
--> d_revalidate(dentry, nd->flags);
    --> tid_fd_revalidate()
--> dput()
    ...
    --> iput()
```

The function `lookup_fast()` calls `__d_lookup_rcu()` to get the
`dentry` from `dcache`.  Then it calls `d_revalidate()` to check if
the file still exists.  If the file is closed, `dput()` is called to
release the `dentry` and frees its connected inode.
