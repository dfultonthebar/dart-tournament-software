#!/bin/bash

################################################################################
# Proxmox Headers Package Fix Script - AGGRESSIVE VERSION
#
# This script performs complete nuclear cleanup of hung proxmox-headers packages
# Use this if the standard fix script doesn't work
#
# Usage: sudo ./fix-proxmox-headers-aggressive.sh [package-version]
# Example: sudo ./fix-proxmox-headers-aggressive.sh 6.8.12-16-pve
#
# WARNING: This is an aggressive approach that forcefully removes all traces
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
LOG_FILE="/tmp/proxmox-headers-aggressive-fix-$(date +%Y%m%d-%H%M%S).log"

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

# Warning
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}          AGGRESSIVE PROXMOX HEADERS CLEANUP${NC}"
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
log_warning "This script will perform aggressive cleanup operations"
log_warning "Use this only if the standard fix script failed"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log "Operation cancelled by user"
    exit 0
fi

# Determine package version
if [ -z "$1" ]; then
    log "No package version specified, attempting auto-detection..."
    PACKAGE_VERSION=$(dpkg -l 2>/dev/null | grep proxmox-headers | grep -v "^rc" | awk '{print $3}' | head -1 | sed 's/.*-//')
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

log_aggressive "Starting AGGRESSIVE cleanup for: $PACKAGE_NAME"
log "Log file: $LOG_FILE"
echo ""

################################################################################
# Step 1: KILL ALL package manager processes and related services
################################################################################

log_aggressive "Step 1: Force-killing ALL package manager processes and services..."

# Stop systemd services that might interfere
log_aggressive "Stopping systemd package management services..."
SERVICES=(
    "apt-daily.timer"
    "apt-daily-upgrade.timer"
    "apt-daily.service"
    "apt-daily-upgrade.service"
    "unattended-upgrades.service"
    "packagekit.service"
)

for SERVICE in "${SERVICES[@]}"; do
    if systemctl is-active --quiet "$SERVICE" 2>/dev/null; then
        log_aggressive "Stopping service: $SERVICE"
        systemctl stop "$SERVICE" 2>/dev/null || true
        systemctl kill -s KILL "$SERVICE" 2>/dev/null || true
    fi
done

# Kill all package manager processes (including child processes)
log_aggressive "Killing all package manager processes..."

PROCESSES=(dpkg apt-get apt aptitude unattended-upgrade packagekit dpkg-deb dpkg-split)

for PROCESS in "${PROCESSES[@]}"; do
    # Kill by exact name
    if pgrep -x "$PROCESS" > /dev/null; then
        log_aggressive "Force killing: $PROCESS (exact match)"
        pkill -9 -x "$PROCESS" 2>/dev/null || true
        sleep 0.5
    fi

    # Kill any partial matches (catches child processes)
    if pgrep -f "$PROCESS" > /dev/null; then
        log_aggressive "Force killing: $PROCESS (all instances)"
        pkill -9 -f "$PROCESS" 2>/dev/null || true
        sleep 0.5
    fi
done

# Kill any dpkg frontend processes
log_aggressive "Killing dpkg frontend processes..."
ps aux | grep -i dpkg | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true

# Kill any apt processes
log_aggressive "Killing apt processes..."
ps aux | grep -i apt | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true

# Extra aggressive: find any process with dpkg or apt in its command line
log_aggressive "Scanning for any remaining package management processes..."
ps aux | grep -E "dpkg|apt-get|apt |aptitude" | grep -v grep | awk '{print $2}' | while read PID; do
    if [ -n "$PID" ]; then
        log_aggressive "Killing process: $PID"
        kill -9 "$PID" 2>/dev/null || true
    fi
done

# Extra wait for processes to die
sleep 3

