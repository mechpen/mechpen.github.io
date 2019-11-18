import sys
import time
import socket

s = socket.socket(type=socket.SOCK_DGRAM)
s.connect((sys.argv[1], 7890))
while True:
    s.send(b'a')
    print('.')
    time.sleep(5)
