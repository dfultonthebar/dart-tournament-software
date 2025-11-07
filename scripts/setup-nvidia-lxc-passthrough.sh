#!/bin/bash

################################################################################
# NVIDIA GPU Passthrough Setup for LXC Containers on Proxmox
#
# This script configures NVIDIA GPU passthrough from Proxmox host to LXC containers
# Usage: sudo ./setup-nvidia-lxc-passthrough.sh [container-id]
# Example: sudo ./setup-nvidia-lxc-passthrough.sh 100
#
# What this does:
# 1. Installs NVIDIA drivers on Proxmox host (if needed)
# 2. Configures LXC container for GPU access
# 3. Provides instructions for container setup
################################################################################

set +e  # Don't exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging
LOG_FILE="/tmp/nvidia-lxc-setup-$(date +%Y%m%d-%H%M%S).log"

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
echo -e "${CYAN}    NVIDIA GPU Passthrough Setup for LXC Containers${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

log "Starting NVIDIA LXC passthrough setup"
log "Log file: $LOG_FILE"
echo ""

# Get container ID
CONTAINER_ID="$1"
if [ -z "$CONTAINER_ID" ]; then
    log_error "No container ID specified"
    echo ""
    log "Usage: sudo $0 [container-id]"
    log "Example: sudo $0 100"
    echo ""
    log "Available LXC containers:"
    pct list 2>&1 | tee -a "$LOG_FILE"
    exit 1
fi

log "Target LXC container: $CONTAINER_ID"

# Verify container exists
if ! pct status "$CONTAINER_ID" &> /dev/null; then
    log_error "Container $CONTAINER_ID does not exist"
    echo ""
    log "Available LXC containers:"
    pct list
    exit 1
fi

CONTAINER_STATUS=$(pct status "$CONTAINER_ID")
log "Container status: $CONTAINER_STATUS"
echo ""

################################################################################
# Step 1: Detect NVIDIA GPU on host
################################################################################

log "Step 1: Detecting NVIDIA GPU on Proxmox host..."
echo ""

if ! lspci | grep -i nvidia > /dev/null; then
    log_error "No NVIDIA GPU detected on this system"
    log "Please ensure NVIDIA GPU is installed in the system"
    exit 1
fi

log_success "NVIDIA GPU(s) detected:"
lspci | grep -i nvidia | tee -a "$LOG_FILE"
echo ""

# Get GPU PCI addresses
GPU_PCI_ADDRESSES=$(lspci | grep -i nvidia | grep -i "VGA\|3D" | awk '{print $1}')
log_info "GPU PCI Address(es): $GPU_PCI_ADDRESSES"
echo ""

################################################################################
# Step 2: Check NVIDIA driver on host
################################################################################

log "Step 2: Checking NVIDIA driver installation on Proxmox host..."
echo ""

if command -v nvidia-smi &> /dev/null; then
    log_success "NVIDIA driver is installed on host"
    DRIVER_VERSION=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -1)
    log_success "Driver version: $DRIVER_VERSION"
    echo ""
    nvidia-smi 2>&1 | head -20 | tee -a "$LOG_FILE"
    echo ""
    DRIVER_INSTALLED=true
