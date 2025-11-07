#!/bin/bash

################################################################################
# NVIDIA Driver Fix Script for Proxmox
#
# This script safely removes and reinstalls NVIDIA drivers on Proxmox servers
# Usage: sudo ./fix-nvidia-drivers.sh [driver-version]
# Example: sudo ./fix-nvidia-drivers.sh 535
#
# If no version is specified, it will install the latest recommended driver
################################################################################

set +e  # Don't exit on error - we want to continue cleanup

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Logging
LOG_FILE="/tmp/nvidia-driver-fix-$(date +%Y%m%d-%H%M%S).log"

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
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}          NVIDIA Driver Uninstall/Reinstall for Proxmox${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

log "Starting NVIDIA driver fix script"
log "Log file: $LOG_FILE"
echo ""

# Determine driver version
DRIVER_VERSION="$1"
if [ -z "$DRIVER_VERSION" ]; then
    log_warning "No driver version specified, will install latest recommended driver"
    INSTALL_LATEST=true
else
    log "Using specified driver version: $DRIVER_VERSION"
    INSTALL_LATEST=false
fi

################################################################################
# Step 1: Detect current NVIDIA setup
################################################################################

log "Step 1: Detecting current NVIDIA setup..."
echo ""

# Check for NVIDIA GPUs
if lspci | grep -i nvidia > /dev/null; then
    log_success "NVIDIA GPU(s) detected:"
    lspci | grep -i nvidia | tee -a "$LOG_FILE"
    echo ""
else
    log_warning "No NVIDIA GPU detected. Continuing anyway (may be passed through to VM)"
fi

# Check current driver
if command -v nvidia-smi &> /dev/null; then
    log "Current NVIDIA driver status:"
    nvidia-smi 2>&1 | head -20 | tee -a "$LOG_FILE"
    CURRENT_VERSION=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1)
    if [ -n "$CURRENT_VERSION" ]; then
        log_success "Current driver version: $CURRENT_VERSION"
    fi
    echo ""
else
    log_warning "nvidia-smi not found (driver may not be installed or working)"
fi

# Check loaded modules
log "Checking loaded NVIDIA kernel modules:"
LOADED_MODULES=$(lsmod | grep -i nvidia || true)
if [ -n "$LOADED_MODULES" ]; then
    echo "$LOADED_MODULES" | tee -a "$LOG_FILE"
else
    log_warning "No NVIDIA kernel modules currently loaded"
fi
echo ""

################################################################################
# Step 2: Unload NVIDIA kernel modules
################################################################################

log "Step 2: Unloading NVIDIA kernel modules..."

# List of modules in dependency order (must unload in reverse order)
NVIDIA_MODULES=(
    "nvidia_drm"
    "nvidia_modeset"
    "nvidia_uvm"
    "nvidia"
)

UNLOADED_COUNT=0
for MODULE in "${NVIDIA_MODULES[@]}"; do
    if lsmod | grep -q "^$MODULE"; then
        log "Unloading module: $MODULE"
        if rmmod "$MODULE" 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Unloaded: $MODULE"
            UNLOADED_COUNT=$((UNLOADED_COUNT + 1))
        else
            log_warning "Failed to unload $MODULE (may be in use)"
            # Force unload if needed
            modprobe -r "$MODULE" 2>&1 | tee -a "$LOG_FILE" || true
        fi
        sleep 0.5
    fi
done

if [ $UNLOADED_COUNT -gt 0 ]; then
    log_success "Unloaded $UNLOADED_COUNT NVIDIA kernel module(s)"
else
    log_warning "No NVIDIA modules were loaded"
fi
echo ""

################################################################################
# Step 3: Remove existing NVIDIA packages
################################################################################

log "Step 3: Removing existing NVIDIA packages..."

# Find all NVIDIA packages
NVIDIA_PACKAGES=$(dpkg -l | grep -i nvidia | awk '{print $2}' | grep -v "^lib" || true)

if [ -n "$NVIDIA_PACKAGES" ]; then
    log "Found NVIDIA packages:"
    echo "$NVIDIA_PACKAGES" | tee -a "$LOG_FILE"
    echo ""

    # Remove packages
    log "Removing NVIDIA packages..."
    for PKG in $NVIDIA_PACKAGES; do
        log "Removing: $PKG"
        apt-get remove -y --purge "$PKG" 2>&1 | tee -a "$LOG_FILE" || true
    done

    # Also remove NVIDIA libraries
    log "Removing NVIDIA libraries..."
    apt-get remove -y --purge 'nvidia-*' 2>&1 | tee -a "$LOG_FILE" || true

    # Autoremove orphaned dependencies
    log "Removing orphaned dependencies..."
    apt-get autoremove -y 2>&1 | tee -a "$LOG_FILE"

    log_success "NVIDIA packages removed"
else
    log_warning "No NVIDIA packages found"
fi
echo ""

