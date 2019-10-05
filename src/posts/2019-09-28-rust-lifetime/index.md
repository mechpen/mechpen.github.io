---
title: Understanding Rust lifetime
tags: [rust]
list: true
styles:
- https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.5.1/katex.min.css
- style.css
excerpt: |

  Rust ownership and lifetime are very powerful tools.  They were
  designed to help compiler get better optimization.  As a side
  effect, they could force programmers to write cleaner code, even
  design better interfaces.  Here are some theories and examples that
  may help understanding lifetimes.  Disclaimer: I didn't read the
  compiler code so I could be wrong.

---

## Lifetime, who's lifetime

It's very easy to confuse lifetimes with scopes.  In fact, they are
different concepts.

In rust code, all objects, including constants, owned variables and
references, have scopes.  Lifetime parameters are associated with
references to express relationships between scopes.  One lifetime
parameter could be associated with multiple references, and one
reference could have multiple associated lifetime parameters.

For the expression `x: &'a T`, instead of saying `'a` is the lifetime
of `x`, we should say: `'a` is associated with the reference `x`.

In terms of algebra, scopes are values like 1, 2, 3, and lifetimes are
variables like $x, y, z$.  Lifetime associations and rules creates
inequalities, and rust compiler tries to solve these inequalities.

## Lifetime rules

The following are the 3 fundamental lifetime rules and their meanings.
On the left of $\Rightarrow$ are rust expressions, on the right are
the implied algebraic relations.

1. Association rule:

   $\quad$`x: &'a T` $\;\Rightarrow\;scope(\text{x})\subseteq\text{'a}$

   A lifetime is a superset of the scope of its associated reference.

2. Reference rule:

   $\quad$`x: &'a T = &y` $\;\Rightarrow\;\text{'a}\subseteq scope(\text{y})$

   A lifetime associated with a reference is a subset of the scope of
   the referent object.

3. Assignment rule;

   $\quad$`x: &'a S = y: &'b T` $\;\Rightarrow\;\text{'a}\subseteq\text{'b}$

   The lifetime associated with the assignee is a subset of the
   lifetime associated with the assigner.

   This assignment also contains a type rule:
   <nobr>$\text{S}\subseteq\text{T}$,</nobr> i.e. `T` is a subtype of
   `S`.

From the above fundamental rules, we could deduce some useful rules:

4. Struct reference rule:

   Given a struct `struct S<'a> { x: &'a T }`, then

   $\quad$`s: &'b S<'a>` $\;\Rightarrow\;\text{'b}\subseteq\text{'a}$

   The lifetime associated with a struct reference is a subset of the
   lifetime associated with the struct member.

   *Proof*: For `s: &'b S<'a>`, there must be an object `y: S<'a>`,
   such that `s: &'b S = &y`.  Thus $\text{'b}\subseteq
   scope(\text{y}) = scope(\text{y.x})\subseteq\text{'a}$.

5. Double reference rule:

   $\quad$`x: &'b &'a T` $\;\Rightarrow\;\text{'b}\subseteq\text{'a}$

   The proof is similar to the struct reference rule.

There are also some special lifetime expressions:

6. Lifetime bound:

   $\quad$`'a: 'b` $\;\Leftrightarrow\;\text{'b}\subseteq\text{'a}$

7. Static scope:

   $\quad$`'a` $\;\Rightarrow\;\text{'a}\subseteq\text{'static}$

   Only static objects have static scopes.  Static objects are not
   located in stack or heap.  They are located in data segments or
   code segments that are mapped to the process memory.

## Examples

### Example 1

The first simple example is from the
[rust book](https://doc.rust-lang.org/stable/book/ch10-03-lifetime-syntax.html#preventing-dangling-references-with-lifetimes).

<div class="badcode"></div>

```rust
{
    let r;

    {
        let x = 5;
        r = &x;
    }

    println!("r: {}", r);
}
```

The compiler tries to associate a lifetime `'a` with reference `r`
that satisfies the follow inequalities:

$\quad\begin{aligned}
scope(\text{r})\subseteq\text{'a} &\quad&\quad & \text{rule 1}\\
\text{'a}\subseteq scope(\text{x}) &\quad&\quad& \text{rule 2}
\end{aligned}$

This is not possible because $scope(\text{x})\subseteq
scope(\text{r})$, so the code does not compile.

### Example 2

The second example is a modified version of an example in the
[rust book](https://doc.rust-lang.org/stable/book/ch10-03-lifetime-syntax.html#lifetime-annotations-in-function-signatures).

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() {
        x
    } else {
        y
    }
}

fn main() {
    let s1 = String::from("long string is long");
    let s2 = String::from("xyz");
    let result;
    {
        let rs1 = &s1;
        let rs2 = &s2;
        result = longest(rs1, rs2);
    }
    println!("The longest string is {}", result);
}
```

In this example, lifetime `'a` is associated with both `rs1` and
`rs2`.  The compiler needs to find a lifetime `'a` that satisfies:

$\quad\begin{aligned}
scope(\text{rs1})\subseteq\text{'a}\subseteq scope(\text{s1})\\
scope(\text{rs2})\subseteq\text{'a}\subseteq scope(\text{s2})
\end{aligned}$

$scope(\text{s2})$ satisfies these inequalities, so `'a` could be
$scope(\text{s2})$, and the compiler passes the check.

### Example 3

This example shows an uncommon application of the assignment rule.
The constraints in the `where` clause are necessary in order to
satisfy the assignment rule.  There are also two implied constraints
from the struct reference rule: `'a: 'b` and `'c: 'd`.

```rust
struct S<'a> {
    x: &'a u32,
}

fn foo<'a, 'b, 'c, 'd>(s: &'b S<'a>) -> &'d S<'c> where 'a: 'c, 'b: 'd {
    s
}
```

## Static lifetime and runtime lifetime

Rust scopes and lifetimes are static lexical constructs.  They are
used to emulate lifetimes of data objects at runtime.  However, static
lifetimes could be different to runtime lifetimes, as shown in the
following example:

<div class="badcode"></div>

```rust
#[derive(Debug)]
struct S {}

fn main() {
    let x = S {};
    let y = &x;
    let z = x;
    println!("{:?}", y);
}
```

An instance of struct `S` is first bound to `x`, then moved to `z`.
The runtime lifetime of the instance spans the whole function
invocation.  But the scope of `x` ends when `x` is moved to `z`.  Any
lifetime associated with y could not be satisfied because
$scope(\text{y})\nsubseteq scope(\text{x})$.  Thus the code does not
compile.

## Thoughts

In the above, we did not consider mutable variables and references.
Lifetime rules associated with mutable references are not
straightforward to abstract.  I'll take this to a follow-up post.
