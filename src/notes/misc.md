---
title: misc
list: false

---

DNS should be pingable for network monitoring.

NAT

When there’s no free port available, the packet could be dropped.

does not exist is not error, and vice vesa

- istio cert

- calico controller

- cloud custodian

Tmux: save pane to file

  $ tmux capture-pane -b temp-capture-buffer -S -
  $ tmux save-buffer -b temp-capture-buffer ~/tmux.log
  $ tmux delete-buffer -b capture-buffer
