---
title: Workaround for a bpf verifier error
tags: [bpf]
list: true
excerpt:

  Linux bpf verifier allows only one specific pattern for accessing
  skb data.  To help the clang compiler generate the required access
  pattern, we have to write C code in a certain way to reflect this
  pattern.

---

## The faulty code

At first I used the following [code](demo_bad.c) to access skb data:

```c
#define ensure_header(skb, offset, hdr)				\
({								\
	u32 tot_len = offset + sizeof(*hdr);			\
	void *data = (void *)(long)skb->data;			\
	void *data_end = (void *)(long)skb->data_end;		\
								\
	if (data + tot_len > data_end) {			\
		bpf_skb_pull_data(skb, tot_len);		\
								\
		data = (void *)(long)skb->data;			\
		data_end = (void *)(long)skb->data_end;		\
								\
		if (data + tot_len > data_end)			\
			return TC_ACT_OK;			\
	}							\
								\
	hdr = (void *)(data + offset);				\
})

__attribute__((section("main")))
int handle_skb(struct sk_buff *skb)
{
	u32 hdrlen, offset;
	struct iphdr *ip4;
	struct tcphdr *tcp;
	char fmt[] = "%d\n";

	offset = ETH_HLEN;
	ensure_header(skb, offset, ip4);

	hdrlen = ipv4_hdrlen(ip4);
	if (hdrlen < sizeof(*ip4))
		return TC_ACT_OK;

	offset += hdrlen;
	ensure_header(skb, offset, tcp);

	hdrlen = tcp_hdrlen(tcp);
	bpf_trace_printk(fmt, 4, hdrlen);

	return TC_ACT_OK;
}
```

The code access skb data twice.  First it reads the IP header `ihl`
field to compute IP header length, then it reads the TCP header `doff`
field to compute TCP header length.  Both accesses are guarded by the
macro `ensure_header()` to ensure that data is available.

The clang compiler generates the following bpf [assembly](demo_bad.s):

```asm
       0: 	r6 = r1
       1: 	r1 = 680997
       2: 	*(u32 *)(r10 - 4) = r1
       3: 	r2 = *(u32 *)(r6 + 80)        ; data_end = skb->data_end
       4: 	r1 = *(u32 *)(r6 + 76)	      ; data = skb->data
       5: 	r3 = r1
       6: 	r3 += 34
       7: 	if r2 >= r3 goto +8 <LBB0_2>  ; if (data + tot_len > data_end)
       8: 	r1 = r6
       9: 	r2 = 34
      10: 	call 39                       ; bpf_skb_pull_data(skb, tot_len)
      11: 	r2 = *(u32 *)(r6 + 80)        ; data_end = skb->data_end
      12: 	r1 = *(u32 *)(r6 + 76)	      ; data = skb->data
      13: 	r3 = r1
      14: 	r3 += 34
      15: 	if r3 > r2 goto +27 <LBB0_6>  ; if (data + tot_len > data_end)
LBB0_2:
      16: 	r8 = *(u8 *)(r1 + 14)         ; r8 = ip4->ihl
      17: 	r8 <<= 2
      18: 	r8 &= 60
      19: 	r3 = 20
      20: 	if r3 > r8 goto +22 <LBB0_6>  ; if (hdrlen < sizeof(*ip4))
      21: 	r7 = r8
      22: 	r7 += 34
      23: 	r3 = r1
      24: 	r3 += r7
      25: 	if r2 >= r3 goto +8 <LBB0_5>  ; if (data + tot_len > data_end)
      26: 	r1 = r6
      27: 	r2 = r7
      28: 	call 39                       ; bpf_skb_pull_data(skb, tot_len)
      29: 	r1 = *(u32 *)(r6 + 76)	      ; data = skb->data
      30: 	r2 = r1
      31: 	r2 += r7
      32: 	r3 = *(u32 *)(r6 + 80)        ; data_end = skb->data_end
      33: 	if r2 > r3 goto +9 <LBB0_6>   ; if (data + tot_len > data_end)
LBB0_5:
      34: 	r8 += 14
      35: 	r1 += r8
      36: 	r3 = *(u8 *)(r1 + 12)         ; r3 = tcp->doff
      37: 	r3 >>= 2
      38: 	r3 &= 60
      39: 	r1 = r10
      40: 	r1 += -4
      41: 	r2 = 4
      42: 	call 6                        ; bpf_trace_printk(fmt, 4, hdrlen)
LBB0_6:
      43: 	r0 = 0
      44: 	exit

```

