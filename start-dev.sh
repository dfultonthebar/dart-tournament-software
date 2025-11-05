#!/bin/bash

# Development startup script for Dart Tournament Software
# Uses tmux to manage multiple development servers

set -e  # Exit on error

# Configuration
SESSION_NAME="dart-tournament-dev"
BACKEND_DIR="$HOME/dart-tournament-software/backend"
SCORING_DIR="$HOME/dart-tournament-software/scoring-terminal"
DISPLAY_DIR="$HOME/dart-tournament-software/display-terminal"
MOBILE_DIR="$HOME/dart-tournament-software/mobile-app"

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
    log_error "tmux is not installed. Please install it first:"
    echo "  Ubuntu/Debian: sudo apt-get install tmux"
    echo "  macOS: brew install tmux"
    exit 1
fi

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    log_warn "Session '$SESSION_NAME' already exists."
    read -p "Do you want to kill it and start fresh? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Killing existing session..."
        tmux kill-session -t "$SESSION_NAME"
    else
        log_info "Attaching to existing session..."
        tmux attach-session -t "$SESSION_NAME"
        exit 0
    fi
fi

# Verify directories exist
for dir in "$BACKEND_DIR" "$SCORING_DIR" "$DISPLAY_DIR" "$MOBILE_DIR"; do
    if [ ! -d "$dir" ]; then
        log_error "Directory not found: $dir"
        exit 1
    fi
done

# Check if backend venv exists
if [ ! -d "$BACKEND_DIR/venv" ]; then
    log_error "Backend virtual environment not found at $BACKEND_DIR/venv"
    log_error "Please create it first: cd $BACKEND_DIR && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Check if node_modules exist for frontends
log_info "Checking frontend dependencies..."
for dir in "$SCORING_DIR" "$DISPLAY_DIR" "$MOBILE_DIR"; do
    if [ ! -d "$dir/node_modules" ]; then
        log_warn "node_modules not found in $(basename $dir)"
        log_info "Installing dependencies for $(basename $dir)..."
        (cd "$dir" && npm install) || {
            log_error "Failed to install dependencies for $(basename $dir)"
            exit 1
        }
    fi
done

log_info "Starting development environment..."

# Create new tmux session with backend
log_info "Creating tmux session: $SESSION_NAME"
tmux new-session -d -s "$SESSION_NAME" -n "backend"

# Setup backend window
log_info "Setting up backend (port 8000)..."
tmux send-keys -t "$SESSION_NAME:backend" "cd $HOME/dart-tournament-software" C-m
tmux send-keys -t "$SESSION_NAME:backend" "source backend/venv/bin/activate" C-m
tmux send-keys -t "$SESSION_NAME:backend" "export PYTHONPATH=$HOME/dart-tournament-software:\$PYTHONPATH" C-m
tmux send-keys -t "$SESSION_NAME:backend" "echo 'Starting Backend API on http://localhost:8000'" C-m
tmux send-keys -t "$SESSION_NAME:backend" "uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000" C-m

# Create scoring terminal window
log_info "Setting up scoring terminal (port 3001)..."
tmux new-window -t "$SESSION_NAME" -n "scoring"
tmux send-keys -t "$SESSION_NAME:scoring" "cd $SCORING_DIR" C-m
tmux send-keys -t "$SESSION_NAME:scoring" "echo 'Starting Scoring Terminal on http://localhost:3001'" C-m
tmux send-keys -t "$SESSION_NAME:scoring" "npm run dev" C-m

# Create display terminal window
log_info "Setting up display terminal (port 3002)..."
tmux new-window -t "$SESSION_NAME" -n "display"
tmux send-keys -t "$SESSION_NAME:display" "cd $DISPLAY_DIR" C-m
tmux send-keys -t "$SESSION_NAME:display" "echo 'Starting Display Terminal on http://localhost:3002'" C-m
tmux send-keys -t "$SESSION_NAME:display" "npm run dev" C-m

# Create mobile app window
log_info "Setting up mobile app (port 3003)..."
tmux new-window -t "$SESSION_NAME" -n "mobile"
tmux send-keys -t "$SESSION_NAME:mobile" "cd $MOBILE_DIR" C-m
tmux send-keys -t "$SESSION_NAME:mobile" "echo 'Starting Mobile App on http://localhost:3003'" C-m
tmux send-keys -t "$SESSION_NAME:mobile" "npm run dev" C-m

# Create a monitoring window
log_info "Setting up monitoring window..."
tmux new-window -t "$SESSION_NAME" -n "monitor"
tmux send-keys -t "$SESSION_NAME:monitor" "cd $HOME/dart-tournament-software" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "clear" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo '=== Dart Tournament Development Environment ==='" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo ''" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo 'Services running:'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo '  Backend API:       http://localhost:8000'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo '  Scoring Terminal:  http://localhost:3001'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo '  Display Terminal:  http://localhost:3002'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo '  Mobile App:        http://localhost:3003'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo ''" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo 'Tmux commands:'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo '  Switch windows:    Ctrl+b then 0-4 (or n/p for next/prev)'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo '  Detach session:    Ctrl+b then d'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo '  Stop all:          ./stop-dev.sh'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo ''" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "echo 'Waiting for services to start...'" C-m
tmux send-keys -t "$SESSION_NAME:monitor" "sleep 5 && curl -s http://localhost:8000/health &>/dev/null && echo 'Backend is ready!' || echo 'Backend not responding yet...'" C-m

# Select the monitoring window
tmux select-window -t "$SESSION_NAME:monitor"

# Attach to session
log_info ""
log_info "✓ Development environment started successfully!"
log_info ""
log_info "Services:"
log_info "  Backend API:       http://localhost:8000"
log_info "  Scoring Terminal:  http://localhost:3001"
log_info "  Display Terminal:  http://localhost:3002"
log_info "  Mobile App:        http://localhost:3003"
log_info ""
log_info "Attaching to tmux session..."
log_info "To detach: Ctrl+b then d"
log_info "To stop all: ./stop-dev.sh"
log_info ""

sleep 2
tmux attach-session -t "$SESSION_NAME"
