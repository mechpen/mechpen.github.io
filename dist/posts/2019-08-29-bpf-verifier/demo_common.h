#ifndef _DEMO_COMMON_H
#define _DEMO_COMMON_H

typedef unsigned char	u8;
typedef unsigned short	u16;
typedef unsigned int	u32;

#define ETH_HLEN	14
#define TC_ACT_OK	0

struct iphdr {
	u8	ihl:4,
		version:4;
	u8	tos;
	u16	tot_len;
	u16	id;
	u16	frag_off;
	u8	ttl;
	u8	protocol;
	u16	check;
	u32	saddr;
	u32	daddr;
};

struct tcphdr {
	u16	source;
	u16	dest;
	u32	seq;
	u32	ack_seq;
	u8	res1:4,
		doff:4;
	u8	flags;
	u16	window;
	u16	check;
	u16	urg_ptr;
};

static inline int ipv4_hdrlen(struct iphdr *ip4)
{
	return ip4->ihl * 4;
}

static inline int tcp_hdrlen(struct tcphdr *tcp)
{
	return tcp->doff * 4;
}

struct sk_buff {
	u32 len;
	u32 pkt_type;
	u32 mark;
	u32 queue_mapping;
	u32 protocol;
	u32 vlan_present;
	u32 vlan_tci;
	u32 vlan_proto;
	u32 priority;
	u32 ingress_ifindex;
	u32 ifindex;
	u32 tc_index;
	u32 cb[5];
	u32 hash;
	u32 tc_classid;
	u32 data;
	u32 data_end;
	u32 napi_id;
};

static int (*bpf_trace_printk)(const char *fmt, u32 fmt_size, ...) =
    (void *) 6;

static int (*bpf_skb_pull_data)(struct sk_buff *skb, u32 len) =
    (void *) 39;

__attribute__((section("license")))
char __license[] = "GPL";

#endif
