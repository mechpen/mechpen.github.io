import sys
import time
import socket

s = socket.socket()
s.setsockopt(socket.IPPROTO_TCP, socket.SO_KEEPALIVE, 1)
s.connect((sys.argv[1], 7890))
while True:
    data = s.recv(100)
    print(">>>", data)
    time.sleep(1)
