---
title: Tracing golang with bpftrace
tags: [bpftrace, golang]
list: true
excerpt: |

  Some tips and findings on tracing go binaries using bpftrace.

---

## 1. Probing function calls

For the following [example code]({% srcLink example.go%}):

```go
func mainTest() {
     ...
}

func main() {
	for {
		mainTest()
		time.Sleep(time.Second)
	}
}
```

To trace the function `mainTest()` function, we could do:

```text
$ sudo bpftrace -p 19162 -e 'uprobe:./example:main.mainTest {printf("here\n");}'
Attaching 1 probe...
```

Sometimes it is easier to use the function address instead of the
function name. First, use the following command to find the function
address:

```text
$ objdump -t example | grep mainTest
0000000000459e60 g     F .text  00000000000000ea main.mainTest
```

Then attach the probe to the function address:

```text
$ sudo bpftrace -p 19162 -e 'uprobe:./example:0x0000000000459e60 {printf("here\n");}'
Attaching 1 probe...
```

## 2. Calling convention

To figure out go calling conventions, we could compose some simple
functions, then look at their corresponding assembly code.  For
example, the following simple function:

```go
func fewArgsTest(a1, a2, a3, a4 uint64) (uint64, uint64, uint64, uint64) {
	return a1+0x11, a2+0x22, a3+0x33, a4+0x44
}
```

We can get its assembly code:

```text
$ gdb -batch -ex 'file ./example' -ex 'disassemble 0x0000000000459d20'
Dump of assembler code for function main.fewArgsTest:
   0x0000000000459d20 <+0>:     add    $0x11,%rax
   0x0000000000459d24 <+4>:     add    $0x22,%rbx
   0x0000000000459d28 <+8>:     add    $0x33,%rcx
   0x0000000000459d2c <+12>:    add    $0x44,%rdi
   0x0000000000459d30 <+16>:    ret
End of assembler dump.
```

It's easy to see that the four arguments are passed in registers
`rax`, `rbx`, `rcx`, and `rdi`.

This [example code]({% srcLink example.go%}) has more such functions.
The following are some results for Go 1.19.

### 2.1. Simple args

The first 9 args of 8-byte words are passed in registers. The rest
args are passed in the stack.  Input args are closer to the top of
stack than output args.

| Arg index  | Input     | Output                  |
| -----------|-----------| ------------------------|
| 1          | `rax`     | `rax`                   |
| 2          | `rbx`     | `rbx`                   |
| 3          | `rcx`     | `rcx`                   |
| 4          | `rdi`     | `rdi`                   |
| 5          | `rsi`     | `rsi`                   |
| 6          | `r8`      | `r8`                    |
| 7          | `r9`      | `r9`                    |
| 8          | `r10`     | `r10`                   |
| 9          | `r11`     | `r11`                   |
| 10         | `(rsp)+8` | `(rsp)+8+sizeof(input)` |

### 2.2. Struct args

If a struct size is smaller than or equal to 32 bytes, then the struct
is spread across the registers.  If the struct size is larger than 32
bytes, then the struct is passed in the stack.

## 3. Data structures

We can recover the memory layout (fields and offsets) of golang
structs using gdb.  Here are memory layouts of some basic go objects.

### 3.1. String

Strings are tuples of `(address, size)`.  The `bpftrace`'s builtin
function `str(address, size)` can print go strings.

### 3.2. Slice

Slices are tuples of `(address, len, cap)`.

### 3.3. Map

Maps are pointers to map structs.

## 4. Probing function returns

Do not use `uretprobe` for go because `uretprobe` could crash the
process.  For example, the [following code]({% srcLink crash.go%}):

```go
func recursion(level, maxLevel uint64) {
	if level > maxLevel {
		return
	}
	recursion(level+1, maxLevel)
}

func mainTest(maxLevel uint64) {
	recursion(0, maxLevel)
}

func main() {
	for {
		go mainTest(35)
		time.Sleep(time.Second)
	}
}
```

