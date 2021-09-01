## boot logo disappear during boot

Cause by mode vga mode change.  Kernel message:

```
$ dmesg | grep vga
[    0.454837] pci 0000:00:02.0: vgaarb: setting as boot VGA device
[    0.454837] pci 0000:00:02.0: vgaarb: VGA device added: decodes=io+mem,owns=io+mem,locks=none
[    0.454837] pci 0000:00:02.0: vgaarb: bridge control possible
[    0.454837] vgaarb: loaded
[    0.528910] i915 0000:00:02.0: vgaarb: deactivate vga console
[    0.542412] i915 0000:00:02.0: vgaarb: changed VGA decodes: olddecodes=io+mem,decodes=io+mem:owns=io+mem
[   17.555855] vga_switcheroo: enabled
```

Solution: compile vga driver as builtin.

Also set `TTYVTDisallocate=no` and etc in systemd `getty@tty1.service`.

## does not show boot messages except boot logo

Solution: need to set

```
# Enable legacy fbdev support for your modesetting driver
CONFIG_DRM_FBDEV_EMULATION=y
```

## boot logo flash in early boot

Solution: may need to disable the following

```
CONFIG_FB_MODE_HELPERS=n
CONFIG_FB_SIMPLE=n

```
