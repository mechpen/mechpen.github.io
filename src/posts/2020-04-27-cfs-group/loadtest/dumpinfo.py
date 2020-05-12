import sys
import time
import subprocess
from collections import defaultdict

def epoch2str(epoch):
    return time.strftime('%H:%M:%S', time.localtime(epoch))

def get_pcpu(pids):
    pids_arg = ','.join(str(x) for x in pids)
    cmd = 'ps -o pcpu --no-headers --pid %s' % pids_arg
    output = subprocess.check_output(cmd.split(), universal_newlines=True)
    return [int(float(x)) for x in output.splitlines()]

def print_info():
    info = defaultdict(list)

    for line in sys.stdin:
        (name, nthreads, period, pid, ts, tid, count) = line.split()
        (nthreads, period, pid, ts, tid, count) = (int(x) for x in (
            nthreads, period, pid, ts, tid, count))

        items = info[pid]

        for item in items[:]:
            (ts1, _, _) = item
            if ts1 != ts:
                items.remove(item)

        items.append((ts, tid, count))

        if len(items) == nthreads:
            info[pid] = []

            count = sum(x[2] for x in items)
            dump = [
                '[%s]' % epoch2str(ts),
                name,
                'count %s' % format(count, ','),
#                get_pcpu([pid]),
            ]
            print(' '.join(dump), flush=True)

if __name__ == '__main__':
    try:
        print_info()
    except KeyboardInterrupt:
        pass