################################################################################
# Step 4: Clean up NVIDIA files and directories
################################################################################

log "Step 4: Cleaning up NVIDIA files and directories..."

# Directories to clean
CLEANUP_DIRS=(
    "/usr/lib/nvidia"
    "/usr/lib32/nvidia"
    "/usr/lib/xorg/modules/drivers/nvidia*"
    "/usr/lib/xorg/modules/extensions/libglx.so*"
    "/usr/share/nvidia"
    "/etc/X11/xorg.conf.d/*nvidia*"
)

CLEANED_COUNT=0
for DIR_PATTERN in "${CLEANUP_DIRS[@]}"; do
    for DIR in $DIR_PATTERN; do
        if [ -e "$DIR" ]; then
            log "Removing: $DIR"
            rm -rf "$DIR" 2>&1 | tee -a "$LOG_FILE"
            CLEANED_COUNT=$((CLEANED_COUNT + 1))
        fi
    done
done

# Clean module directories
log "Cleaning kernel module directories..."
find /lib/modules/*/updates/dkms -name "nvidia*.ko" -delete 2>&1 | tee -a "$LOG_FILE" || true
find /lib/modules/*/kernel/drivers/video -name "nvidia*.ko" -delete 2>&1 | tee -a "$LOG_FILE" || true

# Update module dependencies
log "Updating module dependencies..."
depmod -a

if [ $CLEANED_COUNT -gt 0 ]; then
    log_success "Cleaned up $CLEANED_COUNT file/directory location(s)"
else
    log_warning "No NVIDIA files found to clean"
fi
echo ""

################################################################################
# Step 5: Ensure nouveau is blacklisted
################################################################################

log "Step 5: Ensuring nouveau driver is blacklisted..."

BLACKLIST_FILE="/etc/modprobe.d/blacklist-nvidia-nouveau.conf"

if [ -f "$BLACKLIST_FILE" ]; then
    log_warning "Blacklist file already exists: $BLACKLIST_FILE"
else
    log "Creating nouveau blacklist file..."
    cat > "$BLACKLIST_FILE" <<EOF
# Blacklist nouveau driver to allow NVIDIA proprietary driver
blacklist nouveau
options nouveau modeset=0
EOF
    log_success "Created: $BLACKLIST_FILE"
fi

# Update initramfs
log "Updating initramfs..."
update-initramfs -u 2>&1 | tee -a "$LOG_FILE"
log_success "Initramfs updated"
echo ""

################################################################################
# Step 6: Update package lists and install headers
################################################################################

log "Step 6: Preparing for NVIDIA driver installation..."

# Update package lists
log "Updating package lists..."
apt-get update 2>&1 | tee -a "$LOG_FILE"
log_success "Package lists updated"

# Install required packages
log "Installing required packages (kernel headers, dkms)..."

# Get current kernel version
KERNEL_VERSION=$(uname -r)
log "Current kernel: $KERNEL_VERSION"

# Install headers for current kernel
if apt-get install -y "pve-headers-$KERNEL_VERSION" 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Kernel headers installed"
else
    log_warning "Failed to install pve-headers, trying proxmox-headers..."
    apt-get install -y "proxmox-headers-$KERNEL_VERSION" 2>&1 | tee -a "$LOG_FILE" || log_error "Could not install kernel headers"
fi

# Install DKMS
apt-get install -y dkms build-essential 2>&1 | tee -a "$LOG_FILE"
log_success "Build tools installed"
echo ""

################################################################################
# Step 7: Install NVIDIA drivers
################################################################################

log "Step 7: Installing NVIDIA drivers..."
echo ""

