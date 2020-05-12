from bcc import BPF

text = '''
#include <linux/sched.h>
#include "sched.h"

BPF_PERCPU_ARRAY(task_array, struct task_struct *, 1);

int kprobe_task_fork_fair(struct pt_regs *ctx)
{
    int i = 0;
    struct task_struct *task = (struct task_struct *)PT_REGS_PARM1(ctx);

    if (task == NULL)
        return 0;
/*
    bpf_trace_printk(
        "WH: enter rq %x task vruntime %ld\\n",
        task->se.cfs_rq,
        task->se.vruntime
    );
*/
    task_array.update(&i, &task);

    return 0;
}

int kretprobe_task_fork_fair(struct pt_regs *ctx)
{
    int i = 0;
    struct task_struct *task, **ptask = task_array.lookup(&i);
	struct cfs_rq *cfs_rq;

    if (ptask == NULL)
        return 0;
    task = *ptask;
    if (task == NULL)
        return 0;
    cfs_rq = task->se.cfs_rq;
    if (cfs_rq == NULL)
        return 0;
    bpf_trace_printk(
        "WH: return task load weight %ld\\n",
        task->se.load.weight
    );

    return 0;
}
'''

b = BPF(text=text, cflags=["-I/usr/src/linux/kernel/sched"])
b.attach_kprobe(event='task_fork_fair', fn_name='kprobe_task_fork_fair')
b.attach_kretprobe(event='task_fork_fair', fn_name='kretprobe_task_fork_fair')
b.trace_print()
