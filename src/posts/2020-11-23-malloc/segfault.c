/* segfault on free example, glibc-2.32

  $ gcc segfault.c
  $ ./a.out
  freeing p[9]
  freeing p[8]
  freeing p[7]
  freeing p[6]
  freeing p[5]
  freeing p[4]
  freeing p[3]
  freeing p[2]
  freeing p[1]
  Segmentation fault
*/

#include <stdio.h>
#include <stdlib.h>
#include <malloc.h>

#define S_TCACHE 10

int main()
{
	long *p[S_TCACHE];
	int i;

	if (mallopt(M_MXFAST, 0) != 1)
		printf("mallopt error\n");

	for (i = 0; i < S_TCACHE; i++) {
		p[i] = malloc(8);
	}

	for (i = S_TCACHE - 1; i >= 0; i--) {
		printf("freeing p[%d]\n", i);
		free(p[i]);
		*p[i] = 0;
	}

	return 0;
}