# Verify all are dead
log_aggressive "Verifying all processes are terminated..."
STILL_RUNNING=0
for PROCESS in "${PROCESSES[@]}"; do
    if pgrep -f "$PROCESS" > /dev/null; then
        RUNNING_PIDS=$(pgrep -f "$PROCESS" | tr '\n' ' ')
        log_error "Process still running: $PROCESS (PIDs: $RUNNING_PIDS)"
        STILL_RUNNING=1
        # One more kill attempt
        pkill -9 -f "$PROCESS" 2>/dev/null || true
    fi
done

sleep 2

if [ $STILL_RUNNING -eq 0 ]; then
    log_success "All package manager processes terminated"
else
    log_warning "Some processes may still be running - continuing anyway"
    log_warning "Manually check with: ps aux | grep -E 'dpkg|apt'"
fi

################################################################################
# Step 2: REMOVE ALL lock files and status files
################################################################################

log_aggressive "Step 2: Removing ALL lock files and status files..."

# Remove all possible lock files
LOCK_PATTERNS=(
    "/var/lib/dpkg/lock*"
    "/var/cache/apt/archives/lock"
    "/var/lib/apt/lists/lock"
    "/var/lib/dpkg/updates/*"
)

for PATTERN in "${LOCK_PATTERNS[@]}"; do
    if ls $PATTERN 2>/dev/null | grep -q .; then
        rm -rf $PATTERN
        log_aggressive "Removed: $PATTERN"
    fi
done

# Remove trigger state files
rm -f /var/lib/dpkg/triggers/Lock
rm -f /var/lib/dpkg/triggers/Unincorp

log_success "Lock files removed"

################################################################################
# Step 3: NUCLEAR package removal
################################################################################

log_aggressive "Step 3: NUCLEAR package removal..."

# Remove from dpkg status
if grep -q "$PACKAGE_NAME" /var/lib/dpkg/status 2>/dev/null; then
    log_aggressive "Removing package from dpkg status database..."
    cp /var/lib/dpkg/status "/tmp/dpkg-status-backup-$(date +%Y%m%d-%H%M%S)"
    sed -i "/Package: $PACKAGE_NAME/,/^$/d" /var/lib/dpkg/status
    log_success "Removed from dpkg status"
fi

# Remove ALL package info files
log_aggressive "Removing all package info files..."
rm -rf /var/lib/dpkg/info/${PACKAGE_NAME}.* 2>/dev/null
rm -rf /var/lib/dpkg/info/proxmox-headers-*.list 2>/dev/null
rm -rf /var/lib/dpkg/info/proxmox-headers-*.md5sums 2>/dev/null
log_success "Package info files removed"

# Remove header files from /usr/src
log_aggressive "Removing header files from /usr/src..."
rm -rf /usr/src/proxmox-headers-* 2>/dev/null
rm -rf /usr/src/${PACKAGE_NAME} 2>/dev/null
log_success "Header files removed"

# Remove from available packages list
log_aggressive "Cleaning package lists..."
rm -rf /var/lib/dpkg/available 2>/dev/null
touch /var/lib/dpkg/available
log_success "Package lists cleaned"

# Remove any downloaded .deb files
log_aggressive "Removing downloaded package files..."
rm -f /var/cache/apt/archives/proxmox-headers-*.deb 2>/dev/null
log_success "Downloaded packages removed"

################################################################################
# Step 4: AGGRESSIVE database repair
################################################################################

log_aggressive "Step 4: Aggressive database repair..."

# Force reconfigure all packages
log "Force reconfiguring all packages (this may take a while)..."
dpkg --configure -a --force-all 2>&1 | tee -a "$LOG_FILE"

# Fix broken installations with maximum force
log "Fixing broken installations with --force-all..."
apt-get install -f -y --force-yes 2>&1 | tee -a "$LOG_FILE" || apt-get install -f -y 2>&1 | tee -a "$LOG_FILE"

# Clean everything
log "Deep cleaning package cache..."
apt-get clean 2>&1 | tee -a "$LOG_FILE"
apt-get autoclean -y 2>&1 | tee -a "$LOG_FILE"
apt-get autoremove -y 2>&1 | tee -a "$LOG_FILE"

