---
title: Malloc in glibc
list: true
excerpt: |

  I went through glibc malloc code when troubleshooting a segfault.
  Here are some notes on the malloc code.

---

## 1. chunk

`malloc()` uses `sbrk()` or `mmap()` to request memory pages from OS,
then uses its internal data structure, "chunks", to organize blocks of
memories.  The following shows the chunk struct:

```c
struct malloc_chunk {
  size_t      mchunk_prev_size;  /* Size of previous chunk (if free).  */
  size_t      mchunk_size;       /* Size in bytes, including overhead. */

  struct malloc_chunk* fd;         /* double links -- used only if free. */
  struct malloc_chunk* bk;

  /* Only used for large blocks: pointer to next larger size.  */
  struct malloc_chunk* fd_nextsize; /* double links -- used only if free. */
  struct malloc_chunk* bk_nextsize;
};

typedef struct malloc_chunk* mchunkptr;
```

The fields `mchunk_prev_size` and `mchunk_size` connects chunks in
memory pages.  For example, the following macros get adjacent chuncks:

```c
#define PREV_INUSE 0x1
#define IS_MMAPPED 0x2
#define NON_MAIN_ARENA 0x4

#define SIZE_BITS (PREV_INUSE | IS_MMAPPED | NON_MAIN_ARENA)

#define next_chunk(p) ((mchunkptr)(((char *)(p)) + (p)->mchunk_size & ~(SIZE_BITS)))
#define prev_chunk(p) ((mchunkptr)(((char *)(p)) - (p)->mchunk_prev_size))
```

Free chunks are put into "bins" according to the chunk sizes.  Bins
are double-linked lists of chunks that are connected via the `fd`,
`bk`, `fd_nextsize`, and `bk_nextsize` fields.

The `malloc()` function finds a free chunk, sets the `PREV_INUSE` flag
in the `mchunk_size` field of the next chunk, then returns the memory
address at field `fd`.  The fields `fd`, `bk`, `fd_nextsize`, and
`bk_nextsize` are shared with user data.  The following macros
convert between the returned memory address and its corresponding
chunk address:

```c
#define chunk2mem(p)   ((void*)((char*)(p) + 2*SIZE_SZ))
#define mem2chunk(mem) ((mchunkptr)((char*)(mem) - 2*SIZE_SZ))
```

## 2. bins

The bins array is defined in `struct malloc_state`:

```c
struct malloc_state {
  ...
  mchunkptr bins[NBINS * 2 - 2];
  ...
};
```

The `bins` field stores the double-linked list headers of the bins.
Each header contains a forward pointer and a backward pointer, thus
the array size has `NBINS*2`.

Certain constants are used to compute bin indexes.  The following
lists some of these constants on x86_64 systems:

```c
SIZE_SZ           8
MALLOC_ALIGNMENT  16
MIN_CHUNK_SIZE    32
MINSIZE           32
NBINS             128
NSMALLBINS        64
SMALLBIN_WIDTH    16
MIN_LARGE_SIZE    1024
```

The following table shows the mapping from chunk size to bin indexes
on x86_64 systems.  The results are computed from the macro
`smallbin_index()` and `largebin_index_64()`:

| size                   | index                 | index range |
| -----------------------|-----------------------| ------------|
| unsorted               | 1                     | 1           |
| 2*16 - 63*16           | sz >> 4               | 2 - 63      |
| 1024 - ((49<<6)-1)     | 48 + (sz >> 6)        | 64 - 96     |
| 49<<6 - ((21<<9)-1)    | 91 + (sz >> 9)        | 97 - 111    |
| 21<<9 - ((11<<12)-1)   | 110 + (sz >> 12)      | 112 - 120   |
| 11<<12 - ((5<<15)-1)   | 119 + (sz >> 15)      | 120 - 123   |
| 5<<15 - ((3<<18)-1)    | 124 + (sz >> 18)      | 124 - 126   |
| others                 | 126                   | 126         |

Index 1 is for "unsorted" bins.  The other bins are "sorted" bins.
Chunks in unsorted bins have different sizes.  The `free()` function
puts chunks in the unsorted bin.  The `malloc()` function takes chunks
from the unsorted bin and inserts them into the sorted bin according
to their sizes.

Index 2 to 63 are for small bins.  Chunks in each small bin have the
same size (index*16).  The chunks in a bin are linked by their `fd`
and `bk` fields into a double-linked list.  The `fd_nextsize` and
`bk_nextsize` fields are not used.

Index 64 to 126 are for large bins.  Each large bin is a list of
lists.  Because each bin has chunks of different sizes, chunks of the
same size are linked in a list by the `fd` and `bk` fields.  These
chunk lists are sorted by chunk sizes and linked by the `fd_nextsize`
and `bk_nextsize` fields.  This data structure design is for quickly
finding a chunk with the requested size.

## 3. malloc

The `malloc()` function searches the free bins (small bins, unsorted
bins, and large bins) for a chunk with the requested size.  If no
chunk has the requested size, `malloc()` splits a larger chunk and
inserts the remainder chunk in the unsorted bin.

When searching the unsorted chunks, `malloc()` also moves chunks from
the unsorted bin to the sorted bins.

## 4. free

The `free()` function tries to merge the chunk with adjacent free
chunks, then inserts the resulting chunk to the unsorted bin.

## 5. errors

The `malloc()` and `free()` functions have a few checks for data
integrity.  For example, a double free could cause an assertion
failure that outputs error messages like "double free or corruption
(!prev)".  However, these checks cannot catch all errors.

Since the `fd`, `bk`, `fd_nextsize` and `bk_nextsize` fields are
shared with the caller, if certain data is modified after the chunk is
freed, the process could have undefined behavior.  The following
[code]({% srcLink segfault.c%}) shows a segfault example:

```c
#include <stdio.h>
#include <stdlib.h>
#include <malloc.h>

#define S_TCACHE 10

int main()
{
	long *p[S_TCACHE];
	int i;

	if (mallopt(M_MXFAST, 0) != 1)
		printf("mallopt error\n");

	for (i = 0; i < S_TCACHE; i++) {
		p[i] = malloc(8);
	}

	for (i = S_TCACHE - 1; i >= 0; i--) {
		printf("freeing p[%d]\n", i);
		free(p[i]);
		*p[i] = 0;
	}

	return 0;
}
```

Such errors could be tricky to troubleshoot because it may require a
specific sequence of calls to trigger. The following are some methods
that could help:

  - use gdb watch command to break on memory write to an address

  - use `mallopt(M_PERTURB, 0xf)` to auto-fill values on `free()`.

  - use [malloc hooks](https://man7.org/linux/man-pages/man3/malloc_hook.3.html)
