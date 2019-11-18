import os
import sys
import time
import socket

s = socket.socket()
s.setsockopt(socket.IPPROTO_TCP, socket.SO_KEEPALIVE, 1)
s.connect((sys.argv[1], 7890))
while True:
    fn = s.fileno()
    os.write(fn, b'a')
    print('.')
    time.sleep(5)
