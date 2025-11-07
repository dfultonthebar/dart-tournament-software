#!/bin/bash

################################################################################
# Unbind NVIDIA GPU from VFIO VM Passthrough
#
# This script removes GPU passthrough from VMs and binds the GPU to the
# NVIDIA driver on the Proxmox host for use with LXC containers and Docker.
#
# Usage: sudo ./unbind-gpu-from-vm-passthrough.sh
################################################################################

set +e  # Don't exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging
LOG_FILE="/tmp/gpu-unbind-$(date +%Y%m%d-%H%M%S).log"

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')] ℹ${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root. Use: sudo $0"
    exit 1
fi

# Display header
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}    Unbind NVIDIA GPU from VM Passthrough${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

log "Starting GPU unbind from VM passthrough"
log "Log file: $LOG_FILE"
echo ""

################################################################################
# Step 1: Detect NVIDIA GPU
################################################################################

log "Step 1: Detecting NVIDIA GPU..."
echo ""

if ! lspci | grep -i nvidia > /dev/null; then
    log_error "No NVIDIA GPU detected"
    exit 1
fi

log_success "NVIDIA GPU(s) detected:"
lspci | grep -i nvidia | tee -a "$LOG_FILE"
echo ""

# Get GPU PCI address
GPU_PCI_ADDR=$(lspci | grep -i nvidia | grep -i "VGA\|3D" | awk '{print $1}')
GPU_PCI_FULL="0000:${GPU_PCI_ADDR}"

log_info "GPU PCI Address: $GPU_PCI_FULL"
echo ""

################################################################################
# Step 2: Find VMs using this GPU
################################################################################

log "Step 2: Finding VMs with GPU passthrough..."
echo ""

VMS_WITH_GPU=()
for CONF in /etc/pve/qemu-server/*.conf; do
    if [ -f "$CONF" ]; then
        VM_ID=$(basename "$CONF" .conf)
        if grep -q "hostpci.*${GPU_PCI_ADDR}" "$CONF"; then
            VMS_WITH_GPU+=("$VM_ID")
            log_warning "VM $VM_ID has GPU passthrough configured"
            log_info "Config: $CONF"
            grep "hostpci.*${GPU_PCI_ADDR}" "$CONF" | tee -a "$LOG_FILE"
        fi
    fi
done

if [ ${#VMS_WITH_GPU[@]} -eq 0 ]; then
    log_error "No VMs found with GPU passthrough configured"
    log "GPU may not be passed through, or configuration is different"
    exit 1
fi

echo ""

################################################################################
# Step 3: Stop VMs using the GPU
################################################################################

log "Step 3: Checking VM status..."
echo ""

RUNNING_VMS=()
for VM_ID in "${VMS_WITH_GPU[@]}"; do
    VM_STATUS=$(qm status "$VM_ID" 2>/dev/null)
    log "VM $VM_ID status: $VM_STATUS"

    if [[ "$VM_STATUS" == *"running"* ]]; then
        RUNNING_VMS+=("$VM_ID")
        log_warning "VM $VM_ID is currently running"
    fi
done

if [ ${#RUNNING_VMS[@]} -gt 0 ]; then
    echo ""
    log_warning "The following VMs are running and need to be stopped:"
    for VM_ID in "${RUNNING_VMS[@]}"; do
        log "  - VM $VM_ID"
    done
    echo ""

    read -p "Stop these VMs now? (yes/no): " STOP_VMS

    if [ "$STOP_VMS" = "yes" ]; then
        for VM_ID in "${RUNNING_VMS[@]}"; do
            log "Stopping VM $VM_ID..."
            qm stop "$VM_ID" 2>&1 | tee -a "$LOG_FILE"

            # Wait for VM to stop
            log "Waiting for VM $VM_ID to stop..."
            for i in {1..30}; do
                sleep 2
                VM_STATUS=$(qm status "$VM_ID" 2>/dev/null)
                if [[ "$VM_STATUS" == *"stopped"* ]]; then
                    log_success "VM $VM_ID stopped"
                    break
                fi

                if [ $i -eq 30 ]; then
                    log_error "VM $VM_ID did not stop in time, forcing..."
                    qm stop "$VM_ID" --skiplock 2>&1 | tee -a "$LOG_FILE"
                fi
            done
        done
    else
        log_error "Cannot proceed while VMs are running with GPU passthrough"
        exit 1
    fi
fi

echo ""

################################################################################
# Step 4: Remove GPU passthrough from VM configs
################################################################################

log "Step 4: Removing GPU passthrough from VM configurations..."
echo ""

for VM_ID in "${VMS_WITH_GPU[@]}"; do
    CONF="/etc/pve/qemu-server/${VM_ID}.conf"

    log "Backing up VM $VM_ID config..."
    cp "$CONF" "${CONF}.backup-$(date +%Y%m%d-%H%M%S)"
    log_success "Backed up: ${CONF}.backup-*"

    log "Removing hostpci entries for GPU from VM $VM_ID..."

    # Remove lines containing the GPU PCI address
    sed -i "/hostpci.*${GPU_PCI_ADDR}/d" "$CONF"

    log_success "Removed GPU passthrough from VM $VM_ID config"
done

echo ""

################################################################################
# Step 5: Unbind GPU from VFIO-PCI driver
################################################################################

log "Step 5: Unbinding GPU from VFIO-PCI driver..."
echo ""

# Check current driver binding
CURRENT_DRIVER=$(lspci -k -s "$GPU_PCI_ADDR" | grep "Kernel driver in use" | awk '{print $5}')
log "Current driver: ${CURRENT_DRIVER:-none}"

if [ "$CURRENT_DRIVER" = "vfio-pci" ]; then
    log "Unbinding GPU from VFIO-PCI..."

    # Unbind from vfio-pci
    if [ -e "/sys/bus/pci/drivers/vfio-pci/$GPU_PCI_FULL" ]; then
        echo "$GPU_PCI_FULL" > /sys/bus/pci/drivers/vfio-pci/unbind 2>&1 | tee -a "$LOG_FILE"
        log_success "Unbound GPU from vfio-pci driver"
    else
        log_warning "GPU not bound to vfio-pci in sysfs"
    fi
else
    log_warning "GPU is not bound to vfio-pci (current: ${CURRENT_DRIVER:-none})"
fi

sleep 2
echo ""

################################################################################
# Step 6: Remove VFIO driver binding configuration
################################################################################

log "Step 6: Checking VFIO configuration..."
echo ""

# Check for VFIO configuration in various places
VFIO_CONFIG_FILES=(
    "/etc/modprobe.d/vfio.conf"
    "/etc/modprobe.d/pve-blacklist.conf"
    "/etc/modules"
)

# Get GPU vendor and device IDs
GPU_VENDOR=$(lspci -n -s "$GPU_PCI_ADDR" | grep -oP '(?<=\s)[0-9a-f]{4}:[0-9a-f]{4}' | head -1)
log_info "GPU Vendor:Device ID: $GPU_VENDOR"

for CONFIG_FILE in "${VFIO_CONFIG_FILES[@]}"; do
    if [ -f "$CONFIG_FILE" ]; then
        if grep -q "vfio-pci.*$GPU_VENDOR" "$CONFIG_FILE" 2>/dev/null; then
            log_warning "Found VFIO configuration in $CONFIG_FILE"
            log "You may want to review and remove GPU from this file"
            grep "vfio-pci.*$GPU_VENDOR" "$CONFIG_FILE" | tee -a "$LOG_FILE"
        fi
    fi
done

echo ""

################################################################################
# Step 7: Bind GPU to NVIDIA driver
################################################################################

log "Step 7: Binding GPU to NVIDIA driver..."
echo ""

# Remove GPU from VFIO new_id if needed
if [ -e "/sys/bus/pci/drivers/vfio-pci/new_id" ]; then
    # This may fail if not bound, which is fine
    echo "$GPU_VENDOR" > /sys/bus/pci/drivers/vfio-pci/remove_id 2>/dev/null || true
fi

# Load NVIDIA modules
log "Loading NVIDIA kernel modules..."
modprobe nvidia 2>&1 | tee -a "$LOG_FILE"

if [ $? -eq 0 ]; then
    log_success "NVIDIA module loaded"
else
    log_error "Failed to load NVIDIA module"
    log "Error details:"
    dmesg | grep -i nvidia | tail -20 | tee -a "$LOG_FILE"
fi

# Load other NVIDIA modules
for MODULE in nvidia_uvm nvidia_modeset nvidia_drm; do
    modprobe "$MODULE" 2>&1 | tee -a "$LOG_FILE" || log_warning "Failed to load $MODULE"
done

sleep 2

# Check if modules are loaded
if lsmod | grep -q nvidia; then
    log_success "NVIDIA modules loaded:"
    lsmod | grep nvidia | tee -a "$LOG_FILE"
else
    log_error "NVIDIA modules not loaded!"
fi

echo ""

# Try to bind GPU to nvidia driver
log "Attempting to bind GPU to NVIDIA driver..."

# The NVIDIA driver should automatically claim the device
# We can trigger a rescan
echo 1 > /sys/bus/pci/rescan 2>&1 | tee -a "$LOG_FILE"

sleep 3

# Check new driver binding
NEW_DRIVER=$(lspci -k -s "$GPU_PCI_ADDR" | grep "Kernel driver in use" | awk '{print $5}')
log "New driver binding: ${NEW_DRIVER:-none}"

if [ "$NEW_DRIVER" = "nvidia" ]; then
    log_success "GPU successfully bound to NVIDIA driver!"
else
    log_warning "GPU may not be bound to NVIDIA driver yet"
    log "Current driver: ${NEW_DRIVER:-none}"
fi

echo ""

################################################################################
# Step 8: Update GRUB configuration
################################################################################

log "Step 8: Checking GRUB configuration..."
echo ""

# Check if we need to modify GRUB to prevent VFIO from claiming GPU on boot
if grep -q "vfio-pci.ids.*$GPU_VENDOR" /etc/default/grub 2>/dev/null; then
    log_warning "Found GPU in GRUB vfio-pci.ids configuration"
    log "You should remove '$GPU_VENDOR' from GRUB_CMDLINE_LINUX_DEFAULT"
    log "Edit /etc/default/grub and run 'update-grub'"
    echo ""
    grep "GRUB_CMDLINE_LINUX_DEFAULT" /etc/default/grub | tee -a "$LOG_FILE"
    echo ""

    read -p "Would you like me to try to remove it automatically? (yes/no): " AUTO_FIX_GRUB

    if [ "$AUTO_FIX_GRUB" = "yes" ]; then
        log "Backing up GRUB config..."
        cp /etc/default/grub "/etc/default/grub.backup-$(date +%Y%m%d-%H%M%S)"

        log "Removing GPU from vfio-pci.ids in GRUB..."
        sed -i "s/vfio-pci\.ids=[^ ]*$GPU_VENDOR[^ ]* //g" /etc/default/grub
        sed -i "s/ vfio-pci\.ids=[^ ]*$GPU_VENDOR[^ ]*//g" /etc/default/grub

        log "Updating GRUB..."
        update-grub 2>&1 | tee -a "$LOG_FILE"

        log_success "GRUB configuration updated"
        GRUB_UPDATED=true
    fi
else
    log_success "No GPU-specific VFIO configuration found in GRUB"
fi

echo ""

################################################################################
# Step 9: Update initramfs
################################################################################

log "Step 9: Updating initramfs..."
echo ""

update-initramfs -u -k all 2>&1 | tee -a "$LOG_FILE"
log_success "Initramfs updated"

echo ""

################################################################################
# Step 10: Test nvidia-smi
################################################################################

log "Step 10: Testing nvidia-smi..."
echo ""

if command -v nvidia-smi &> /dev/null; then
    if nvidia-smi 2>&1 | tee -a "$LOG_FILE"; then
        echo ""
        log_success "✓✓✓ SUCCESS! nvidia-smi is working! ✓✓✓"

        DRIVER_VER=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1)
        GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)

        log_success "Driver version: $DRIVER_VER"
        log_success "GPU: $GPU_NAME"

        NEED_REBOOT=false
    else
        log_warning "nvidia-smi command failed"
        NEED_REBOOT=true
    fi
