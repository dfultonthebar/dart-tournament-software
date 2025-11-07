# Proxmox Headers Fix Scripts

This directory contains two scripts to fix hung or broken Proxmox kernel header installations.

## Problem Description

When running `apt-get upgrade` on a Proxmox server, the `proxmox-headers` package installation may hang during:
- Unpacking
- Extracting templates
- Configuration

This typically happens with packages like `proxmox-headers-6.8.12-16-pve`.

## Available Scripts

### 1. `fix-proxmox-headers.sh` (Standard Fix)

**Use this first** - A safer approach that attempts graceful cleanup before forceful removal.

**Features:**
- Kills hung package manager processes
- Removes lock files
- Attempts normal package removal
- Falls back to forced removal if needed
- Cleans package database
- Reinstalls the package
- Comprehensive verification

**Usage:**
```bash
# Auto-detect version
sudo ./fix-proxmox-headers.sh

# Or specify version
sudo ./fix-proxmox-headers.sh 6.8.12-16-pve
```

### 2. `fix-proxmox-headers-aggressive.sh` (Nuclear Option)

**Use if the standard fix fails** - An aggressive cleanup that completely removes all traces and reinstalls.

**Features:**
- Stops all systemd package management services
- Force-kills all package manager processes (dpkg, apt, unattended-upgrades, etc.)
- Removes ALL lock files and state files
- Manually edits dpkg database to remove package entries
- Removes all package info files
- Performs complete database rebuild
- Fresh installation from repositories

**Usage:**
```bash
# Auto-detect version
sudo ./fix-proxmox-headers-aggressive.sh

# Or specify version
sudo ./fix-proxmox-headers-aggressive.sh 6.8.12-16-pve
```

**⚠️ WARNING:** This script is aggressive and should only be used if the standard fix doesn't work.

## How to Use on Proxmox Server

### Option 1: Direct Download from GitHub

```bash
# Navigate to /root or /tmp
cd /root

# Download standard fix script
wget https://raw.githubusercontent.com/dfultonthebar/dart-tournament-software/claude/proxmox-kernel-update-011CUsabQjgihPwfVYjxdHV6/scripts/fix-proxmox-headers.sh

# Download aggressive fix script
wget https://raw.githubusercontent.com/dfultonthebar/dart-tournament-software/claude/proxmox-kernel-update-011CUsabQjgihPwfVYjxdHV6/scripts/fix-proxmox-headers-aggressive.sh

# Make executable
chmod +x fix-proxmox-headers.sh fix-proxmox-headers-aggressive.sh

# Run the standard fix first
sudo ./fix-proxmox-headers.sh
```

### Option 2: Copy from Repository

If you have this repository cloned:

```bash
# Copy scripts to Proxmox server
scp scripts/fix-proxmox-headers*.sh root@your-proxmox-server:/root/

# SSH to Proxmox server
ssh root@your-proxmox-server

# Run the standard fix
cd /root
sudo ./fix-proxmox-headers.sh
```

### Option 3: Create Manually

You can also create the scripts manually on the Proxmox server:

```bash
# Create the script file
nano /root/fix-proxmox-headers-aggressive.sh

# Paste the script content
# (Copy from the .sh files in this directory)

# Make executable
chmod +x /root/fix-proxmox-headers-aggressive.sh

# Run it
sudo ./fix-proxmox-headers-aggressive.sh
```

## Recommended Workflow

### Step 1: Identify the Problem

Check if you have a hung installation:
```bash
# Check running processes
ps aux | grep -E 'dpkg|apt'

# Check locks
ls -la /var/lib/dpkg/lock*

# Check installation status
dpkg -l | grep proxmox-headers
```

### Step 2: Try Standard Fix First

```bash
sudo ./fix-proxmox-headers.sh
```

**Expected output:**
- Kills any hung processes
- Removes locks
- Removes broken package
- Reinstalls successfully
- Verification passes

### Step 3: If Standard Fix Fails, Use Aggressive Fix

```bash
sudo ./fix-proxmox-headers-aggressive.sh
```

**This will:**
- Stop all systemd services that might interfere
- Force-kill ALL package manager processes
- Completely remove package from dpkg database
- Remove all package files manually
- Rebuild package database
- Fresh installation

### Step 4: Verify and Reboot

```bash
# Check package status
dpkg -l | grep proxmox-headers

# Verify headers installed
ls -la /usr/src/ | grep proxmox

# Check Proxmox version
pveversion

# Reboot to apply changes
reboot
```

## Troubleshooting

