#!/bin/bash

# Production startup script for Dart Tournament Software
# Builds all frontends first, then runs production servers in tmux
# Use this for running actual tournaments (stable, no cache corruption)
# Use start-dev.sh instead when actively writing code (hot-reload)

set -e

# Configuration
SESSION_NAME="dart-tournament"
PROJECT_DIR="$HOME/DartTournament"
BACKEND_DIR="$PROJECT_DIR/backend"
SCORING_DIR="$PROJECT_DIR/scoring-terminal"
DISPLAY_DIR="$PROJECT_DIR/display-terminal"
MOBILE_DIR="$PROJECT_DIR/mobile-app"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check dependencies
if ! command -v tmux &> /dev/null; then
    log_error "tmux is not installed."
    exit 1
fi

# Kill any existing sessions (both dev and prod)
for sess in "dart-tournament-dev" "dart-tournament"; do
    if tmux has-session -t "$sess" 2>/dev/null; then
        log_warn "Killing existing session '$sess'..."
        tmux kill-session -t "$sess"
    fi
done

# Kill anything on our ports
for port in 8000 3001 3002 3003; do
    PID=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$PID" ]; then
        log_warn "Killing process on port $port (PID: $PID)"
        kill -9 $PID 2>/dev/null || true
    fi
done

sleep 1

# Verify directories
for dir in "$BACKEND_DIR" "$SCORING_DIR" "$DISPLAY_DIR" "$MOBILE_DIR"; do
    if [ ! -d "$dir" ]; then
        log_error "Directory not found: $dir"
        exit 1
    fi
done

# Clean stale caches and build all frontends
log_info "Building frontends for production..."
log_info ""

for app_dir in "$SCORING_DIR" "$DISPLAY_DIR" "$MOBILE_DIR"; do
    app_name=$(basename "$app_dir")
    log_info "Building $app_name..."
    rm -rf "$app_dir/.next"
    (cd "$app_dir" && npx next build) || {
        log_error "Build failed for $app_name"
        exit 1
    }
    log_info "  $app_name built successfully"
done

log_info ""
log_info "All builds complete. Starting production servers..."
log_info ""

# Create tmux session with backend (use -c to set working directory reliably)
tmux new-session -d -s "$SESSION_NAME" -n "backend" -c "$PROJECT_DIR"
tmux send-keys -t "$SESSION_NAME:backend" "source backend/venv/bin/activate && export PYTHONPATH=$PROJECT_DIR:\$PYTHONPATH && uvicorn backend.main:app --host 0.0.0.0 --port 8000" C-m

# Scoring terminal — production (npx next start, not npm start, to avoid workspace issues)
tmux new-window -t "$SESSION_NAME" -n "scoring" -c "$SCORING_DIR"
tmux send-keys -t "$SESSION_NAME:scoring" "npx next start -p 3001" C-m

# Display terminal — production
tmux new-window -t "$SESSION_NAME" -n "display" -c "$DISPLAY_DIR"
tmux send-keys -t "$SESSION_NAME:display" "npx next start -p 3002" C-m

# Mobile app — production
tmux new-window -t "$SESSION_NAME" -n "mobile" -c "$MOBILE_DIR"
tmux send-keys -t "$SESSION_NAME:mobile" "npx next start -p 3003" C-m

# Monitoring window
tmux new-window -t "$SESSION_NAME" -n "monitor" -c "$PROJECT_DIR"
tmux send-keys -t "$SESSION_NAME:monitor" "clear" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo '=== Dart Tournament — PRODUCTION MODE ==='" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo ''" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo 'Services:'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo '  Backend API:       http://localhost:8000'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo '  Scoring Terminal:  http://localhost:3001'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo '  Display Terminal:  http://localhost:3002'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo '  Mobile App:        http://localhost:3003'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo ''" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo 'This is PRODUCTION mode — no hot-reload.'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo 'To stop: ./stop-prod.sh'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo 'For development: ./start-dev.sh'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo ''" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "sleep 5 && curl -s http://localhost:8000/health &>/dev/null && echo 'Backend is ready!' || echo 'Backend not responding yet...'" C-m

tmux select-window -t "$SESSION_NAME:monitor"

log_info ""
log_info "Production environment started!"
log_info ""
log_info "  Backend API:       http://localhost:8000"
log_info "  Scoring Terminal:  http://localhost:3001"
log_info "  Display Terminal:  http://localhost:3002"
log_info "  Mobile App:        http://localhost:3003"
log_info ""
log_info "To stop: ./stop-prod.sh"
log_info ""

sleep 2
tmux attach-session -t "$SESSION_NAME"
