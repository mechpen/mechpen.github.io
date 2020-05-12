from bcc import BPF

text = '''
#include <linux/sched.h>

int pick_next_task_fair(struct pt_regs *ctx)
{
    struct task_struct *task = (struct task_struct *)PT_REGS_PARM2(ctx);

	if (task == NULL) {
		bpf_trace_printk("task is null\\n");
		return 0;
	}
	bpf_trace_printk("on_rq = %d\\n", task->se.on_rq);
	return 0;
}
'''
b = BPF(text=text)
b.attach_kprobe(event='pick_next_task_fair', fn_name='pick_next_task_fair')
b.trace_print()
