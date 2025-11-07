#!/bin/bash

################################################################################
# NVIDIA Kernel Module Load Error Fix Script for Proxmox
#
# This script fixes the common "Unable to load kernel module 'nvidia.ko'" error
#
# Common causes:
# 1. Nouveau driver conflict
# 2. Missing/wrong kernel headers
# 3. UEFI Secure Boot blocking unsigned modules
# 4. Kernel/driver version mismatch
#
# Usage: sudo ./fix-nvidia-kernel-module.sh
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
LOG_FILE="/tmp/nvidia-kernel-module-fix-$(date +%Y%m%d-%H%M%S).log"

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

log_aggressive() {
    echo -e "${MAGENTA}[$(date +'%Y-%m-%d %H:%M:%S')] ⚡${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root. Use: sudo $0"
    exit 1
fi

# Display header
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}        NVIDIA Kernel Module Load Error Fix${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

log "Starting NVIDIA kernel module fix"
log "Log file: $LOG_FILE"
echo ""

################################################################################
# Step 1: System Information
################################################################################

log "Step 1: Gathering system information..."
echo ""

KERNEL_VERSION=$(uname -r)
log "Current kernel: $KERNEL_VERSION"

if [ -f /etc/os-release ]; then
    OS_INFO=$(grep PRETTY_NAME /etc/os-release | cut -d'"' -f2)
    log "OS: $OS_INFO"
fi

# Check if Proxmox
if command -v pveversion &> /dev/null; then
    PVE_VERSION=$(pveversion | head -1)
    log "Proxmox: $PVE_VERSION"
fi

# Check gcc version
if command -v gcc &> /dev/null; then
    GCC_VERSION=$(gcc --version | head -1)
    log "GCC: $GCC_VERSION"
else
    log_warning "GCC not installed"
fi
echo ""

################################################################################
# Step 2: Check for NVIDIA GPU
################################################################################

log "Step 2: Checking for NVIDIA GPU..."
echo ""

if lspci | grep -i nvidia | grep -i "VGA\|3D" > /dev/null; then
    log_success "NVIDIA GPU detected:"
    lspci | grep -i nvidia | grep -i "VGA\|3D" | tee -a "$LOG_FILE"
    echo ""
else
    log_error "No NVIDIA GPU detected"
    log "This script is only for systems with NVIDIA GPUs"
    exit 1
fi

################################################################################
# Step 3: Check Secure Boot
################################################################################

log "Step 3: Checking UEFI Secure Boot status..."
echo ""

if [ -f /sys/firmware/efi/efivars/SecureBoot-* ]; then
    SECUREBOOT_STATUS=$(od -An -t u1 /sys/firmware/efi/efivars/SecureBoot-* 2>/dev/null | awk '{print $NF}')
    if [ "$SECUREBOOT_STATUS" = "1" ]; then
        log_error "✗ UEFI Secure Boot is ENABLED"
        echo ""
        log_warning "Secure Boot prevents loading unsigned NVIDIA kernel modules!"
        echo ""
        log "You have two options:"
        log "  Option 1: Disable Secure Boot in BIOS/UEFI (RECOMMENDED)"
        log "  Option 2: Sign the NVIDIA kernel module (complex)"
        echo ""
        read -p "Have you disabled Secure Boot and rebooted? (yes/no): " SECUREBOOT_DISABLED

        if [ "$SECUREBOOT_DISABLED" != "yes" ]; then
            log_error "Please disable Secure Boot in your BIOS/UEFI settings and reboot"
            log "Then run this script again"
            exit 1
        fi
    else
        log_success "✓ Secure Boot is disabled"
    fi
else
    log_success "✓ System is not using UEFI Secure Boot"
fi
echo ""

################################################################################
# Step 4: Check and Remove Nouveau Driver
################################################################################

log "Step 4: Checking for nouveau driver (conflicts with NVIDIA)..."
echo ""

# Check if nouveau is loaded
if lsmod | grep -q nouveau; then
    log_error "✗ Nouveau driver is LOADED - this conflicts with NVIDIA!"
    echo ""

    log_aggressive "Removing nouveau driver..."

    # Try to unload nouveau
    log "Attempting to unload nouveau module..."
    if rmmod nouveau 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Nouveau unloaded"
    else
        log_error "Cannot unload nouveau (may be in use)"
        log_warning "Will blacklist and require reboot"
    fi
else
    log_success "✓ Nouveau driver is not loaded"
fi

# Blacklist nouveau
log "Ensuring nouveau is blacklisted..."

BLACKLIST_FILE="/etc/modprobe.d/blacklist-nvidia-nouveau.conf"
BLACKLIST_CONTENT="# Blacklist nouveau to use NVIDIA proprietary driver
blacklist nouveau
options nouveau modeset=0
alias nouveau off
alias lsm nouveau off"

if [ -f "$BLACKLIST_FILE" ]; then
    log_warning "Blacklist file exists, updating..."
    echo "$BLACKLIST_CONTENT" > "$BLACKLIST_FILE"
else
    log "Creating nouveau blacklist file..."
    echo "$BLACKLIST_CONTENT" > "$BLACKLIST_FILE"
fi

log_success "Nouveau blacklisted at: $BLACKLIST_FILE"

# Also add to /etc/modprobe.d/pve-blacklist.conf if on Proxmox
if command -v pveversion &> /dev/null; then
    PVE_BLACKLIST="/etc/modprobe.d/pve-blacklist.conf"
    if ! grep -q "blacklist nouveau" "$PVE_BLACKLIST" 2>/dev/null; then
        echo -e "\n# Blacklist nouveau for NVIDIA\nblacklist nouveau" >> "$PVE_BLACKLIST"
        log_success "Added nouveau blacklist to Proxmox config"
    fi
fi

echo ""

################################################################################
# Step 5: Verify and Install Kernel Headers
################################################################################

log "Step 5: Verifying kernel headers for current kernel..."
echo ""

log "Current kernel: $KERNEL_VERSION"
log "Checking for headers..."

# Check multiple possible header package names for Proxmox
HEADER_PACKAGES=(
    "pve-headers-$KERNEL_VERSION"
    "proxmox-headers-$KERNEL_VERSION"
    "linux-headers-$KERNEL_VERSION"
)

HEADERS_FOUND=false
HEADERS_PACKAGE=""

for PKG in "${HEADER_PACKAGES[@]}"; do
    if dpkg -l | grep -q "^ii.*$PKG"; then
        HEADERS_FOUND=true
        HEADERS_PACKAGE="$PKG"
        log_success "✓ Headers installed: $PKG"
        break
    fi
done

if [ "$HEADERS_FOUND" = false ]; then
    log_error "✗ Kernel headers NOT installed for kernel $KERNEL_VERSION"
    echo ""
    log_aggressive "Installing kernel headers..."

    # Try to install headers
    apt-get update

    INSTALLED=false
    for PKG in "${HEADER_PACKAGES[@]}"; do
        log "Trying to install: $PKG"
        if apt-get install -y "$PKG" 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Installed: $PKG"
            HEADERS_PACKAGE="$PKG"
            INSTALLED=true
            break
        fi
    done

    if [ "$INSTALLED" = false ]; then
        log_error "Failed to install kernel headers!"
        log "Available header packages:"
        apt-cache search pve-headers 2>&1 | tee -a "$LOG_FILE"
        apt-cache search proxmox-headers 2>&1 | tee -a "$LOG_FILE"
        exit 1
    fi
fi

# Verify headers directory exists
HEADERS_DIR="/usr/src/$HEADERS_PACKAGE"
if [ ! -d "$HEADERS_DIR" ]; then
    # Try alternate location
    HEADERS_DIR="/lib/modules/$KERNEL_VERSION/build"
fi

if [ -d "$HEADERS_DIR" ]; then
    log_success "✓ Headers directory exists: $HEADERS_DIR"
else
    log_error "✗ Headers directory not found!"
    log "Searched: /usr/src/$HEADERS_PACKAGE and /lib/modules/$KERNEL_VERSION/build"
fi

echo ""

################################################################################
# Step 6: Install/Verify Build Tools
################################################################################

log "Step 6: Installing required build tools..."
echo ""

REQUIRED_PACKAGES=(
    "build-essential"
    "dkms"
    "gcc"
    "make"
)

for PKG in "${REQUIRED_PACKAGES[@]}"; do
    if ! dpkg -l | grep -q "^ii.*$PKG"; then
        log "Installing: $PKG"
        apt-get install -y "$PKG" 2>&1 | tee -a "$LOG_FILE"
    else
        log_success "✓ $PKG installed"
    fi
done

echo ""

################################################################################
# Step 7: Remove Existing NVIDIA Installation
################################################################################

log "Step 7: Removing existing NVIDIA installation..."
echo ""

# Unload any NVIDIA modules
log "Unloading NVIDIA kernel modules..."
NVIDIA_MODULES=(
    "nvidia_drm"
    "nvidia_modeset"
    "nvidia_uvm"
    "nvidia"
)

for MODULE in "${NVIDIA_MODULES[@]}"; do
    if lsmod | grep -q "^$MODULE"; then
        log "Unloading: $MODULE"
        rmmod "$MODULE" 2>&1 | tee -a "$LOG_FILE" || log_warning "Failed to unload $MODULE (may be in use)"
    fi
done

# Remove NVIDIA packages
log "Removing NVIDIA packages..."
apt-get remove -y --purge 'nvidia-*' 2>&1 | tee -a "$LOG_FILE" || true
apt-get autoremove -y 2>&1 | tee -a "$LOG_FILE"

# Clean up old module files
log "Cleaning up old NVIDIA kernel modules..."
find /lib/modules/*/updates/dkms -name "nvidia*.ko" -delete 2>&1 | tee -a "$LOG_FILE" || true
find /lib/modules/*/kernel/drivers/video -name "nvidia*.ko" -delete 2>&1 | tee -a "$LOG_FILE" || true

# Update module dependencies
depmod -a

log_success "Old NVIDIA installation removed"
echo ""

################################################################################
# Step 8: Update initramfs
################################################################################

log "Step 8: Updating initramfs to apply blacklist..."
echo ""

update-initramfs -u -k all 2>&1 | tee -a "$LOG_FILE"

log_success "Initramfs updated"
echo ""

################################################################################
# Step 9: Install NVIDIA Driver with DKMS
################################################################################

log "Step 9: Installing NVIDIA driver with DKMS..."
echo ""

# Add non-free repository if needed
if ! grep -q "non-free" /etc/apt/sources.list /etc/apt/sources.list.d/* 2>/dev/null; then
    log "Adding non-free repository..."
    echo "deb http://deb.debian.org/debian $(lsb_release -sc) main contrib non-free non-free-firmware" >> /etc/apt/sources.list.d/debian-non-free.list
fi

apt-get update 2>&1 | tee -a "$LOG_FILE"

log "Installing NVIDIA driver (this may take several minutes)..."
echo ""

if apt-get install -y nvidia-driver nvidia-kernel-dkms firmware-misc-nonfree 2>&1 | tee -a "$LOG_FILE"; then
    log_success "NVIDIA driver installed successfully"
else
    log_error "NVIDIA driver installation failed"
    log "Check the log for details: $LOG_FILE"
    exit 1
fi

echo ""

################################################################################
# Step 10: Verify DKMS Build
################################################################################

log "Step 10: Verifying DKMS build status..."
echo ""

if command -v dkms &> /dev/null; then
    log "DKMS status:"
    dkms status 2>&1 | tee -a "$LOG_FILE"
    echo ""

    # Check if nvidia module was built
    if dkms status | grep -q nvidia; then
        log_success "✓ NVIDIA module built with DKMS"
    else
        log_warning "⚠ NVIDIA module may not be built with DKMS"
    fi
fi

echo ""

################################################################################
# Step 11: Try to Load NVIDIA Module
################################################################################

log "Step 11: Attempting to load NVIDIA kernel module..."
echo ""

# First check if nouveau is still loaded
if lsmod | grep -q nouveau; then
    log_error "✗ Nouveau is still loaded!"
    log_warning "A REBOOT is required to unload nouveau"
    NEED_REBOOT=true
else
    log_success "✓ Nouveau is not loaded"
    NEED_REBOOT=false

    # Try to load nvidia module
    log "Loading NVIDIA modules..."

    LOAD_SUCCESS=true
    for MODULE in "nvidia" "nvidia_uvm" "nvidia_modeset" "nvidia_drm"; do
        log "Loading: $MODULE"
        if modprobe "$MODULE" 2>&1 | tee -a "$LOG_FILE"; then
            log_success "✓ Loaded: $MODULE"
        else
            log_error "✗ Failed to load: $MODULE"
            LOAD_SUCCESS=false
        fi
    done

    if [ "$LOAD_SUCCESS" = true ]; then
        log_success "All NVIDIA modules loaded successfully!"
    else
        log_error "Some modules failed to load"
        NEED_REBOOT=true
    fi
fi

echo ""

################################################################################
# Step 12: Test nvidia-smi
################################################################################

log "Step 12: Testing nvidia-smi..."
echo ""

if [ "$NEED_REBOOT" = false ]; then
    if command -v nvidia-smi &> /dev/null; then
        if nvidia-smi 2>&1 | tee -a "$LOG_FILE"; then
            log_success "✓✓✓ SUCCESS! nvidia-smi is working! ✓✓✓"
        else
            log_error "nvidia-smi command failed"
            NEED_REBOOT=true
        fi
    else
        log_warning "nvidia-smi not found (installation may need reboot)"
        NEED_REBOOT=true
    fi
fi

echo ""

################################################################################
# Step 13: Final Recommendations
################################################################################

log "Step 13: Final recommendations..."
echo ""

if [ "$NEED_REBOOT" = true ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}                  REBOOT REQUIRED${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    log_warning "A system reboot is REQUIRED to:"
    log "  - Unload nouveau driver completely"
    log "  - Load NVIDIA kernel modules"
    log "  - Apply all changes"
    echo ""
    log "After reboot, run this command to verify:"
    echo -e "  ${GREEN}nvidia-smi${NC}"
    echo ""
    log "Then check the kernel module:"
    echo -e "  ${GREEN}lsmod | grep nvidia${NC}"
    echo ""

    read -p "Would you like to reboot now? (yes/no): " DO_REBOOT
    if [ "$DO_REBOOT" = "yes" ]; then
        log "Rebooting in 10 seconds... (Ctrl+C to cancel)"
        sleep 10
        reboot
    fi
else
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}        NVIDIA KERNEL MODULE FIX COMPLETED!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    log_success "NVIDIA driver is working!"
    echo ""
    log "Next steps:"
    log "  1. Verify GPU: nvidia-smi"
    log "  2. Configure LXC containers (if needed): ./setup-nvidia-lxc-passthrough.sh [container-id]"
    log "  3. Review log: cat $LOG_FILE"
    echo ""
fi

################################################################################
# Completion Summary
################################################################################

echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Summary of actions taken:"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "  ✓ Checked for NVIDIA GPU"
log "  ✓ Verified/disabled Secure Boot"
log "  ✓ Blacklisted nouveau driver"
log "  ✓ Installed kernel headers for $KERNEL_VERSION"
log "  ✓ Installed build tools (gcc, dkms, etc.)"
log "  ✓ Removed old NVIDIA installation"
log "  ✓ Updated initramfs"
log "  ✓ Installed NVIDIA driver with DKMS"
log "  ✓ Updated module dependencies"
echo ""
log "Log file saved to: $LOG_FILE"
echo ""

exit 0