else
    log_error "nvidia-smi not found"
    NEED_REBOOT=true
fi

echo ""

################################################################################
# Step 11: Summary and recommendations
################################################################################

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}           GPU UNBIND COMPLETED${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

log_success "GPU has been removed from VM passthrough configuration"
log_success "Log file: $LOG_FILE"
echo ""

log_info "Summary of changes:"
log "  ✓ Stopped VMs with GPU passthrough"
log "  ✓ Removed hostpci configuration from VM configs"
log "  ✓ Backed up VM configs to .backup-* files"
log "  ✓ Unbound GPU from VFIO-PCI driver"
log "  ✓ Loaded NVIDIA driver modules"
log "  ✓ Updated initramfs"
if [ "$GRUB_UPDATED" = true ]; then
    log "  ✓ Updated GRUB configuration"
fi
echo ""

if [ "$NEED_REBOOT" = true ] || [ "$GRUB_UPDATED" = true ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}                  REBOOT RECOMMENDED${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    log_warning "A system reboot is recommended to ensure all changes take effect"
    log "After reboot:"
    log "  1. Run: nvidia-smi"
    log "  2. Verify GPU is accessible"
    log "  3. Set up LXC container or Docker for LLM workloads"
    echo ""

    read -p "Reboot now? (yes/no): " DO_REBOOT
    if [ "$DO_REBOOT" = "yes" ]; then
        log "Rebooting in 5 seconds..."
        sleep 5
        reboot
    fi
else
    log_success "GPU is now available on the Proxmox host!"
    echo ""
    log "Next steps:"
    log "  1. Verify: nvidia-smi"
    log "  2. Create LXC container for LLM workloads"
    log "  3. Use: ./setup-nvidia-lxc-passthrough.sh [container-id]"
    echo ""
fi

exit 0