### Script says "Package not found"

The package version might be different. Check available versions:
```bash
apt-cache search proxmox-headers
dpkg -l | grep proxmox-headers
```

Then run with specific version:
```bash
sudo ./fix-proxmox-headers.sh YOUR-VERSION-HERE
```

### "Permission denied" error

Make sure you're running as root:
```bash
sudo -i
./fix-proxmox-headers.sh
```

### Installation still hangs

1. Check disk space: `df -h`
2. Check for I/O issues: `iostat -x 2 5`
3. Check network (if pulling from repos): `ping 8.8.8.8`
4. Try the aggressive script

### "Repository not available" error

Update your Proxmox repository configuration:
```bash
# Check repository configuration
cat /etc/apt/sources.list.d/pve-enterprise.list

# If using community repo, ensure it's configured
nano /etc/apt/sources.list.d/pve-no-subscription.list
# Add: deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription

# Update
apt-get update
```

## What Gets Modified

### Standard Fix
- Kills: dpkg, apt-get, apt processes
- Removes: Lock files in /var/lib/dpkg/ and /var/cache/apt/
- Modifies: dpkg database (removes broken package entry)
- Cleans: Package cache

### Aggressive Fix
- Stops: apt-daily, unattended-upgrades systemd services
- Kills: All package manager processes and child processes
- Removes:
  - All lock files
  - Package info files in /var/lib/dpkg/info/
  - Package entries in /var/lib/dpkg/status
  - Header files in /usr/src/
  - Downloaded .deb files
- Rebuilds: Complete dpkg database

## Logs

Both scripts create detailed logs in `/tmp/`:
- Standard: `/tmp/proxmox-headers-fix-YYYYMMDD-HHMMSS.log`
- Aggressive: `/tmp/proxmox-headers-aggressive-fix-YYYYMMDD-HHMMSS.log`

Check logs if something goes wrong:
```bash
# Find latest log
ls -ltr /tmp/proxmox-headers*.log | tail -1

# View log
cat /tmp/proxmox-headers-fix-YYYYMMDD-HHMMSS.log
```

## Safety Notes

1. **Backup First**: If possible, backup or snapshot your Proxmox system before running aggressive fixes
2. **Standard First**: Always try the standard fix before the aggressive one
3. **Running System**: Both scripts can be run on a live system, but it's safer with no VMs running
4. **Reboot Recommended**: After successful fix, reboot is recommended
5. **Logs Available**: All operations are logged for troubleshooting

## Post-Fix Verification

After running either script:

```bash
# 1. Check package is installed
dpkg -l | grep proxmox-headers
# Should show: ii  proxmox-headers-X.X.X

# 2. Verify header files exist
ls /usr/src/proxmox-headers-*/
# Should show kernel header files

# 3. Check for broken packages
dpkg -l | grep -E '^iU|^iF'
# Should return nothing (no broken packages)

# 4. Verify system health
pveversion -v
# Should show all component versions

# 5. Test package management works
apt-get update
apt-get upgrade -s
# Should complete without hanging
```

## Common Scenarios

### Scenario 1: Update Hung During Initial Unpack
**Symptom:** `apt-get upgrade` hangs at "Unpacking proxmox-headers..."

**Solution:**
```bash
sudo ./fix-proxmox-headers.sh
```

### Scenario 2: Multiple Failed Installation Attempts
**Symptom:** Package shows as "iU" (unpacked but not configured) or "iF" (failed)

**Solution:**
```bash
sudo ./fix-proxmox-headers-aggressive.sh
```

### Scenario 3: Lock File Errors
**Symptom:** "Could not get lock /var/lib/dpkg/lock-frontend"

**Solution:**
```bash
# Either script will fix this
sudo ./fix-proxmox-headers.sh
```

## Support

If both scripts fail:
1. Check the log files in `/tmp/`
2. Verify network connectivity to Proxmox repositories
3. Check available disk space
4. Review `/var/log/apt/term.log` for apt errors
5. Consider posting to Proxmox forums with log output

## Script Locations in Repository

- Standard Fix: `scripts/fix-proxmox-headers.sh`
- Aggressive Fix: `scripts/fix-proxmox-headers-aggressive.sh`
- This Documentation: `scripts/PROXMOX_HEADERS_FIX_README.md`

## Author Notes

These scripts were created to address a common issue where Proxmox kernel header packages hang during installation, particularly on systems with limited I/O or during repository synchronization issues. The aggressive script should be used sparingly and only when the standard approach fails.

**Last Updated:** 2025-11-07
