import time
import socket

s = socket.socket()
s.setsockopt(socket.IPPROTO_TCP, socket.SO_KEEPALIVE, 1)
s.bind(('0.0.0.0', 7890))
s.listen(0)
time.sleep(300)
