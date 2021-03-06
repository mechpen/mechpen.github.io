---
title: resolv.conf for nameservers with a virtual IP
tags: [dns]
list: true
excerpt:

  The file <code>/etc/resolv.conf</code> defines nameservers for
  glibc.  Normally this file contains 2 or 3 nameservers for
  redundancy.  When several nameservers serve behind one virtual IP,
  it is still better to have multiple (max 3) duplicated entries than
  having just one virtual IP entry in <code>/etc/resolv.conf</code>.

---

The following tests show the difference between 1 entry and 3 entries
in `resolv.conf`.  The setup uses a fake nameserver `10.10.10.10` that
does not exist.

## single entry

```text
$ time curl google.com
curl: (6) Could not resolve host: google.com

real    0m10.124s
user    0m0.025s
sys     0m0.008s
```
Tcpdump:

```text
11:55:00.470327 IP 10.0.0.10.55920 > 10.10.10.10.53: 62314+ A? google.com. (28)
11:55:05.476349 IP 10.0.0.10.55920 > 10.10.10.10.53: 62314+ A? google.com. (28)
```

## 3 dup entries

```text
$ time curl google.com
curl: (6) Could not resolve host: google.com

real    0m28.193s
user    0m0.033s
sys     0m0.018s
```
Tcpdump:

```text
11:52:38.865095 IP 10.0.0.10.53712 > 10.10.10.10.53: 21617+ A? google.com. (28)
11:52:43.871066 IP 10.0.0.10.58702 > 10.10.10.10.53: 21617+ A? google.com. (28)
11:52:46.875065 IP 10.0.0.10.51804 > 10.10.10.10.53: 21617+ A? google.com. (28)
11:52:52.882092 IP 10.0.0.10.53712 > 10.10.10.10.53: 21617+ A? google.com. (28)
11:52:57.888033 IP 10.0.0.10.58702 > 10.10.10.10.53: 21617+ A? google.com. (28)
11:53:00.892013 IP 10.0.0.10.51804 > 10.10.10.10.53: 21617+ A? google.com. (28)
```

The tests show that:

  1. The glibc lookup function sends a DNS query to a nameserver,
     waits for 5 seconds, then sends another query to the next
     nameserver.

  2. The lookup function iterates all entries twice before giving up.

  3. The lookup function uses different source ports for different
     nameserver entries,

Load balancers normally route packets based on addresses and ports.
Using multiple identical entries diversifies source ports, which in
turn diversifies the actual nameservers for a single lookup.  So it's
better to have the following in `resolv.conf`:

```text
nameserver 10.10.10.10
nameserver 10.10.10.10
nameserver 10.10.10.10
```

## set different timeout and retries

*Updated at [May/09/2020]*

Use the following options to change the default timeout and retries.
More details at [man
resolv.conf](http://man7.org/linux/man-pages/man5/resolv.conf.5.html).

```text
options timeout:1
options retries:5
```

These options should be used if the DNS servers are just a few hops
away, such that if no response is received within 1 second, the
request or response packet must be lost.
