// compile with: clang -O2 -Wall -target bpf -c demo_bad.c -o demo_bad.o

#include "demo_common.h"

__attribute__((section("main")))
int handle_skb(struct sk_buff *skb)
{
	u32 hdrlen;
	struct iphdr *ip4;
	char fmt[] = "%d\n";

	void *data = (void *)(long)skb->data;
	ip4 = (void *)(data + ETH_HLEN);

	hdrlen = ipv4_hdrlen(ip4);
	bpf_trace_printk(fmt, 4, hdrlen);

	return TC_ACT_OK;
}
