#!/bin/bash

################################################################################
# Proxmox Headers Package Fix Script
#
# This script safely removes and reinstalls hung proxmox-headers packages
# Usage: sudo ./fix-proxmox-headers.sh [package-version]
# Example: sudo ./fix-proxmox-headers.sh 6.8.12-16-pve
#
# If no version is specified, it will attempt to detect the hung package
################################################################################

set -e  # Exit on error (disabled for specific sections)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
LOG_FILE="/tmp/proxmox-headers-fix-$(date +%Y%m%d-%H%M%S).log"

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

# Determine package version
if [ -z "$1" ]; then
    log "No package version specified, attempting auto-detection..."
    PACKAGE_VERSION=$(dpkg -l | grep proxmox-headers | grep -v "^rc" | awk '{print $3}' | head -1 | sed 's/.*-//')
    if [ -z "$PACKAGE_VERSION" ]; then
        PACKAGE_VERSION="6.8.12-16-pve"
        log_warning "Could not auto-detect version, using default: $PACKAGE_VERSION"
    else
        log_success "Detected version: $PACKAGE_VERSION"
    fi
else
    PACKAGE_VERSION="$1"
    log "Using specified version: $PACKAGE_VERSION"
fi

PACKAGE_NAME="proxmox-headers-$PACKAGE_VERSION"

log "Starting Proxmox headers fix for package: $PACKAGE_NAME"
log "Log file: $LOG_FILE"

################################################################################
# Step 1: Kill hung processes
################################################################################

log "Step 1: Checking for and killing hung package manager processes..."

KILLED_PROCESSES=0
for PROCESS in dpkg apt-get apt aptitude; do
    if pgrep -x "$PROCESS" > /dev/null; then
        log_warning "Found running process: $PROCESS"
        killall "$PROCESS" 2>/dev/null || true
        KILLED_PROCESSES=$((KILLED_PROCESSES + 1))
        sleep 1
    fi
done

if [ $KILLED_PROCESSES -gt 0 ]; then
    log_warning "Killed $KILLED_PROCESSES hung process(es)"
    sleep 2
else
    log_success "No hung processes found"
fi

################################################################################
# Step 2: Remove lock files
################################################################################

log "Step 2: Removing package manager lock files..."

LOCK_FILES=(
    "/var/lib/dpkg/lock-frontend"
    "/var/lib/dpkg/lock"
    "/var/cache/apt/archives/lock"
    "/var/lib/apt/lists/lock"
)

REMOVED_LOCKS=0
for LOCK in "${LOCK_FILES[@]}"; do
    if [ -f "$LOCK" ]; then
        rm -f "$LOCK"
        log_warning "Removed lock file: $LOCK"
        REMOVED_LOCKS=$((REMOVED_LOCKS + 1))
    fi
done

if [ $REMOVED_LOCKS -gt 0 ]; then
    log_warning "Removed $REMOVED_LOCKS lock file(s)"
else
    log_success "No lock files found"
fi

################################################################################
# Step 3: Force remove the package
################################################################################

log "Step 3: Force removing package: $PACKAGE_NAME..."

# Check if package is installed
if dpkg -l | grep -q "$PACKAGE_NAME"; then
    log "Package found, attempting removal..."

    # Try normal removal first
    if dpkg --remove --force-remove-reinstreq "$PACKAGE_NAME" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Package removed successfully"
    else
        log_warning "Normal removal failed, trying forced purge..."

        # Try forced purge
        if dpkg --purge --force-all "$PACKAGE_NAME" 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Package purged successfully"
        else
            log_error "Failed to remove package with dpkg, trying manual cleanup..."

            # Manual cleanup
            rm -rf "/var/lib/dpkg/info/${PACKAGE_NAME}.*" 2>/dev/null || true
            log_warning "Removed package info files manually"
        fi
    fi
else
    log_warning "Package not found in dpkg database (may have been partially removed)"
fi

# Remove header files if they exist
if [ -d "/usr/src/${PACKAGE_NAME}" ]; then
    log "Removing header files from /usr/src/${PACKAGE_NAME}..."
    rm -rf "/usr/src/${PACKAGE_NAME}"
    log_success "Header files removed"
fi

################################################################################
# Step 4: Clean up package database
################################################################################

log "Step 4: Cleaning up package database..."

# Configure pending packages
log "Configuring pending packages..."
if dpkg --configure -a 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Package configuration completed"
else
    log_warning "Some packages may have configuration issues (non-fatal)"
fi

# Fix broken dependencies
log "Fixing broken dependencies..."
if apt-get install -f -y 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Dependencies fixed"
else
    log_warning "Dependency fix had issues (non-fatal)"
fi

# Clean package cache
log "Cleaning package cache..."
apt-get clean 2>&1 | tee -a "$LOG_FILE"
apt-get autoclean -y 2>&1 | tee -a "$LOG_FILE"
log_success "Package cache cleaned"

################################################################################
# Step 5: Reinstall the package
################################################################################

log "Step 5: Reinstalling package: $PACKAGE_NAME..."

# Update package lists
log "Updating package lists..."
if apt-get update 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Package lists updated"
else
    log_error "Failed to update package lists"
    exit 1
fi

# Install the package
log "Installing $PACKAGE_NAME..."
if apt-get install -y "$PACKAGE_NAME" 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Package installed successfully"
else
    log_error "Failed to install package"
    log "Check the log file for details: $LOG_FILE"
    exit 1
fi

################################################################################
# Step 6: Verify installation
################################################################################

log "Step 6: Verifying installation..."

# Check dpkg status
if dpkg -l | grep -q "$PACKAGE_NAME"; then
    PACKAGE_STATUS=$(dpkg -l | grep "$PACKAGE_NAME" | awk '{print $1}')
    if [ "$PACKAGE_STATUS" = "ii" ]; then
        log_success "Package status: Installed correctly (ii)"
    else
        log_warning "Package status: $PACKAGE_STATUS (expected 'ii')"
    fi
else
    log_error "Package not found in dpkg database after installation"
    exit 1
fi

# Check header files
if [ -d "/usr/src/${PACKAGE_NAME}" ]; then
    HEADER_COUNT=$(find "/usr/src/${PACKAGE_NAME}" -type f | wc -l)
    log_success "Header files present: $HEADER_COUNT files in /usr/src/${PACKAGE_NAME}"
else
    log_warning "Header directory not found at /usr/src/${PACKAGE_NAME}"
fi

################################################################################
# Completion
################################################################################

echo ""
log_success "================================================================"
log_success "Proxmox headers fix completed successfully!"
log_success "================================================================"
echo ""
log "Summary:"
log "  Package: $PACKAGE_NAME"
log "  Status: Installed"
log "  Log file: $LOG_FILE"
echo ""
log "Next steps:"
log "  1. You can now proceed with kernel updates"
log "  2. Check system status: pveversion"
log "  3. Review the log file if needed: cat $LOG_FILE"
echo ""

exit 0