if [ "$INSTALL_LATEST" = true ]; then
    log "Installing latest NVIDIA driver from Debian repositories..."

    # Add non-free repositories if needed
    if ! grep -q "non-free" /etc/apt/sources.list /etc/apt/sources.list.d/* 2>/dev/null; then
        log "Enabling non-free repositories..."
        echo "deb http://deb.debian.org/debian $(lsb_release -sc) main contrib non-free non-free-firmware" >> /etc/apt/sources.list.d/debian-non-free.list
        apt-get update 2>&1 | tee -a "$LOG_FILE"
    fi

    # Install driver
    if apt-get install -y nvidia-driver firmware-misc-nonfree 2>&1 | tee -a "$LOG_FILE"; then
        log_success "NVIDIA driver installed successfully"
    else
        log_error "Failed to install NVIDIA driver"
        log "You may need to manually specify a driver version"
        exit 1
    fi
else
    log "Installing NVIDIA driver version $DRIVER_VERSION..."

    # Add non-free repositories if needed
    if ! grep -q "non-free" /etc/apt/sources.list /etc/apt/sources.list.d/* 2>/dev/null; then
        log "Enabling non-free repositories..."
        echo "deb http://deb.debian.org/debian $(lsb_release -sc) main contrib non-free non-free-firmware" >> /etc/apt/sources.list.d/debian-non-free.list
        apt-get update 2>&1 | tee -a "$LOG_FILE"
    fi

    # Install specific driver version
    if apt-get install -y "nvidia-driver-${DRIVER_VERSION}" firmware-misc-nonfree 2>&1 | tee -a "$LOG_FILE"; then
        log_success "NVIDIA driver version $DRIVER_VERSION installed successfully"
    else
        log_error "Failed to install NVIDIA driver version $DRIVER_VERSION"
        log "Available versions:"
        apt-cache search nvidia-driver | grep "^nvidia-driver-" | tee -a "$LOG_FILE"
        exit 1
    fi
fi
echo ""

################################################################################
# Step 8: Load NVIDIA modules
################################################################################

log "Step 8: Loading NVIDIA kernel modules..."

# Load modules in dependency order
LOAD_MODULES=(
    "nvidia"
    "nvidia_uvm"
    "nvidia_modeset"
    "nvidia_drm"
)

LOADED_COUNT=0
for MODULE in "${LOAD_MODULES[@]}"; do
    log "Loading module: $MODULE"
    if modprobe "$MODULE" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Loaded: $MODULE"
        LOADED_COUNT=$((LOADED_COUNT + 1))
    else
        log_warning "Failed to load $MODULE (may load on reboot)"
    fi
    sleep 0.5
done

if [ $LOADED_COUNT -gt 0 ]; then
    log_success "Loaded $LOADED_COUNT NVIDIA kernel module(s)"
fi
echo ""

################################################################################
# Step 9: Verification
################################################################################

log "Step 9: Verifying NVIDIA driver installation..."
echo ""

# Check nvidia-smi
if command -v nvidia-smi &> /dev/null; then
    log_success "nvidia-smi is available"
    echo ""
    log "Running nvidia-smi..."
    echo ""
    if nvidia-smi 2>&1 | tee -a "$LOG_FILE"; then
        echo ""
        log_success "✓ NVIDIA driver is working!"
        NEW_VERSION=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1)
        if [ -n "$NEW_VERSION" ]; then
            log_success "✓ Installed driver version: $NEW_VERSION"
        fi
    else
        log_warning "⚠ nvidia-smi command failed (driver may need reboot)"
    fi
else
    log_error "✗ nvidia-smi not found"
fi
echo ""

# Check loaded modules
log "Checking loaded NVIDIA modules:"
CURRENT_MODULES=$(lsmod | grep nvidia || true)
if [ -n "$CURRENT_MODULES" ]; then
    echo "$CURRENT_MODULES" | tee -a "$LOG_FILE"
    log_success "✓ NVIDIA modules are loaded"
else
    log_warning "⚠ No NVIDIA modules loaded (reboot may be required)"
fi
echo ""

# Check for nouveau (should not be loaded)
if lsmod | grep -q nouveau; then
    log_error "✗ Nouveau driver is still loaded (reboot required)"
else
    log_success "✓ Nouveau driver is not loaded"
fi
echo ""

################################################################################
# Step 10: GPU Passthrough configuration (optional)
################################################################################

log "Step 10: GPU Passthrough configuration check..."

if grep -q "intel_iommu=on" /etc/default/grub || grep -q "amd_iommu=on" /etc/default/grub; then
    log_success "✓ IOMMU is enabled in GRUB"
else
    log_warning "⚠ IOMMU is not enabled (required for GPU passthrough)"
    echo ""
    log "To enable IOMMU for GPU passthrough, add to GRUB_CMDLINE_LINUX_DEFAULT in /etc/default/grub:"
    log "  For Intel: intel_iommu=on"
    log "  For AMD: amd_iommu=on"
    log "Then run: update-grub && reboot"
fi
echo ""

# Check VFIO modules
if grep -q "vfio" /etc/modules; then
    log_success "✓ VFIO modules configured"
else
    log_warning "⚠ VFIO modules not configured (required for GPU passthrough)"
    echo ""
    log "To configure VFIO for GPU passthrough, add to /etc/modules:"
    log "  vfio"
    log "  vfio_iommu_type1"
    log "  vfio_pci"
    log "  vfio_virqfd"
fi
echo ""

################################################################################
# Completion
################################################################################

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}        NVIDIA DRIVER FIX COMPLETED${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
log_success "Installation completed successfully!"
log_success "Log file: $LOG_FILE"
echo ""

# Reboot recommendation
if ! nvidia-smi &> /dev/null || ! lsmod | grep -q nvidia; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}                  REBOOT REQUIRED${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    log_warning "A system reboot is REQUIRED to complete the driver installation"
    log_warning "Run: reboot"
    echo ""
else
    log "Recommended next steps:"
    log "  1. Test GPU: nvidia-smi"
    log "  2. Review log: cat $LOG_FILE"
    log "  3. Optional: Reboot for clean state"
    echo ""
fi

exit 0