else
    log_warning "NVIDIA driver is NOT installed on host"
    DRIVER_INSTALLED=false
    echo ""
    read -p "Would you like to install NVIDIA drivers on the host now? (yes/no): " INSTALL_DRIVER

    if [ "$INSTALL_DRIVER" = "yes" ]; then
        log "Installing NVIDIA drivers on Proxmox host..."

        # Run the fix-nvidia-drivers.sh script if it exists
        if [ -f "./fix-nvidia-drivers.sh" ]; then
            log "Running fix-nvidia-drivers.sh..."
            ./fix-nvidia-drivers.sh 2>&1 | tee -a "$LOG_FILE"
        else
            # Install manually
            log "Installing NVIDIA driver from repositories..."

            # Add non-free repos
            if ! grep -q "non-free" /etc/apt/sources.list /etc/apt/sources.list.d/* 2>/dev/null; then
                echo "deb http://deb.debian.org/debian $(lsb_release -sc) main contrib non-free non-free-firmware" >> /etc/apt/sources.list.d/debian-non-free.list
            fi

            apt-get update
            apt-get install -y nvidia-driver firmware-misc-nonfree

            log_success "NVIDIA driver installed"
            log_warning "REBOOT REQUIRED to load NVIDIA drivers"
            log "Please run: reboot"
            log "Then run this script again after reboot"
            exit 0
        fi

        DRIVER_INSTALLED=true
    else
        log_error "Cannot configure LXC GPU passthrough without NVIDIA driver on host"
        exit 1
    fi
fi

################################################################################
# Step 3: Get GPU device information
################################################################################

log "Step 3: Getting GPU device information..."
echo ""

# Find NVIDIA device numbers
if [ -e /dev/nvidia0 ]; then
    log_success "NVIDIA devices found:"
    ls -la /dev/nvidia* 2>&1 | tee -a "$LOG_FILE"
    echo ""

    # Get device major/minor numbers
    NVIDIA0_MAJOR=$(stat -c '%t' /dev/nvidia0)
    NVIDIA0_MINOR=$(stat -c '%T' /dev/nvidia0)
    NVIDIA_UVM_MAJOR=$(stat -c '%t' /dev/nvidia-uvm 2>/dev/null || echo "")
    NVIDIA_CTL_MAJOR=$(stat -c '%t' /dev/nvidiactl 2>/dev/null || echo "")

    log_info "nvidia0 device: major=$NVIDIA0_MAJOR, minor=$NVIDIA0_MINOR"
else
    log_error "/dev/nvidia0 not found"
    log_error "NVIDIA driver modules may not be loaded"
    log "Try loading modules: modprobe nvidia"
    exit 1
fi
echo ""

################################################################################
# Step 4: Configure LXC container
################################################################################

log "Step 4: Configuring LXC container for GPU passthrough..."
echo ""

CONTAINER_CONF="/etc/pve/lxc/${CONTAINER_ID}.conf"

if [ ! -f "$CONTAINER_CONF" ]; then
    log_error "Container configuration file not found: $CONTAINER_CONF"
    exit 1
fi

log "Container configuration: $CONTAINER_CONF"

# Backup original config
cp "$CONTAINER_CONF" "${CONTAINER_CONF}.backup-$(date +%Y%m%d-%H%M%S)"
log_success "Backed up container configuration"

# Check if container is privileged or unprivileged
if grep -q "^unprivileged: 1" "$CONTAINER_CONF"; then
    UNPRIVILEGED=true
    log_info "Container is UNPRIVILEGED"
else
    UNPRIVILEGED=false
    log_info "Container is PRIVILEGED"
fi

# Add required configuration
log "Adding GPU passthrough configuration..."

# Remove old GPU config if exists
sed -i '/^lxc.cgroup2.devices.allow: c 195:/d' "$CONTAINER_CONF"
sed -i '/^lxc.cgroup2.devices.allow: c 509:/d' "$CONTAINER_CONF"
sed -i '/^lxc.mount.entry: \/dev\/nvidia/d' "$CONTAINER_CONF"

# Add new configuration
cat >> "$CONTAINER_CONF" <<EOF

# NVIDIA GPU Passthrough Configuration
# Generated by setup-nvidia-lxc-passthrough.sh on $(date)

# Allow access to NVIDIA devices
lxc.cgroup2.devices.allow: c 195:* rwm
lxc.cgroup2.devices.allow: c 509:* rwm

# Mount NVIDIA devices
lxc.mount.entry: /dev/nvidia0 dev/nvidia0 none bind,optional,create=file
lxc.mount.entry: /dev/nvidiactl dev/nvidiactl none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm dev/nvidia-uvm none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-modeset dev/nvidia-modeset none bind,optional,create=file
lxc.mount.entry: /dev/nvidia-uvm-tools dev/nvidia-uvm-tools none bind,optional,create=file
EOF

log_success "GPU passthrough configuration added to container config"
echo ""

# If unprivileged container, need additional ID mapping
if [ "$UNPRIVILEGED" = true ]; then
    log_warning "Unprivileged container detected"
    log_info "For unprivileged containers, you need to add ID mapping in /etc/subuid and /etc/subgid"
    echo ""
    log_info "Add these lines to /etc/subuid and /etc/subgid:"
    log_info "  root:100000:65536"
    echo ""
fi

################################################################################
# Step 5: Restart container to apply changes
################################################################################

log "Step 5: Applying changes to container..."
echo ""

if [[ "$CONTAINER_STATUS" == *"running"* ]]; then
    log "Container is running, restarting..."

    read -p "Restart container $CONTAINER_ID now? (yes/no): " RESTART_CONTAINER

    if [ "$RESTART_CONTAINER" = "yes" ]; then
        log "Shutting down container..."
        pct shutdown "$CONTAINER_ID" 2>&1 | tee -a "$LOG_FILE"

        # Wait for shutdown
        sleep 5

        log "Starting container..."
        pct start "$CONTAINER_ID" 2>&1 | tee -a "$LOG_FILE"

        sleep 3

        log_success "Container restarted"
    else
        log_warning "Container not restarted - changes will apply on next start"
    fi
else
    log "Container is not running - start it to apply changes"
fi
echo ""

################################################################################
# Step 6: Provide container setup instructions
################################################################################

log "Step 6: Container setup instructions..."
echo ""

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}    NEXT STEPS - Inside the LXC Container${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

log_info "Now you need to install NVIDIA drivers INSIDE the container"
echo ""
log "1. Enter the container:"
echo -e "   ${GREEN}pct enter $CONTAINER_ID${NC}"
echo ""

log "2. Install NVIDIA drivers in the container (must match host version: $DRIVER_VERSION):"
echo ""
echo -e "   ${GREEN}# Update package lists${NC}"
echo -e "   ${GREEN}apt-get update${NC}"
echo ""
echo -e "   ${GREEN}# Add non-free repository${NC}"
echo -e "   ${GREEN}echo 'deb http://deb.debian.org/debian bookworm main contrib non-free non-free-firmware' > /etc/apt/sources.list.d/debian-non-free.list${NC}"
echo -e "   ${GREEN}apt-get update${NC}"
echo ""
echo -e "   ${GREEN}# Install NVIDIA driver (same version as host)${NC}"
echo -e "   ${GREEN}apt-get install -y nvidia-driver=${DRIVER_VERSION}* firmware-misc-nonfree${NC}"
echo ""
echo -e "   ${GREEN}# Or install specific version like:${NC}"
echo -e "   ${GREEN}apt-get install -y nvidia-driver-535 firmware-misc-nonfree${NC}"
echo ""

log "3. Verify GPU access in the container:"
echo -e "   ${GREEN}nvidia-smi${NC}"
echo ""

log "4. Test CUDA (if needed):"
echo -e "   ${GREEN}apt-get install -y nvidia-cuda-toolkit${NC}"
echo -e "   ${GREEN}nvcc --version${NC}"
echo ""

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

################################################################################
# Step 7: Verification
################################################################################

log "Step 7: Verifying host configuration..."
echo ""

# Check if devices exist
if [ -e /dev/nvidia0 ]; then
    log_success "✓ /dev/nvidia0 exists"
else
    log_error "✗ /dev/nvidia0 missing"
fi

if [ -e /dev/nvidiactl ]; then
    log_success "✓ /dev/nvidiactl exists"
else
    log_error "✗ /dev/nvidiactl missing"
fi

if [ -e /dev/nvidia-uvm ]; then
    log_success "✓ /dev/nvidia-uvm exists"
else
    log_warning "⚠ /dev/nvidia-uvm missing (may not be critical)"
fi

# Check kernel modules
if lsmod | grep -q nvidia; then
    log_success "✓ NVIDIA kernel modules loaded"
    lsmod | grep nvidia | tee -a "$LOG_FILE"
else
    log_error "✗ NVIDIA kernel modules not loaded"
fi
echo ""

# Check container config
if grep -q "lxc.cgroup2.devices.allow: c 195:" "$CONTAINER_CONF"; then
    log_success "✓ Container configuration updated"
else
    log_error "✗ Container configuration may not be correct"
fi
echo ""

################################################################################
# Completion
################################################################################

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}    NVIDIA LXC PASSTHROUGH SETUP COMPLETED${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
log_success "Host configuration completed successfully!"
log_success "Container ID: $CONTAINER_ID"
log_success "Host NVIDIA driver: $DRIVER_VERSION"
log_success "Log file: $LOG_FILE"
echo ""

log_info "Summary of what was done:"
log "  ✓ Verified NVIDIA GPU and driver on host"
log "  ✓ Configured LXC container for GPU passthrough"
log "  ✓ Backed up original container config to ${CONTAINER_CONF}.backup-*"
log "  ✓ Added device passthrough configuration"
echo ""

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}                  IMPORTANT NEXT STEPS${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
log_warning "You MUST now install NVIDIA drivers inside the container"
log_warning "See instructions above for detailed steps"
echo ""
log "Quick commands:"
echo -e "  ${CYAN}pct enter $CONTAINER_ID${NC}"
echo -e "  ${CYAN}apt-get update && apt-get install -y nvidia-driver${NC}"
echo -e "  ${CYAN}nvidia-smi${NC}"
echo ""

exit 0
