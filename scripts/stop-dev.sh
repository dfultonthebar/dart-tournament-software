#!/bin/bash

# Stop development environment

SESSION_NAME="dart-tournament"

if tmux has-session -t $SESSION_NAME 2>/dev/null; then
  echo "Stopping $SESSION_NAME development environment..."
  tmux kill-session -t $SESSION_NAME
  echo "Development environment stopped."
else
  echo "No active $SESSION_NAME session found."
fi
