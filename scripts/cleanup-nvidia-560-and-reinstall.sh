#!/bin/bash

################################################################################
# Complete NVIDIA Driver Cleanup and Reinstall Script for Proxmox
#
# This script completely removes NVIDIA 560.35.03 and reinstalls properly
# Usage: sudo ./cleanup-nvidia-560-and-reinstall.sh
################################################################################

set +e  # Don't exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Logging
LOG_FILE="/tmp/nvidia-cleanup-$(date +%Y%m%d-%H%M%S).log"

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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root. Use: sudo $0"
    exit 1
fi

# Display header
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}    Complete NVIDIA Driver Cleanup and Reinstall${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

log "Starting NVIDIA cleanup and reinstall"
log "Log file: $LOG_FILE"
echo ""

KERNEL_VERSION=$(uname -r)
log "Current kernel: $KERNEL_VERSION"
echo ""

################################################################################
# Step 1: Stop any processes using NVIDIA
################################################################################

log "Step 1: Stopping processes using NVIDIA..."
echo ""

# Kill any processes using NVIDIA
log "Checking for processes using NVIDIA devices..."
if lsof /dev/nvidia* 2>/dev/null; then
    log_warning "Found processes using NVIDIA devices"
    lsof /dev/nvidia* 2>&1 | tee -a "$LOG_FILE"

    read -p "Kill these processes? (yes/no): " KILL_PROCS
    if [ "$KILL_PROCS" = "yes" ]; then
        lsof -t /dev/nvidia* 2>/dev/null | xargs -r kill -9
        log_success "Processes killed"
    fi
else
    log_success "No processes using NVIDIA devices"
fi
echo ""

################################################################################
# Step 2: Unload NVIDIA kernel modules
################################################################################

log "Step 2: Unloading all NVIDIA kernel modules..."
echo ""

# Try to unload modules in correct order
NVIDIA_MODULES=(
    "nvidia_drm"
    "nvidia_modeset"
    "nvidia_uvm"
    "nvidia"
)

for MODULE in "${NVIDIA_MODULES[@]}"; do
    if lsmod | grep -q "^$MODULE"; then
        log "Unloading: $MODULE"
        rmmod "$MODULE" 2>&1 | tee -a "$LOG_FILE" || log_warning "Failed to unload $MODULE"
    fi
done

log_success "Kernel module unload attempted"
echo ""

################################################################################
# Step 3: Run NVIDIA uninstaller if it exists
################################################################################

log "Step 3: Running NVIDIA uninstaller..."
echo ""

# Look for NVIDIA uninstaller
UNINSTALL_SCRIPT="/usr/bin/nvidia-uninstall"

if [ -f "$UNINSTALL_SCRIPT" ]; then
    log "Found NVIDIA uninstaller, running it..."
    "$UNINSTALL_SCRIPT" --silent 2>&1 | tee -a "$LOG_FILE" || log_warning "Uninstaller completed with warnings"
    log_success "NVIDIA uninstaller completed"
else
    log_warning "NVIDIA uninstaller not found (this is OK)"
fi
echo ""

################################################################################
# Step 4: Remove DKMS modules
################################################################################

log "Step 4: Removing NVIDIA DKMS modules..."
echo ""

# Check if dkms exists
if command -v dkms &> /dev/null; then
    log "Checking DKMS status..."
    dkms status 2>&1 | tee -a "$LOG_FILE"
    echo ""

    # Remove all NVIDIA DKMS modules
    log "Removing NVIDIA from DKMS..."
    for NVIDIA_VER in $(dkms status | grep nvidia | awk -F', ' '{print $1}' | sort -u); do
        MODULE_NAME=$(echo $NVIDIA_VER | cut -d'/' -f1)
        MODULE_VERSION=$(echo $NVIDIA_VER | cut -d'/' -f2)
        log "Removing DKMS module: $MODULE_NAME/$MODULE_VERSION"
        dkms remove "$MODULE_NAME/$MODULE_VERSION" --all 2>&1 | tee -a "$LOG_FILE" || log_warning "DKMS remove failed for $MODULE_NAME/$MODULE_VERSION"
    done

    log_success "DKMS cleanup completed"
else
    log_warning "DKMS not installed"
fi
echo ""

################################################################################
# Step 5: Remove NVIDIA files and directories
################################################################################

log "Step 5: Removing all NVIDIA files and directories..."
echo ""

# Comprehensive list of NVIDIA directories to remove
NVIDIA_DIRS=(
    "/usr/lib/nvidia"
    "/usr/lib32/nvidia"
    "/usr/lib/xorg/modules/drivers/nvidia*"
    "/usr/lib/xorg/modules/extensions/libglx.so*"
    "/usr/share/nvidia"
    "/etc/X11/xorg.conf.d/*nvidia*"
    "/usr/bin/nvidia-*"
    "/usr/share/applications/nvidia-*"
    "/usr/share/pixmaps/nvidia-*"
    "/usr/share/man/man1/nvidia-*"
    "/var/lib/dkms/nvidia*"
    "/usr/src/nvidia-*"
    "/etc/modprobe.d/nvidia*.conf"
)

log "Removing NVIDIA directories and files..."
for PATTERN in "${NVIDIA_DIRS[@]}"; do
    for ITEM in $PATTERN; do
        if [ -e "$ITEM" ]; then
            log "Removing: $ITEM"
            rm -rf "$ITEM" 2>&1 | tee -a "$LOG_FILE"
        fi
    done
done

# Clean kernel module directories
log "Cleaning NVIDIA kernel modules from all kernel versions..."
find /lib/modules/*/updates/dkms -name "nvidia*.ko" -delete 2>/dev/null || true
find /lib/modules/*/kernel/drivers/video -name "nvidia*.ko" -delete 2>/dev/null || true
find /lib/modules/*/extra -name "nvidia*.ko" -delete 2>/dev/null || true

# Update module dependencies
log "Updating module dependencies for all kernels..."
for KVER in /lib/modules/*; do
    if [ -d "$KVER" ]; then
        KERN=$(basename "$KVER")
        log "Updating depmod for kernel: $KERN"
        depmod -a "$KERN" 2>&1 | tee -a "$LOG_FILE"
    fi
done

log_success "NVIDIA files removed"
echo ""

################################################################################
# Step 6: Remove any Debian NVIDIA packages
################################################################################

log "Step 6: Removing any Debian NVIDIA packages..."
echo ""

apt-get remove -y --purge 'nvidia-*' 'libnvidia-*' 2>&1 | tee -a "$LOG_FILE" || true
apt-get autoremove -y 2>&1 | tee -a "$LOG_FILE"

log_success "Package cleanup completed"
echo ""

################################################################################
# Step 7: Ensure nouveau is blacklisted
################################################################################

log "Step 7: Ensuring nouveau is blacklisted..."
echo ""

BLACKLIST_FILE="/etc/modprobe.d/blacklist-nvidia-nouveau.conf"

cat > "$BLACKLIST_FILE" <<'EOF'
# Blacklist nouveau to use NVIDIA proprietary driver
blacklist nouveau
options nouveau modeset=0
alias nouveau off
alias lsm nouveau off
EOF

log_success "Nouveau blacklisted: $BLACKLIST_FILE"

# Also blacklist in pve-blacklist.conf
if [ -f /etc/modprobe.d/pve-blacklist.conf ]; then
    if ! grep -q "blacklist nouveau" /etc/modprobe.d/pve-blacklist.conf; then
        echo -e "\n# Blacklist nouveau for NVIDIA\nblacklist nouveau" >> /etc/modprobe.d/pve-blacklist.conf
        log_success "Added nouveau blacklist to pve-blacklist.conf"
    fi
fi

echo ""

################################################################################
# Step 8: Verify and fix kernel headers
################################################################################

log "Step 8: Verifying kernel headers..."
echo ""

log "Current kernel: $KERNEL_VERSION"

# Check for kernel headers
HEADERS_PACKAGES=(
    "pve-headers-$KERNEL_VERSION"
    "proxmox-headers-$KERNEL_VERSION"
)

HEADERS_INSTALLED=false
for PKG in "${HEADERS_PACKAGES[@]}"; do
    if dpkg -l | grep -q "^ii.*$PKG"; then
        log_success "Headers installed: $PKG"
        HEADERS_INSTALLED=true
        HEADERS_PKG="$PKG"
        break
    fi
done

if [ "$HEADERS_INSTALLED" = false ]; then
    log_error "Kernel headers not installed!"
    log "Installing headers for $KERNEL_VERSION..."

    apt-get update

    for PKG in "${HEADERS_PACKAGES[@]}"; do
        if apt-get install -y "$PKG" 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Installed: $PKG"
            HEADERS_INSTALLED=true
            HEADERS_PKG="$PKG"
            break
        fi
    done

    if [ "$HEADERS_INSTALLED" = false ]; then
        log_error "Failed to install kernel headers!"
        log "Available headers:"
        apt-cache search pve-headers | grep "$KERNEL_VERSION" | tee -a "$LOG_FILE"
        exit 1
    fi
fi

# Verify headers symlink
HEADERS_DIR="/lib/modules/$KERNEL_VERSION/build"
if [ ! -L "$HEADERS_DIR" ] && [ ! -d "$HEADERS_DIR" ]; then
    log_warning "Headers symlink missing, creating it..."

    # Find the actual headers directory
    ACTUAL_HEADERS="/usr/src/$HEADERS_PKG"
    if [ ! -d "$ACTUAL_HEADERS" ]; then
        # Try alternate locations
        for DIR in /usr/src/pve-headers-* /usr/src/proxmox-headers-*; do
            if [ -d "$DIR" ] && [[ "$DIR" == *"$KERNEL_VERSION"* ]]; then
                ACTUAL_HEADERS="$DIR"
                break
            fi
        done
    fi

    if [ -d "$ACTUAL_HEADERS" ]; then
        ln -sf "$ACTUAL_HEADERS" "$HEADERS_DIR"
        log_success "Created symlink: $HEADERS_DIR -> $ACTUAL_HEADERS"
    else
        log_error "Cannot find actual headers directory!"
        exit 1
    fi
fi

# Verify headers work
if [ -f "$HEADERS_DIR/Makefile" ]; then
    log_success "Kernel headers are properly configured"
else
    log_error "Kernel headers Makefile not found at $HEADERS_DIR/Makefile"
    exit 1
fi

echo ""

################################################################################
# Step 9: Install build tools
################################################################################

log "Step 9: Ensuring build tools are installed..."
echo ""

apt-get install -y build-essential dkms gcc make 2>&1 | tee -a "$LOG_FILE"
log_success "Build tools installed"

# Verify gcc version matches kernel
KERNEL_GCC=$(cat /proc/version | grep -oP 'gcc version \K[0-9.]+')
SYSTEM_GCC=$(gcc --version | head -1 | grep -oP '\d+\.\d+\.\d+' | head -1)

log "Kernel was compiled with GCC: $KERNEL_GCC"
log "System GCC version: $SYSTEM_GCC"

# Check if they're close enough (major version should match)
KERNEL_GCC_MAJOR=$(echo $KERNEL_GCC | cut -d. -f1)
SYSTEM_GCC_MAJOR=$(echo $SYSTEM_GCC | cut -d. -f1)

if [ "$KERNEL_GCC_MAJOR" != "$SYSTEM_GCC_MAJOR" ]; then
    log_warning "GCC version mismatch! Kernel uses GCC $KERNEL_GCC, system has GCC $SYSTEM_GCC"
    log_warning "This may cause compilation issues"
else
    log_success "GCC versions are compatible"
fi

echo ""

################################################################################
# Step 10: Update initramfs
################################################################################

log "Step 10: Updating initramfs..."
echo ""

update-initramfs -u -k all 2>&1 | tee -a "$LOG_FILE"
log_success "Initramfs updated"

echo ""

################################################################################
# Step 11: Download and install NVIDIA driver
################################################################################

log "Step 11: Installing NVIDIA driver..."
echo ""

# Determine which driver to install
log "Which NVIDIA driver would you like to install?"
echo ""
echo "  1) NVIDIA 560.35.03 (Latest production branch - your previous attempt)"
echo "  2) NVIDIA 550.127.05 (Production branch - more stable)"
echo "  3) NVIDIA 535.xx (Long-term support)"
echo "  4) CUDA drivers (from CUDA repository)"
echo ""
read -p "Enter choice (1-4): " DRIVER_CHOICE

case $DRIVER_CHOICE in
    1)
        DRIVER_VERSION="560.35.03"
        DRIVER_URL="https://us.download.nvidia.com/XFree86/Linux-x86_64/560.35.03/NVIDIA-Linux-x86_64-560.35.03.run"
        ;;
    2)
        DRIVER_VERSION="550.127.05"
        DRIVER_URL="https://us.download.nvidia.com/XFree86/Linux-x86_64/550.127.05/NVIDIA-Linux-x86_64-550.127.05.run"
        ;;
    3)
        DRIVER_VERSION="535.183.01"
        DRIVER_URL="https://us.download.nvidia.com/XFree86/Linux-x86_64/535.183.01/NVIDIA-Linux-x86_64-535.183.01.run"
        ;;
    4)
        log "Installing CUDA drivers from repository..."
        apt-get update
        apt-get install -y cuda-drivers 2>&1 | tee -a "$LOG_FILE"

        if [ $? -eq 0 ]; then
            log_success "CUDA drivers installed successfully"
            SKIP_DOWNLOAD=true
        else
            log_error "Failed to install CUDA drivers"
            exit 1
        fi
        ;;
    *)
        log_error "Invalid choice"
        exit 1
        ;;
esac

if [ "$SKIP_DOWNLOAD" != true ]; then
    log "Selected driver: $DRIVER_VERSION"
    log "Download URL: $DRIVER_URL"
    echo ""

    # Download driver
    DRIVER_FILE="/tmp/NVIDIA-Linux-x86_64-${DRIVER_VERSION}.run"

    if [ -f "$DRIVER_FILE" ]; then
        log_warning "Driver file already exists: $DRIVER_FILE"
        read -p "Use existing file? (yes/no): " USE_EXISTING
        if [ "$USE_EXISTING" != "yes" ]; then
            log "Downloading NVIDIA driver..."
            wget -O "$DRIVER_FILE" "$DRIVER_URL" 2>&1 | tee -a "$LOG_FILE"
        fi
    else
        log "Downloading NVIDIA driver..."
        wget -O "$DRIVER_FILE" "$DRIVER_URL" 2>&1 | tee -a "$LOG_FILE"
    fi

    if [ ! -f "$DRIVER_FILE" ]; then
        log_error "Failed to download driver!"
        exit 1
    fi

    log_success "Driver downloaded: $DRIVER_FILE"

    # Make executable
    chmod +x "$DRIVER_FILE"

    # Install driver
    log "Installing NVIDIA driver (this may take several minutes)..."
    echo ""

    "$DRIVER_FILE" \
        --dkms \
        --kernel-name="$KERNEL_VERSION" \
        --kernel-source-path="/lib/modules/$KERNEL_VERSION/build" \
        --no-questions \
        --ui=none \
        --no-backup \
        --accept-license \
        --silent 2>&1 | tee -a "$LOG_FILE"

    INSTALL_EXIT_CODE=$?

    if [ $INSTALL_EXIT_CODE -eq 0 ]; then
        log_success "NVIDIA driver installed successfully!"
    else
        log_error "NVIDIA driver installation failed with exit code: $INSTALL_EXIT_CODE"
        log "Check the log file for details: /var/log/nvidia-installer.log"
        log "Also check: $LOG_FILE"

        # Show last 50 lines of nvidia installer log
        if [ -f /var/log/nvidia-installer.log ]; then
            echo ""
            log_error "Last 50 lines of /var/log/nvidia-installer.log:"
            tail -50 /var/log/nvidia-installer.log | tee -a "$LOG_FILE"
        fi

        exit 1
    fi
fi

echo ""

################################################################################
# Step 12: Load NVIDIA modules
################################################################################

log "Step 12: Loading NVIDIA kernel modules..."
echo ""

# First, check if nouveau is loaded (it shouldn't be)
if lsmod | grep -q nouveau; then
    log_error "Nouveau is still loaded! A reboot is required."
    NEED_REBOOT=true
else
    # Try to load NVIDIA modules
    LOAD_SUCCESS=true
    for MODULE in nvidia nvidia_uvm nvidia_modeset nvidia_drm; do
        log "Loading: $MODULE"
        if modprobe "$MODULE" 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Loaded: $MODULE"
        else
            log_error "Failed to load: $MODULE"
            LOAD_SUCCESS=false
        fi
    done

    if [ "$LOAD_SUCCESS" = false ]; then
        log_error "Failed to load NVIDIA modules"
        NEED_REBOOT=true
    else
        log_success "All NVIDIA modules loaded successfully!"
        NEED_REBOOT=false
    fi
fi

echo ""

################################################################################
# Step 13: Test nvidia-smi
################################################################################

log "Step 13: Testing nvidia-smi..."
echo ""

if [ "$NEED_REBOOT" = false ]; then
    if command -v nvidia-smi &> /dev/null; then
        if nvidia-smi 2>&1 | tee -a "$LOG_FILE"; then
            echo ""
            log_success "✓✓✓ SUCCESS! NVIDIA driver is working! ✓✓✓"

            DRIVER_VER=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1)
            log_success "Driver version: $DRIVER_VER"
        else
            log_error "nvidia-smi failed"
            NEED_REBOOT=true
        fi
    else
        log_error "nvidia-smi not found"
        NEED_REBOOT=true
    fi
fi

echo ""

################################################################################
# Final Status
################################################################################

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}           NVIDIA CLEANUP AND REINSTALL COMPLETED${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
log_success "Log file: $LOG_FILE"
echo ""

if [ "$NEED_REBOOT" = true ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}                  REBOOT REQUIRED${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    log_warning "A system reboot is REQUIRED"
    log "After reboot, run: nvidia-smi"
    echo ""

    read -p "Reboot now? (yes/no): " DO_REBOOT
    if [ "$DO_REBOOT" = "yes" ]; then
        log "Rebooting in 5 seconds..."
        sleep 5
        reboot
    fi
else
    log "Next steps:"
    log "  1. Verify GPU: nvidia-smi"
    log "  2. Configure LXC containers (if needed): ./setup-nvidia-lxc-passthrough.sh [container-id]"
    log "  3. Review log: cat $LOG_FILE"
fi

echo ""
exit 0