If a `uretprobe` is attached to the function `mainTest()`, the process
crashes with the following messages:

```text
$ ./crash
runtime: g 22: unexpected return pc for main.mainTest called from 0x7fffffffe000
stack: frame={sp:0xc000100fa8, fp:0xc000100fc8} stack=[0xc000100000,0xc000101000)
...
0x000000c000100fa8: <0x0000000000000000  0x0000000000000023 
0x000000c000100fb8:  0x000000c0000527d0 !0x00007fffffffe000 
0x000000c000100fc8: >0x0000000000000000  0x0000000000000000
...
fatal error: unknown caller pc

runtime stack:
runtime.throw({0x4a6ab6?, 0x52a940?})
        /usr/lib/go/src/runtime/panic.go:1047 +0x5d fp=0xc0000998e8 sp=0xc0000998b8 pc=0x43243d
runtime.gentraceback(...)
        /usr/lib/go/src/runtime/traceback.go:258 +0x1cf7 fp=0xc000099c58 sp=0xc0000998e8 pc=0x453df7
runtime.copystack(0xc000182000, 0x800000002?)
        /usr/lib/go/src/runtime/stack.go:932 +0x2f5 fp=0xc000099e10 sp=0xc000099c58 pc=0x449415
runtime.newstack()
        /usr/lib/go/src/runtime/stack.go:1112 +0x497 fp=0xc000099fc8 sp=0xc000099e10 pc=0x449997
runtime.morestack()
        /usr/lib/go/src/runtime/asm_amd64.s:570 +0x8b fp=0xc000099fd0 sp=0xc000099fc8 pc=0x45c20b
...
```

### 4.1. Cause of the crash

Go runtime may move a stack around in order to resizing the stack, as
shown in the assembly code of the function `recursion()`:

```text
$ gdb -batch -ex 'file ./crash' -ex 'disassemble 0x0000000000457c00'
Dump of assembler code for function main.recursion:
   0x0000000000457c00 <+0>:     cmp    0x10(%r14),%rsp
   0x0000000000457c04 <+4>:     jbe    0x457c35 <main.recursion+53>
   ...
   0x0000000000457c35 <+53>:    mov    %rax,0x8(%rsp)
   0x0000000000457c3a <+58>:    mov    %rbx,0x10(%rsp)
   0x0000000000457c3f <+63>:    nop
   0x0000000000457c40 <+64>:    call   0x454940 <runtime.morestack_noctxt>
   0x0000000000457c45 <+69>:    mov    0x8(%rsp),%rax
   0x0000000000457c4a <+74>:    mov    0x10(%rsp),%rbx
   0x0000000000457c4f <+79>:    jmp    0x457c00 <main.recursion>
End of assembler dump.
```

The function first checks the stack pointer `rsp`.  If the stack
pointer is too low, then it calls `runtime.morestack_noctxt`, which
may move the current stack to a larger stack.

Here are the events that lead to a crash:

1. `uretprobe` installs a trap (`int 3`) at `&mainTest`.

2. CPU executes instruction `call mainTest`.  The return address is
   pushed to the stack.

3. The trap is triggered and the trap handler overwrites the return
   address in the stack with the address of a trampoline code (located
   at `0x7fffffffe000`), which contains a trap instruction. These 3
   steps are essentially how `uretprobe` works.

4. The go function `recursion()` calls `runtime.morestack()`, which
   moves the stack to a new address and then calls
   `runtime.gentraceback()` to rebuild the stacktrace from the new
   stack.  Since `0x7fffffffe000` is not a valid go function return
   address, `runtime.gentraceback()` throws an "unknown caller pc"
   error.

### 4.1. Workaround

Because `uretprobe` does not work for go, we have to install `uprobe`
at every `ret` location of a function to probe the function returns.
[Here](https://github.com/mechpen/gotlsdump/blob/e4cb3d/gotlsdump.py)
is an example of doing this programmatically.
