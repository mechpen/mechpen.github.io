---
title: Networking
list: true

---

## TCP failure modes

All these failure modes are from the kernel network stack, and has
nothing to do with userspace applications.

  - `Connection timeout` could happen when the `SYN` or `SYN-ACK`
    packets are dropped.  The timeout period could be tweaked with
    `/proc/sys/net/ipv4/tcp_syn_retries`.

  - `Connection reject/reset` when `RST` is received.  A remote peer
    replies `RST` if its port is not open.

  - ICMP host unreachable. (??? what error is returned to user ???)

  - ICMP unreachable need frag: PMTU discovery.

  - After connection is established, TCP keep-alive timeout is very
    long (a few hours).  So if a remote peer goes away without sending
    FIN, it could take a very long time for the local host to
    interrupt the TCP session.  For long lasting connections, the
    applications should always ping remote periodically.

### Conntrack states (??? verify ???):

  'NEW' -> 'NEW'

  'ACK' -> 'ESTABLISHED'

  'FIN/RST' -> 'INVALID' and delete entry

### Examples:

## UDP failure modes

  - ICMP port unreachable -- `connection reject`

  - ICMP host unreachable (???)
