# NVIDIA GPU Passthrough for LXC Containers on Proxmox

Complete guide for setting up NVIDIA GPU passthrough from Proxmox host to LXC containers.

## Overview

This guide covers two main scenarios:
1. **LXC Container GPU Passthrough** - Share GPU with containers for CUDA/ML workloads
2. **VM GPU Passthrough** - Complete GPU passthrough to VMs (VFIO)

**For LXC containers**, we use the scripts in this directory.

## Quick Start

### Automated Setup

```bash
# 1. Install/fix NVIDIA drivers on Proxmox host
sudo ./fix-nvidia-drivers.sh

# 2. Configure LXC container for GPU passthrough
sudo ./setup-nvidia-lxc-passthrough.sh [container-id]

# 3. Enter container and install drivers
pct enter [container-id]
apt-get update
apt-get install -y nvidia-driver

# 4. Test
nvidia-smi
```

## Available Scripts

### 1. `fix-nvidia-drivers.sh`

Uninstalls and reinstalls NVIDIA drivers on the Proxmox host.

**Use cases:**
- Fresh NVIDIA driver installation
- Fix broken/corrupted driver
- Upgrade/downgrade driver version
- Clean reinstall after kernel update

**Usage:**
```bash
# Install latest driver
sudo ./fix-nvidia-drivers.sh

# Install specific version
sudo ./fix-nvidia-drivers.sh 535
```

### 1b. `fix-nvidia-kernel-module.sh` ⭐ NEW

**USE THIS if you get "Unable to load kernel module 'nvidia.ko'" error!**

Fixes common NVIDIA kernel module loading errors caused by:
- Nouveau driver conflicts
- Missing/mismatched kernel headers
- UEFI Secure Boot blocking unsigned modules
- Kernel/driver version mismatches

**Usage:**
```bash
sudo ./fix-nvidia-kernel-module.sh
```

**What it does:**
1. Checks for and removes nouveau driver conflict
2. Verifies/installs correct kernel headers
3. Checks UEFI Secure Boot status
4. Completely removes old NVIDIA installation
5. Blacklists nouveau permanently
6. Installs NVIDIA driver with DKMS
7. Updates initramfs
8. Loads NVIDIA modules
9. Tests with nvidia-smi

**This is the recommended first step if nvidia-smi fails!**

### 2. `setup-nvidia-lxc-passthrough.sh`

Configures NVIDIA GPU passthrough for LXC containers.

**Use cases:**
- Enable GPU access in LXC container
- Machine learning workloads in containers
- CUDA development in containers
- GPU-accelerated applications

**Usage:**
```bash
# Configure container 100 for GPU passthrough
sudo ./setup-nvidia-lxc-passthrough.sh 100

# List available containers
pct list
```

**What it does:**
1. Detects NVIDIA GPU on host
2. Checks/installs NVIDIA driver on host
3. Gets GPU device information
4. Configures LXC container with device passthrough
5. Adds required cgroup permissions
6. Mounts NVIDIA devices into container
7. Provides instructions for container-side setup

## Detailed Setup Guide

### Prerequisites

1. **NVIDIA GPU** installed in Proxmox server
2. **Proxmox VE** 7.x or 8.x
3. **LXC container** created (can be privileged or unprivileged)
4. **Root access** to Proxmox host

### Step-by-Step: LXC GPU Passthrough

#### Part 1: Proxmox Host Setup

```bash
# 1. Check if GPU is detected
lspci | grep -i nvidia

# Example output:
# 01:00.0 VGA compatible controller: NVIDIA Corporation Device 2204 (rev a1)
# 01:00.1 Audio device: NVIDIA Corporation Device 1aef (rev a1)

# 2. Install NVIDIA drivers on host
cd /root  # or wherever you put the scripts
chmod +x fix-nvidia-drivers.sh
sudo ./fix-nvidia-drivers.sh

# 3. Verify driver installation
nvidia-smi

# You should see output showing GPU info and driver version
```

#### Part 2: Container Configuration

```bash
# 1. Note your container ID
pct list

# Example output:
# VMID       Status     Lock         Name
# 100        running                 my-ml-container

# 2. Configure container for GPU passthrough
sudo ./setup-nvidia-lxc-passthrough.sh 100

# 3. Restart container if it was running
pct shutdown 100
pct start 100
```

#### Part 3: Inside the Container

```bash
# 1. Enter the container
pct enter 100

# 2. Update package lists
apt-get update

# 3. Add non-free repository (required for NVIDIA drivers)
echo 'deb http://deb.debian.org/debian bookworm main contrib non-free non-free-firmware' > /etc/apt/sources.list.d/debian-non-free.list
apt-get update

# 4. Install NVIDIA driver (MUST match host version!)
# If host has driver 535.x, install 535 in container:
apt-get install -y nvidia-driver-535 firmware-misc-nonfree

# Or install latest:
apt-get install -y nvidia-driver firmware-misc-nonfree

# 5. Verify GPU access
nvidia-smi

# You should see the same GPU info as on the host!
```

