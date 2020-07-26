---
title: Kubernetes CPU requests explained
list: true
excerpt: |

  Requesting CPU resource in a pod spec does not guarantee the
  requested CPU for a container.  The only way to guarantee this is to
  use "static CPU manager policy" and exclusively allocate CPUs to the
  container.

---

## 1. How CPU requests work

In kubernetes, a pod container specifies CPU resources as follows:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: foo
spec:
  containers:
  - name: foo
    image: mechpen/toolbox
    resources:
      limits:
        cpu: "1"
      requests:
        cpu: "1"
```

The CPU unit 1 means the 100% time of one CPU, as shown in the `top`
command.

The CPU limit is enforced by CFS scheduler quota, by which processes
of a container are throttled when the container CPU time reaches the
limit.

The CPU request is implemented using `cpu` control group's
`cpu.shares`.  This [post](/posts/2020-04-27-cfs-group/index.html) has
more details on CFS and `cpu.shares`.

In kubernetes, one CPU provides 1024 shares.  For example, if a node
has 8 allocatable CPU, then the total number of CPU shares is
1024*8=8192 as shown below:

```text
# cat /sys/fs/cgroup/cpu/kubepods/cpu.shares
8192
```

The container's `cpu.shares` is allocated from the total shares
according to this CPU requests in the pod manifest.  For example, in
the above example, container "foo" requests 1 CPU and has shares
value "1024":

```text
# cat /sys/fs/cgroup/cpu/kubepods/<pod_foo>/<container_foo>/cpu.shares
1024
```
## 2. Why CPU request does not work

The above implementation may seem good enough to ensure CPU times for
containers: according to this [CFS
equation](https://mechpen.github.io/posts/2020-04-27-cfs-group/index.html#1.-cfs-concepts),
each container's CPU time is proportional to its scheduling weight.
Container "foo" gets 1/8 of the total 8 CPU share, so it gets 1 CPU
out of the total 8 CPUs.

However, in SMP systems, `cpu.shares` does not equal to CFS weight as
explained in [this
post](https://mechpen.github.io/posts/2020-04-27-cfs-group/index.html#3.-task-groups).
For example, 2 containers, both requesting 1 CPU, could be scheduled
on the same CPU.  Each container only gets 50% CPU at most.

## 3. How static CPU manager policy work

Kubernetes provides a [static CPU manager
policy](https://kubernetes.io/docs/tasks/administer-cluster/cpu-management-policies/#static-policy)
that can "exclusively" allocate CPUs to a container by using the
`cpuset` cgroup.

For example, if CPU 1 is assigned to container "foo".  Then we have:

```text
# cat /sys/fs/cgroup/cpuset/kubepods/<pod_foo>/<container_foo>/cpuset.cpus
1
```

For any other pod container, we have:

```text
# cat /sys/fs/cgroup/cpuset/kubepods/<pod_bar>/<container_bar>/cpuset.cpus
0,2-7
```

Thus processes in the other containers are not scheduled on CPU 1.

## 4. Customize `kubepods` cgroup

The above discussions are within the `kubepods` cgroups.  The system
processes are not under the `kubepods` cgroup and not controlled by
the above rules.  For example, a user could ssh to the node and run a
process on CPU 1, even the CPU is "exclusively" allocated to container
"foo" in kubernetes.

The problem can be solved by pre-defining `kubepods` cgroups to
allocate exclusive CPUs for kubernetes pods, then passing the
customized `kubepods` cgroup to `kubelet` via the `--cgroup-root`
option. (I didn't try this out.)

## 5. Extra

I wrote a tool [`tgtop`](https://github.com/mechpen/tgtop) to help
observe the above CPU usage behaviors.