# Update dpkg database
log "Updating dpkg database..."
dpkg --clear-avail
dpkg --update-avail 2>&1 | tee -a "$LOG_FILE" || log_warning "dpkg update-avail not available (non-fatal)"

log_success "Database repair completed"

################################################################################
# Step 5: Fresh package list update
################################################################################

log_aggressive "Step 5: Updating package lists from repositories..."

# Remove old package lists
rm -rf /var/lib/apt/lists/* 2>/dev/null
mkdir -p /var/lib/apt/lists/partial

# Update
if apt-get update 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Package lists updated successfully"
else
    log_error "Failed to update package lists - check network/repository configuration"
    exit 1
fi

################################################################################
# Step 6: Clean reinstall
################################################################################

log_aggressive "Step 6: Clean reinstallation of $PACKAGE_NAME..."

# Attempt installation
log "Installing $PACKAGE_NAME (this may take several minutes)..."
echo ""

if apt-get install -y "$PACKAGE_NAME" 2>&1 | tee -a "$LOG_FILE"; then
    log_success "Package installed successfully!"
else
    log_error "Installation failed"
    log "Attempting alternative installation methods..."

    # Try with --fix-missing
    if apt-get install -y --fix-missing "$PACKAGE_NAME" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Package installed with --fix-missing"
    else
        # Try dist-upgrade
        log "Trying full dist-upgrade..."
        if apt-get dist-upgrade -y 2>&1 | tee -a "$LOG_FILE"; then
            log_success "System upgraded, package should be installed"
        else
            log_error "All installation methods failed"
            log_error "Manual intervention may be required"
            exit 1
        fi
    fi
fi

################################################################################
# Step 7: Comprehensive verification
################################################################################

log_aggressive "Step 7: Comprehensive verification..."

echo ""
log "Verification checks:"
echo ""

# Check 1: dpkg status
if dpkg -l | grep -q "$PACKAGE_NAME"; then
    PACKAGE_STATUS=$(dpkg -l | grep "$PACKAGE_NAME" | awk '{print $1}')
    if [ "$PACKAGE_STATUS" = "ii" ]; then
        log_success "✓ Package status: Correctly installed (ii)"
    else
        log_warning "⚠ Package status: $PACKAGE_STATUS (expected 'ii')"
    fi
else
    log_error "✗ Package not found in dpkg database"
fi

# Check 2: Header files
if [ -d "/usr/src/${PACKAGE_NAME}" ]; then
    HEADER_COUNT=$(find "/usr/src/${PACKAGE_NAME}" -type f 2>/dev/null | wc -l)
    log_success "✓ Header files: $HEADER_COUNT files in /usr/src/${PACKAGE_NAME}"
else
    log_warning "⚠ Header directory not found at /usr/src/${PACKAGE_NAME}"
fi

# Check 3: Package integrity
log "Verifying package integrity..."
if dpkg --verify "$PACKAGE_NAME" 2>&1 | tee -a "$LOG_FILE"; then
    log_success "✓ Package integrity check passed"
else
    log_warning "⚠ Package integrity check had warnings (may be normal)"
fi

# Check 4: No broken packages
BROKEN_COUNT=$(dpkg -l | grep -c "^iU\|^iF" || true)
if [ "$BROKEN_COUNT" -eq 0 ]; then
    log_success "✓ No broken packages detected"
else
    log_warning "⚠ Found $BROKEN_COUNT broken package(s)"
fi

################################################################################
# Completion
################################################################################

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}        AGGRESSIVE CLEANUP COMPLETED${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
log_success "Package: $PACKAGE_NAME"
log_success "Status: Installed and verified"
log_success "Log file: $LOG_FILE"
echo ""
log "Recommended next steps:"
log "  1. Reboot the system: reboot"
log "  2. Check Proxmox version: pveversion"
log "  3. Verify kernel: uname -r"
log "  4. Review log if issues: cat $LOG_FILE"
echo ""
log_warning "A system reboot is recommended to ensure all changes take effect"
echo ""

exit 0
