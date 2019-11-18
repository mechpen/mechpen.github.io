import sys
import time
import socket

IP_RECVERR = 11

s = socket.socket()
s.setsockopt(socket.SOL_IP, IP_RECVERR, 1)
s.connect((sys.argv[1], 7890))
while True:
    s.send(b'a')
    print('.')
    time.sleep(5)
