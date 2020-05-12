#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <unistd.h>
#include <time.h>

#define fatal(msg) \
	do { perror(msg); exit(2); } while (0)

static void usage(void)
{
	fprintf(stderr,
		"Usage: bank [ -t nthreads ] [ -p period ] [ -n name ]\n"
		"    -t  number of concurret threads, default is 1\n"
		"    -p  period to report stats\n"
		"    -n  name\n"
	);
	exit(1);
}

struct thread_info {
	pthread_t tid;
	int period;
	int nthreads;
	char *name;
};

static void* load(void *arg)
{
	struct thread_info *tinfo = arg;
	long count = 0, last_bucket;
	pid_t pid = getpid();
	time_t now;

	now = time(NULL);
	if (now == -1)
		fatal("time");
	last_bucket = now / tinfo->period;

	for (;;) {
		long bucket;

		count++;
		now = time(NULL);
		if (now == -1)
			fatal("time");
		bucket = now / tinfo->period;
		if (bucket > last_bucket) {
			printf("%s %d %d %d %ld %ld %ld\n",
				tinfo->name,
				tinfo->nthreads,
				tinfo->period,
				pid,
				now,
				tinfo->tid,
				count
			);
			fflush(stdout);
			count = 0;
			last_bucket = bucket;
		}
	}
}

int main(int argc, char *argv[])
{
	int i, ret;
	int nthreads = 1;
	int period = 1;
	struct thread_info *tinfo;
	char *name = "none";

	while ((i = getopt(argc, argv, "t:p:n:")) != -1) {
		switch (i) {
		case 't':
			nthreads = atoi(optarg);
			break;
		case 'p':
			period = atoi(optarg);
			break;
		case 'n':
			name = optarg;
			break;
		default:
			usage();
		}
	}
	if (argc != optind)
		usage();


	tinfo = calloc(nthreads, sizeof(struct thread_info));
	if (tinfo == NULL)
		fatal("calloc");

	for (i = 0; i < nthreads; i++) {
		tinfo[i].period = period;
		tinfo[i].nthreads = nthreads;;
		tinfo[i].name = name;
		ret = pthread_create(&tinfo[i].tid, NULL, load, &tinfo[i]);
		if (ret != 0)
			fatal("pthread_create");
	}

	for (i = 0; i < nthreads; i++) {
		ret = pthread_join(tinfo[i].tid, NULL);
		if (ret != 0)
			fatal("pthread_join");
	}

	free(tinfo);
	return 0;
}
