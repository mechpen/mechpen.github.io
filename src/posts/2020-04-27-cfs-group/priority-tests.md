---
title: CFS process priority tests
list: false
---

## Setup

OS: ubuntu 19.10

Machine: qemu-kvm

Make sure to disable the autogroup feature, which is enabled by
default.  The autogroup automatically creates a CPU control group for
each new session.  The scheduling effect of process priority is
overridden by the effect of its group weights.

Run the following command to disable autogroup:

```text
root@emu:~# echo 0 > /proc/sys/kernel/sched_autogroup_enabled
```

The test script is at [genload.py](../loadtest/genload.py)

## Test 1

In the 1st terminal:

```text
root@emu:~# python3 genload.py 
...
[02:03:07] count 1,892,493 pcpu 73(73) exec_time 491(491)
... (renice 2nd process)
[02:03:08] count 2,165,950 pcpu 72(72) exec_time 538(538)
[02:03:09] count 2,071,702 pcpu 72(72) exec_time 548(548)
[02:03:10] count 2,060,509 pcpu 72(72) exec_time 547(547)
```

In the 2nd terminal:

```text
root@emu:~# python3 genload.py 
...
[02:03:07] count 1,921,506 pcpu 49(49) exec_time 490(490)
... (renice +1)
[02:03:08] count 1,832,973 pcpu 49(49) exec_time 446(446)
[02:03:09] count 1,676,413 pcpu 49(49) exec_time 439(439)
[02:03:10] count 1,682,007 pcpu 48(48) exec_time 442(442)
```

## Test 2

In the 1st terminal:

```text
root@emu:~# python3 genload.py 
...
[02:34:18] count 951,643 pcpu 73(73) exec_time 248(248)
[02:34:19] count 1,006,798 pcpu 71(71) exec_time 237(237)
(renice +1)
[02:34:20] count 807,376 pcpu 70(70) exec_time 203(203)
[02:34:21] count 869,612 pcpu 68(68) exec_time 206(206)
```
In the other 3 terminals:

```text
root@emu:~# python3 genload.py
...
[02:34:18] count 974,679 pcpu 22(22) exec_time 247(247)
[02:34:19] count 943,301 pcpu 23(23) exec_time 242(242)
(renice 1st process)
[02:34:20] count 1,016,265 pcpu 23(23) exec_time 259(259)
[02:34:21] count 1,025,985 pcpu 23(23) exec_time 258(258)
```
