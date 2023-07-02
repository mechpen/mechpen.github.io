# first run the server:
#
#   socat tcp-listen:8080,fork -

import time
import socket

sockets = []
while True:
    sockets.append(socket.socket())
    sockets[-1].connect(('127.0.0.1', 8080))
    print(sockets[-1].getsockname())
    time.sleep(1)

    if len(sockets) == 7:
        input("press enter to clear fds >")
        sockets = []
        print("cleared")
        input("press enter to create fds >")
