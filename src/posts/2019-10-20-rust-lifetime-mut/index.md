---
title: Understanding Rust lifetime and mutability
tags: [rust]
list: true
styles:
- https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.5.1/katex.min.css
- style.css
excerpt: |

  Lifetime and mutability are simple concepts.  However, when combined
  with reborrow and subtyping, it could get very confusing.  Here's a
  summary of my current understandings.

---

## Basic rules

**Immutable rule:** *Within the lifetime of an immutable reference to
a variable, the variable can only be used as immutable references.*

Examples:

```rust
struct S{}

fn main() {
    let mut x = S{};
    let rx = &x;
    &x;                   // can have another immutable reference
    // x = S{};           // cannot assign to x
    // let y = x;         // cannot move
    // x;                 // cannot implicit move
    // let mrx = &mut x;  // cannot have mutable reference to x
    rx;
}
```

Note that if struct `S` implements the `Copy` trait, then `x` can be
copied, because `Copy` uses `Clone`, and `Clone::clone(&self)` takes
an immutable reference.

The following is an example with an explicit lifetime parameter:

```rust
fn foo<'a>(x: &'a u32) -> &'a u32 {
    &1
}

fn main() {
    let mut x = 1;
    let ry = foo(&x);
    // x = 2;             // cannot assign to x
    ry;
}
```

In the above example, even though the value of `x` is not related to
`ry`, the function call `foo(&x)` creates a immutable reference of `x`
which shares the same lifetime `'a` with reference `ry`.

**Mutable rule:** *A mutable reference is equivalent to a temporary move.*

Examples:

```rust
fn main() {
    let mut x = 1;
    let rx = &x;
    let mrx = &mut x;     // x is temporarily moved to *mrx
    // x;                 // cannot use x because it is moved to mrx
    // rx;                // same for rx
    mrx;                  // move ends after this line
    x;                    // can use x again after move ends
}
```

## Reborrow

Mutable reference `&'a mut T` does not implement the `Copy` trait.
There are 2 ways of accessing mutable references: move and reborrow.

A move example:

```rust
fn main() {
    let x = &mut 1;
    let y = x;            // move x to y
    // x;                 // cannot use x
}
```

Reborrow is implicitly accessing a mutable reference `x` as `&*x` or
`&mut *x`.  `&*x` is the same as immutable reference, and `&mut *x` is
the same as mutable reference.  The following shows examples of
reborrow:

```rust
fn foo(x: &mut u32) {
    *x = 2;
}

fn main() {
    let x = &mut 1;
    foo(x);               // reborrow for function argument
    let y: &u32 = x;      // reborrow: y = &*x
    let z: &mut u32 = x;  // reborrow: z = &mut *x
    x;                    // can use x again after temp move ends
}
```

Reborrow happens when a mutable reference's type changes.  In the
above example: `let z: &mut u32 = x` changes type of `x` from `&'x mut
u32` to `&'z mut u32`.  The type change is not necessarily
"*weakening*".  For example, the assignment in the above example: `let
y: &u32 = x`, changes the type of `x` from a mutable reference to an
immutable reference.  Immutable references are not supertypes of
mutable references (`&T` implements `Copy` but `&mut T` does not).

It is worth noting that the following identity function `id()` moves
mutable references instead of reborrow:

```rust
fn id<T>(x: T) -> T {
    x
}

fn main() {
    let x = &mut 1;
    id(x);                // x is moved into id()
    // x;                 // cannot use x
}
```

More info about the identity function can be found in this [blog
post](https://bluss.github.io//rust/fun/2015/10/11/stuff-the-identity-function-does/).

## Subtyping

Subtyping "duplicates" a variable with a weaker type.  It happens to
all assignments and function arguments when the target type is
"*weakened*".  Subtyping follows the [variance
rules](https://doc.rust-lang.org/nomicon/subtyping.html#variance).

An example of lifetime subtyping:

```rust
fn foo<'a>(x: &'a mut u32, y: &'a u32) {}

fn main() {
    let x = &mut 1;
    let y = &2;
    foo(x, y);
    x;
    y;
}
```

In the above example, what is the region covered by the lifetime
parameter `'a`?

When calling `foo(x, y)`, rust subtypes function arguments `x` and
`y`.  The type of `x` is changed from `&'x mut u32` to `&'a mut u32`,
and the type of `y` is changed from `&'y u32` to `&'a u32`.  The
subtyping is good given that:

  1. `&'a T` and `&'a mut T` are covariant over `'a`;

  2. `'x: 'a` and `'y: 'a`, i.e. `'a` is a subtype of both `'x` and `'y`.

The region of `'a` could be as small as possible.  The minimum region
of `'a` contains the single line `foo(x, y)`.

Note that in `foo(x, y)`, subtyping happens for both reborrow (`x`)
and copy (`y`).

## Examples

Now we have all the basic concepts.  Let's apply them to some
examples.

### Example 1

<div class="badcode"></div>

```rust
fn get_x<'a, 'b>(x: &'b &'a mut u32) -> &'a u32 {
    *x
}
```

This above function does not compile.  However, with trivial fixes,
the following 2 functions compiles:

```rust
fn get_x1<'a, 'b>(x: &'b &'a mut u32) -> &'b u32 {
    *x
}

fn get_x2<'a, 'b>(x: &'b &'a u32) -> &'a u32 {
    *x
}
```

A mutable reference is equivalent to a temporary move.  So for `&'b &'a
mut u32`, the value is moved to `x` for lifetime `'b`, and we cannot
borrow the value for `'a` where`'a: 'b`.  That's why `get_x()` does
not compile but `get_x1()` does.

For immutable reference `&'b &'a u32` the value is not moved, so
`get_x2()` is good.

### Example 2

<div class="badcode"></div>

```rust
fn foo<'a, 'b>(x: &'b mut &'a u32, y: &'a mut u32) {}

fn main() {
    let mut x = &1;
    let mut y = 2;
    foo(&mut x, &mut y);
    y;
    x;
}
```

The above code does not compile.  To understand why, we need to find
out the region of lifetime `'a`.

Let's first de-sugar the `main()` function:

<div class="badcode"></div>

```rust
fn main() {
    let mut x = &1;
    let mut y = 2;
    let rx = &mut x;
    let ry = &mut y;
    foo(rx, ry);
    y;
    x;
}
```

When calling function `foo()`, subtypes of `rx` and `ry` are created:

```rust
    rx: &'rx mut &'x u32 --> &'b mut &'a u32
    ry: &'ry mut u32     --> &'a mut u32
```

By the [variance
rules](https://doc.rust-lang.org/nomicon/subtyping.html#variance),
`&'a mut T` is invariant over `T`.  For `&'rx mut &'x u32`, `T` is
`&'x u32`.  The invariant property requires `&'x u32 == &'a u32`, so
`'a = 'x`.

The subtype for `ry` takes a mutable reference of `y` for lifetime
`'a`, so `y` is not accessible within `'a`.  Thus the code does not
compile.
