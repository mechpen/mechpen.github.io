import os
import time
import subprocess
import multiprocessing as mp

def epoch2str(epoch):
    return time.strftime('%H:%M:%S', time.localtime(epoch))

def load(period, q):
    count = 0
    last_bucket = int(time.time()) // period

    try:
        while True:
            count += 1
            bucket = int(time.time()) // period
            if bucket > last_bucket:
                q.put((bucket*period, count))
                count = 0
                last_bucket = bucket
    except KeyboardInterrupt:
        pass

def format_vals(vals):
    return '%d(%s)' % (sum(vals), '+'.join(str(x) for x in vals))

def get_pcpu(pids):
    pids_arg = ','.join(str(x) for x in pids)
    cmd = 'ps -o pcpu --no-headers --pid %s' % pids_arg
    output = subprocess.check_output(cmd.split(), universal_newlines=True)

    pcpu_list = [int(float(x)) for x in output.splitlines()]
    return 'pcpu ' + format_vals(pcpu_list)

exec_times = dict()

def get_sched_info(pids):
    pids = [str(x) for x in pids]
    exec_deltas = []
    with open('/proc/sched_debug') as f:
        for line in f:
            fields = line.split()
            if len(fields) >= 9 and fields[2] in pids:
                pid = fields[2]
                exec_time = int(float(fields[7]))
                delta = exec_time - exec_times.get(pid, 0)
                exec_times[pid] = exec_time
                exec_deltas.append(delta)
    return 'exec_time ' + format_vals(exec_deltas)

def print_info(ts, counts, pids):
    info = [
        '[%s]' % epoch2str(ts),
        'count %s' % format(sum(counts), ','),
        get_pcpu(pids),
        get_sched_info(pids),
    ]
    print(' '.join(info))

def gen_load(args):
    q = mp.Queue()
    pids = []
    for _ in range(args.nprocs):
        p = mp.Process(target=load, args=(args.period, q))
        p.start()
        pids.append(p.pid)

    last_ts = 0
    counts = []
    while True:
        (ts, count) = q.get()
        if ts != last_ts and len(counts) > 0:
            print("[%s] skipped" % epoch2str(last_ts))
            last_ts = ts
            counts = []

        last_ts = ts
        counts.append(count)

        if len(counts) == args.nprocs:
            print_info(last_ts, counts, pids)
            counts = []

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument('--nprocs', type=int, default='1')
    parser.add_argument('--period', type=int, default='1')
    args = parser.parse_args()

    try:
        gen_load(args)
    except KeyboardInterrupt:
        pass
