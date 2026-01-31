#!/bin/bash

# Stop script for Dart Tournament Software production environment

SESSION_NAME="dart-tournament"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }

if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    log_warn "Session '$SESSION_NAME' is not running."
    exit 0
fi

log_info "Stopping production environment..."
tmux kill-session -t "$SESSION_NAME"

# Clean up lingering processes
KILLED_ANY=false
for port in 8000 3001 3002 3003; do
    PID=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$PID" ]; then
        log_warn "Killing process on port $port (PID: $PID)"
        kill -9 $PID 2>/dev/null || true
        KILLED_ANY=true
    fi
done

if [ "$KILLED_ANY" = true ]; then
    log_info "Cleaned up lingering processes"
fi

log_info ""
log_info "Production environment stopped."
log_info "To restart: ./start-prod.sh"
log_info "For development: ./start-dev.sh"
