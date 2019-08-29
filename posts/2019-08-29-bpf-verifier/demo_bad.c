// compile with: clang -O2 -Wall -target bpf -c demo_bad.c -o demo_bad.o

#include "demo_common.h"

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