## Architecture Diagrams

### LXC GPU Passthrough Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Proxmox Host (PVE)                       │
│                                                             │
│  ┌──────────────────────┐      ┌──────────────────────┐   │
│  │  NVIDIA Driver       │      │  NVIDIA Kernel       │   │
│  │  (e.g., 535.x)       │◄────►│  Modules (nvidia.ko) │   │
│  └──────────────────────┘      └──────────────────────┘   │
│              ▲                           ▲                  │
│              │                           │                  │
│  ┌───────────┴───────────────────────────┴────────────┐   │
│  │               GPU Device Files                      │   │
│  │  /dev/nvidia0, /dev/nvidiactl, /dev/nvidia-uvm     │   │
│  └───────────────────┬─────────────────────────────────┘   │
│                      │ (bind mount)                         │
│  ┌───────────────────▼─────────────────────────────────┐   │
│  │           LXC Container (CT 100)                     │   │
│  │                                                      │   │
│  │  ┌──────────────────────┐                           │   │
│  │  │  NVIDIA Driver       │                           │   │
│  │  │  (same version!)     │                           │   │
│  │  └──────────────────────┘                           │   │
│  │              │                                       │   │
│  │  ┌───────────▼───────────┐                          │   │
│  │  │   Your Application    │                          │   │
│  │  │  (CUDA, ML, etc.)     │                          │   │
│  │  └───────────────────────┘                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Configuration Flow

```
Proxmox Host                          LXC Container
─────────────                          ─────────────

GPU Hardware
     │
     ▼
NVIDIA Kernel Driver ─────────────┐
     │                             │
     ▼                             │
/dev/nvidia* devices              │
     │                             │
     │                             │   (bind mount via
     │                             │    LXC config)
     └─────────────────────────────┼───────────────►  /dev/nvidia*
                                   │                       │
                                   │                       ▼
                                   │              NVIDIA Userspace
                                   │              Driver (same version)
                                   │                       │
                                   │                       ▼
                                   │              Application/CUDA
                                   │
                     lxc.cgroup2.devices.allow: c 195:*
                     lxc.mount.entry: /dev/nvidia0...
```

## Understanding the Configuration

### What Gets Added to Container Config

When you run `setup-nvidia-lxc-passthrough.sh`, this gets added to `/etc/pve/lxc/[ID].conf`:

```bash
# Allow access to NVIDIA devices (cgroup permissions)
lxc.cgroup2.devices.allow: c 195:* rwm    # NVIDIA devices (195 = nvidia major number)
lxc.cgroup2.devices.allow: c 509:* rwm    # NVIDIA UVM devices

# Mount NVIDIA devices from host to container
lxc.mount.entry: /dev/nvidia0 dev/nvidia0 none bind,optional,create=file
lxc.mount.entry: /dev/nvidiactl dev/nvidiactl none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm dev/nvidia-uvm none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-modeset dev/nvidia-modeset none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm-tools dev/nvidia-uvm-tools none bind,optional,create=file
```

**Explanation:**
- `lxc.cgroup2.devices.allow`: Gives container permission to access device nodes
- `lxc.mount.entry`: Bind-mounts device files from host into container
- `c 195:*`: Character device with major number 195 (NVIDIA)
- `rwm`: Read, write, mknod permissions

## Common Use Cases

### 1. Machine Learning / AI Workloads

```bash
# In container with GPU passthrough
apt-get install -y python3-pip nvidia-cuda-toolkit
pip3 install torch torchvision tensorflow-gpu

# Test PyTorch GPU
python3 -c "import torch; print(torch.cuda.is_available())"

# Test TensorFlow GPU
python3 -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))"
```

### 2. Video Transcoding (FFmpeg with NVENC)

```bash
# In container
apt-get install -y ffmpeg

# Test hardware encoding
ffmpeg -hwaccel cuda -i input.mp4 -c:v h264_nvenc output.mp4
```

### 3. Ollama / LLM Hosting

```bash
# In container with GPU
curl -fsSL https://ollama.com/install.sh | sh
nvidia-smi  # Verify GPU access
ollama run llama2  # Will use GPU automatically
```

### 4. Docker in LXC with GPU