When loading the bpf program, the verifier rejects the program with an
error:

```x
# tc filter add dev wlan0 egress bpf da obj demo_bad.o sec main
...
36: (71) r3 = *(u8 *)(r1 +12)
invalid access to packet, off=12 size=1, R1(id=3,off=0,r=0)
R1 offset is outside of the packet
...
```

The error is at instruction `#36`, the second access of the skb data.
Why the first packet access is OK, but the second access is not?

The first access has a constant offset (14), whereas the second access
has a variable offset.  Is variable offset not allowed?  No.  I
removed the `bpf_skb_pull_data()` before the second access and then
the verifier is happy.

## The packet access pattern

After a little bit reading of the bpf verifier, I found that bpf
packet access instructions should follow a pattern similar to
`#13-#16` in the above assembly code:

```x
      13: 	r3 = r1			      ; r1 is skb->data + x
      14: 	r3 += 34
      15: 	if r3 > r2 goto +27 <LBB0_6>  ; if (data + tot_len > data_end)
      16: 	r8 = *(u8 *)(r1 + 14)         ; r8 = ip4->ihl
```

`r1` could be a pointer to any location into the packet.  `r2` is
`skb->data_end`.

In the previous faulty code, the instructions for the second packet
access does not follow this pattern.  So the verifier rejected the
program.

Here's how the verifier works with this pattern.

Each bpf register's state (`struct bpf_reg_state`) contains a `range`
field that specifies the maximum relative offset for packet access.
For example, in the above pattern, instruction `#16` reads one byte
from the packet at location `r1` plus relative offset 14.  The
verifier checks if `offset + size = 14 + 1 <= r1.range` in function
`check_packet_access()`.

The `range` value is decided at the branch instructions from `#13` to
`#15`:

  - `#13` assigns `r1` to `r3` (the `type` and `id` fields of `struct
    bpf_reg_state`)

  - `#14` assigns 34 to `off` field of `r3`

  - `#15` sets ranges of `r1` and `r3` to `r3`'s `off` field (in
    function `find_good_pkt_pointers()`)

The [comments] in function `find_good_pkt_pointers()` also explain
this access pattern.

## The workaround

We could improve the bpf verifier to make it more flexible.  On the
other hand, we could write C code in a certain way to make the
compiler generate the desired instructions.

The following is the valid [code](demo_good.c) that I came up with:

```c
#define ensure_header(skb, var_off, const_off, hdr)		\
({								\
	u32 len = const_off + sizeof(*hdr);			\
	void *data = (void *)(long)skb->data + var_off;		\
	void *data_end = (void *)(long)skb->data_end;		\
								\
	if (data + len > data_end)				\
		bpf_skb_pull_data(skb, var_off + len);		\
								\
	data = (void *)(long)skb->data + var_off;		\
	data_end = (void *)(long)skb->data_end;			\
	if (data + len > data_end)				\
		return TC_ACT_OK;				\
								\
	hdr = (void *)(data + const_off);			\
})

__attribute__((section("main")))
int handle_skb(struct sk_buff *skb)
{
	u32 hdrlen, var_off, const_off;
	struct iphdr *ip4;
	struct tcphdr *tcp;
	char fmt[] = "%d\n";

	var_off = 0;
	const_off = ETH_HLEN;
	ensure_header(skb, var_off, const_off, ip4);

	hdrlen = ipv4_hdrlen(ip4);
	if (hdrlen < sizeof(*ip4))
		return TC_ACT_OK;

	var_off += hdrlen;
	ensure_header(skb, var_off, const_off, tcp);

	hdrlen = tcp_hdrlen(tcp);
	bpf_trace_printk(fmt, 4, hdrlen);

	return TC_ACT_OK;
}
```

## Source code

- [demo_common.h](demo_common.h)
- [demo_bad.c](demo_bad.c)
- [demo_good.c](demo_good.c)

[comments]: https://github.com/torvalds/linux/blob/9cf6b756cdf2cd38b8b0dac2567f7c6daf5e79d5/kernel/bpf/verifier.c#L5120-L5160
