// compile with: clang -O2 -Wall -target bpf -c demo_good.c -o demo_good.o

#include "demo_common.h"

/*
 * 2 things are done here to make the verifier happy:
 *
 *   - split offset into var_off and const_off
 *   - perform the 2nd check regardless of the 1st check
 */
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
