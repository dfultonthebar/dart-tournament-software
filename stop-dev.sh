#!/bin/bash

# Stop script for Dart Tournament Software development environment

set -e  # Exit on error

# Configuration
SESSION_NAME="dart-tournament-dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    log_error "tmux is not installed."
    exit 1
fi

# Check if session exists
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    log_warn "Session '$SESSION_NAME' is not running."
    exit 0
fi

log_info "Stopping development environment..."

# Kill the tmux session
tmux kill-session -t "$SESSION_NAME"

log_info "✓ Development environment stopped successfully!"

# Optional: Kill any lingering processes on the ports
log_info "Checking for lingering processes..."

PORTS=(8000 3001 3002 3003)
KILLED_ANY=false

for port in "${PORTS[@]}"; do
    # Find process using the port
    PID=$(lsof -ti:$port 2>/dev/null || true)

    if [ -n "$PID" ]; then
        log_warn "Found process on port $port (PID: $PID). Killing..."
        kill -9 $PID 2>/dev/null || true
        KILLED_ANY=true
    fi
done

if [ "$KILLED_ANY" = true ]; then
    log_info "✓ Cleaned up lingering processes"
else
    log_info "No lingering processes found"
fi

log_info ""
log_info "All services stopped. You can restart with: ./start-dev.sh"
