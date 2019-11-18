import sys
import time
import socket

s = socket.socket(type=socket.SOCK_DGRAM)
while True:
    s.sendto(b'a', (sys.argv[1], 7890))
    print('.')
    time.sleep(5)
