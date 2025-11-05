#!/bin/bash

# Development startup script using tmux
# Starts all services in separate tmux panes

set -e

SESSION_NAME="dart-tournament"

# Check if tmux session already exists
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
  echo "Session $SESSION_NAME already exists. Attaching..."
  tmux attach-session -t $SESSION_NAME
  exit 0
fi

# Create new tmux session
echo "Starting WAMO Dart Tournament development environment..."

# Start tmux session with backend
tmux new-session -d -s $SESSION_NAME -n "Backend"
tmux send-keys -t $SESSION_NAME:0 "cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000" C-m

# Create window for scoring terminal
tmux new-window -t $SESSION_NAME:1 -n "Scoring"
tmux send-keys -t $SESSION_NAME:1 "cd scoring-terminal && npm run dev" C-m

# Create window for display terminal
tmux new-window -t $SESSION_NAME:2 -n "Display"
tmux send-keys -t $SESSION_NAME:2 "cd display-terminal && npm run dev" C-m

# Create window for mobile app
tmux new-window -t $SESSION_NAME:3 -n "Mobile"
tmux send-keys -t $SESSION_NAME:3 "cd mobile-app && npm run dev" C-m

# Create window for logs
tmux new-window -t $SESSION_NAME:4 -n "Logs"
tmux send-keys -t $SESSION_NAME:4 "echo 'Service Logs'" C-m

# Attach to session
echo ""
echo "Development environment started!"
echo ""
echo "Services:"
echo "  - Backend API: http://localhost:8000"
echo "  - Scoring Terminal: http://localhost:3001"
echo "  - Display Terminal: http://localhost:3002"
echo "  - Mobile App: http://localhost:3003"
echo ""
echo "tmux commands:"
echo "  - Switch windows: Ctrl-b then window number (0-4)"
echo "  - Detach: Ctrl-b then d"
echo "  - Kill session: tmux kill-session -t $SESSION_NAME"
echo ""
echo "Attaching to session..."
sleep 2

tmux attach-session -t $SESSION_NAME