```bash
# In container
apt-get install -y docker.io

# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/libnvidia-container/gpgkey | apt-key add -
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
    tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

apt-get update
apt-get install -y nvidia-container-toolkit

# Configure Docker
nvidia-ctk runtime configure --runtime=docker
systemctl restart docker

# Test
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

## Troubleshooting

### Problem: "Unable to load kernel module 'nvidia.ko'" ⭐ MOST COMMON

**Error message:**
```
ERROR: Unable to load the kernel module 'nvidia.ko'. This happens most frequently when this
kernel module was built against the wrong or improperly configured kernel sources...
```

**Causes:**
1. Nouveau driver (open-source) is loaded and conflicting
2. Missing or mismatched kernel headers
3. UEFI Secure Boot blocking unsigned modules
4. Kernel/driver version mismatch after Proxmox update

**Solution:**
```bash
# Use the dedicated fix script (RECOMMENDED)
./fix-nvidia-kernel-module.sh

# This script will:
# - Check and remove nouveau driver
# - Verify/install correct kernel headers
# - Check Secure Boot status
# - Reinstall NVIDIA driver with DKMS
# - Blacklist nouveau permanently
# - Load modules and test

# After running, you may need to reboot
reboot

# Then verify
nvidia-smi
```

**Manual troubleshooting steps if script doesn't work:**

1. **Check if nouveau is loaded:**
```bash
lsmod | grep nouveau

# If loaded, unload it:
rmmod nouveau

# Blacklist it:
echo "blacklist nouveau" >> /etc/modprobe.d/blacklist-nvidia-nouveau.conf
echo "options nouveau modeset=0" >> /etc/modprobe.d/blacklist-nvidia-nouveau.conf
update-initramfs -u
reboot
```

2. **Check Secure Boot:**
```bash
# If this returns "1", Secure Boot is enabled (blocks NVIDIA)
od -An -t u1 /sys/firmware/efi/efivars/SecureBoot-* 2>/dev/null | awk '{print $NF}'

# Solution: Disable Secure Boot in BIOS/UEFI
```

3. **Check kernel headers:**
```bash
# Current kernel
uname -r

# Install matching headers
apt-get install pve-headers-$(uname -r)
# or
apt-get install proxmox-headers-$(uname -r)
```

4. **Reinstall driver with DKMS:**
```bash
apt-get remove --purge 'nvidia-*'
apt-get install nvidia-driver nvidia-kernel-dkms
modprobe nvidia
nvidia-smi
```

### Problem: nvidia-smi works on host but not in container

**Cause:** Driver version mismatch between host and container

**Solution:**
```bash
# On host, check driver version
nvidia-smi | grep "Driver Version"

# In container, install EXACT same version
apt-cache search nvidia-driver | grep -E "nvidia-driver-[0-9]+"
apt-get install -y nvidia-driver-XXX  # Replace XXX with host version
```

### Problem: "Failed to initialize NVML" in container

**Causes:**
1. NVIDIA kernel modules not loaded on host
2. Device files not mounted correctly
3. Driver version mismatch

**Solutions:**
```bash
# On host: Load modules
modprobe nvidia
modprobe nvidia_uvm

# Check devices exist
ls -la /dev/nvidia*

# Restart container
pct shutdown 100
pct start 100

# In container: Check devices
ls -la /dev/nvidia*
```

### Problem: "/dev/nvidia0: Permission denied"

**Cause:** Container doesn't have cgroup permission

**Solution:**
```bash
# Check container config has these lines:
grep "lxc.cgroup2.devices.allow" /etc/pve/lxc/100.conf

# If missing, re-run setup script:
sudo ./setup-nvidia-lxc-passthrough.sh 100
```

### Problem: "nvidia-smi: command not found" in container

**Cause:** NVIDIA driver not installed in container

**Solution:**
```bash
# In container
apt-get update
apt-get install -y nvidia-driver
```

### Problem: Multiple GPUs - want specific GPU in container

**Solution:**

Edit `/etc/pve/lxc/[ID].conf` manually to mount only specific GPU:

```bash
# For GPU 0 only:
lxc.mount.entry: /dev/nvidia0 dev/nvidia0 none bind,optional,create=file

# For GPU 1:
lxc.mount.entry: /dev/nvidia1 dev/nvidia1 none bind,optional,create=file
```

## Version Compatibility

### Critical Rule: Host and Container Driver MUST Match

| Host Driver | Container Driver | Result |
|-------------|------------------|---------|
| 535.129.03  | 535.129.03       | ✅ Works |
| 535.129.03  | 535.x.x          | ✅ Usually works |
| 535.129.03  | 525.x.x          | ⚠️ May work, not recommended |
| 535.129.03  | 550.x.x          | ❌ Will fail |

**Best practice:** Install the same major version (e.g., both use 535 series)

### Supported Proxmox Versions

- Proxmox VE 7.x ✅
- Proxmox VE 8.x ✅
- Proxmox VE 6.x ⚠️ (may work, but scripts are designed for 7+)

### Supported NVIDIA Drivers

- 535 series ✅ (LTS, recommended)
- 525 series ✅
- 520 series ✅
- 550+ series ✅ (latest)

## Advanced Configuration

### Unprivileged Containers

For unprivileged containers, additional ID mapping is required:

```bash
# Edit /etc/subuid and /etc/subgid
nano /etc/subuid
# Add: root:100000:65536

