#!/bin/bash

peer=localhost
sport=3000
dport=4002
isn=1

set -x

# first connection

seq=$(hping -s $sport -p $dport -M $isn -S -c 1 -Q $peer 2>/dev/null | awk 'NR==2{print $1}')
echo $seq

echo "abc" | hping -s $sport -p $dport -M $(expr $isn + 1) -L $(expr $seq + 1) -A -c 1 -Q $peer -d 3 -E /dev/stdin

# second connection

hping -s $sport -p $dport -M $isn -S -c 1 -Q $peer 2

echo "xyzxyz" | hping -s $sport -p $dport -M $(expr $isn + 1) -L $(expr $seq + 1) -A -c 1 -Q $peer -d 6 -E /dev/stdin
