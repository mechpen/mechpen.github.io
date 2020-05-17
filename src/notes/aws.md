---
title: AWS
list: true

---

## load balancers

- **Classic TCP ELB** works like TCP proxy.  It creates 2 back to back
  TCP connections for a client connection: one from the client to ELB,
  the other from ELB to a server instance.  ELB security groups need
  to allow incoming traffic from public internet, and instance
  security groups need to allow incoming traffic from ELB.

- **NLB** works like NAT.  It keeps a client connection without
  changing source IP, ports, and sequence numbers.  NLB does not have
  security group.  The instance security group need to allow incoming
  traffic from public internet.

## aws cli

who am i:

```text
aws sts get-caller-identity
```
