---
title: Malloc in glibc
list: true
excerpt: |

  I went through glibc malloc code when troubleshooting a segfault.
  Here are some notes on the malloc code.

---

## 1. chunk

`malloc()` uses `sbrk()` or `mmap()` to request memory pages from OS,
then uses chunks to organize blocks of memories.  The chunks have the
following data structure:

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
```

The fields `mchunk_prev_size` and `mchunk_size` are used to connect
chunks in memory pages.  For example, the following helper macros are
defined:

```c
#define SIZE_BITS (PREV_INUSE | IS_MMAPPED | NON_MAIN_ARENA)

#define next_chunk(p) ((mchunkptr)(((char *)(p)) + (p)->mchunk_size & ~(SIZE_BITS)))
#define prev_chunk(p) ((mchunkptr)(((char *)(p)) - (p)->mchunk_prev_size))
```

When `malloc()` finds a free chunk, it sets the `PREV_INUSE` flag in
the `mchunk_size` field of the next chunk, then returns the memory
address at field `fd`.  The fields `fd`, `bk`, `fd_nextsize` and
`bk_nextsize` are shared with user data.  The following macros map
between `malloc()` returned memory address and its corresponding chunk
address:

```c
#define chunk2mem(p)   ((void*)((char*)(p) + 2*SIZE_SZ))
#define mem2chunk(mem) ((mchunkptr)((char*)(mem) - 2*SIZE_SZ))
```

Free chunks are put into "bins" according to the chunk sizes.  Bins
are double linked lists which are connected via the `fd`, `bk`,
`fd_nextsize` and `bk_nextsize` fields.

## 2. bins

The bins array is defined in `struct malloc_state`:

```c
struct malloc_state {
  ...

  /* Fastbins */
  mfastbinptr fastbinsY[NFASTBINS];

  /* Base of the topmost chunk -- not otherwise kept in a bin */
  mchunkptr top;

  /* Normal bins packed as described above */
  mchunkptr bins[NBINS * 2 - 2];

  ...
};
```

The `bins` field stores the double link list headers for the bins.
Each header contains a forward pointer and a backward pointer.

Certain constants are used to compute bin indexes.  The following
table shows some of these constants on x86_64 systems:

| const             | value |
|-------------------|-------|
| SIZE_SZ           | 8     |
| MALLOC_ALIGNMENT  | 16    |
| MIN_CHUNK_SIZE    | 32    |
| MINSIZE           | 32    |
| NBINS             | 128   |
| NSMALLBINS        | 64    |
| SMALLBIN_WIDTH    | 16    |
| MIN_LARGE_SIZE    | 1024  |

The following table shows the mapping from chunk size to bin indexes
(the results are from the macro `largebin_index_64()`):

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
same size (index*16).  The `fd_nextsize` and `bk_nextsize` fields in
`struct malloc_chunk` are not used.

// FIXME
Index 64 to 126 are for large bins.  Each large bin has chunks of
various sizes.  Chunks of the same size are linked in a list by the
`fd` and `bk` fields.  The lists are sorted by their chunk sizes and
linked by the `fd_nextsize` and `bk_nextsize` fields.  This data
structure design is for quickly finding a chunk with the request size.

## 3. malloc

The `malloc()` function searches the free bins (small bins, unsorted
bins, and large bins) for a chunk with the requested size.  If no
chunk has the requested size, `malloc()` splits a larger chunk, and
inserts the remainder chunk in the unsorted bin.

When searching the unsorted chunks, `malloc()` also moves chunks from
the unsorted bin to the sorted bins.

## 4. free

The `free()` function tries to merge the chunk with adjacent chunks,
then inserts the result chunk to the unsorted bin.

## 5. errors

The `malloc()` and `free()` functions have a few checks for integrity
of the chunk info.  For example, a double free could cause an
assertion failure that outputs error messages like "double free or
corruption (!prev)".  However, since the fields like`fd`, `bk`, and
etc are returned to caller, if some data is modified after it is
freed, the process could segfault.  The following [code]({% srcLink
segfault.c%}) shows such an example:

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