nano /etc/subgid
# Add: root:100000:65536

# In container config, add:
lxc.idmap: u 0 100000 65536
lxc.idmap: g 0 100000 65536
```

### Multiple GPUs

To pass multiple GPUs:

```bash
# In container config
lxc.cgroup2.devices.allow: c 195:* rwm
lxc.mount.entry: /dev/nvidia0 dev/nvidia0 none bind,optional,create=file
lxc.mount.entry: /dev/nvidia1 dev/nvidia1 none bind,optional,create=file
lxc.mount.entry: /dev/nvidiactl dev/nvidiactl none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm dev/nvidia-uvm none bind,optional,create=file
```

### GPU Sharing Between Containers

Yes! Multiple containers can share the same GPU:

```bash
# Configure each container with the same setup
./setup-nvidia-lxc-passthrough.sh 100
./setup-nvidia-lxc-passthrough.sh 101
./setup-nvidia-lxc-passthrough.sh 102

# All containers will have access to GPU(s)
# CUDA manages resource allocation automatically
```

## Performance Considerations

### LXC vs VM for GPU Workloads

| Factor | LXC Container | VM (VFIO Passthrough) |
|--------|---------------|----------------------|
| Performance | ~95-98% native | ~98-99% native |
| Overhead | Minimal | Minimal |
| Setup Complexity | Easy | Complex |
| GPU Sharing | ✅ Yes | ❌ No (1 VM only) |
| Flexibility | Medium | High |
| Use Case | AI/ML, CUDA dev | Gaming, CAD, exclusive access |

**Recommendation:** Use LXC for most CUDA/AI workloads, VMs only when you need exclusive GPU access

## Security Considerations

### Privileged vs Unprivileged Containers

**Privileged Containers:**
- ✅ Easier to configure
- ❌ Less secure (root in container = root on host)
- ✅ Best for trusted workloads

**Unprivileged Containers:**
- ✅ More secure (UID/GID mapping)
- ❌ More complex setup
- ✅ Best for multi-tenant environments

## Maintenance

### After Proxmox Kernel Update

```bash
# 1. Reboot to new kernel
reboot

# 2. NVIDIA modules won't load (compiled for old kernel)
nvidia-smi  # Will fail

# 3. Reinstall driver (recompiles for new kernel)
./fix-nvidia-drivers.sh

# 4. Restart containers
pct shutdown 100 && pct start 100
```

### Upgrading NVIDIA Driver

```bash
# On host
./fix-nvidia-drivers.sh 550  # New version

# In each container
pct enter 100
apt-get update
apt-get install -y nvidia-driver-550

# Restart container
exit
pct shutdown 100 && pct start 100
```

## Complete Example: ML Container Setup

```bash
# === PROXMOX HOST ===

# 1. Install NVIDIA driver
./fix-nvidia-drivers.sh

# 2. Create LXC container
pct create 100 local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  --hostname ml-container \
  --memory 8192 \
  --cores 4 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp

# 3. Configure GPU passthrough
./setup-nvidia-lxc-passthrough.sh 100

# 4. Start container
pct start 100

# === INSIDE CONTAINER ===

# 5. Enter container
pct enter 100

# 6. Install NVIDIA driver
apt-get update
echo 'deb http://deb.debian.org/debian bookworm main contrib non-free' > /etc/apt/sources.list.d/non-free.list
apt-get update
apt-get install -y nvidia-driver

# 7. Install ML tools
apt-get install -y python3-pip
pip3 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip3 install transformers diffusers accelerate

# 8. Test
nvidia-smi
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"

# 9. Run your ML workload
# ...
```

## References

- [Proxmox LXC Documentation](https://pve.proxmox.com/wiki/Linux_Container)
- [NVIDIA Driver Downloads](https://www.nvidia.com/Download/index.aspx)
- [CUDA Toolkit Documentation](https://docs.nvidia.com/cuda/)

## Support

If you encounter issues:

1. Check the log files in `/tmp/nvidia-*-setup-*.log`
2. Verify driver versions match between host and container
3. Ensure all required modules are loaded: `lsmod | grep nvidia`
4. Check device permissions: `ls -la /dev/nvidia*`
5. Review container config: `cat /etc/pve/lxc/[ID].conf`

## Script Locations

- Standard Fix: `scripts/fix-nvidia-drivers.sh`
- LXC Setup: `scripts/setup-nvidia-lxc-passthrough.sh`
- This Documentation: `scripts/NVIDIA_LXC_PASSTHROUGH_README.md`

**Last Updated:** 2025-11-07
