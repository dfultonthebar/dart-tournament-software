# Development Scripts

This directory contains helper scripts for the Dart Tournament Software project.

## Available Scripts (in project root)

### `./start-dev.sh`
Starts all development services in a tmux session:
- Backend API (port 8000)
- Scoring Terminal (port 3001)
- Display Terminal (port 3002)
- Mobile App (port 3003)
- Monitoring window

**Features:**
- Automatic dependency installation if needed
- Error checking and validation
- Colored output and progress indicators
- Creates persistent tmux session for easy management

### `./stop-dev.sh`
Cleanly stops all development services:
- Kills the tmux session
- Terminates any lingering processes on development ports
- Ensures clean shutdown

### `./test-system.sh`
Comprehensive system health check:
- Validates environment configuration
- Tests backend API connectivity
- Verifies database connection
- Checks all required database tables
- Tests API endpoint accessibility

**Exit codes:**
- `0` - All tests passed
- `1` - One or more tests failed

## Usage Examples

### Start Development

```bash
# Start all services
./start-dev.sh

# Detach from tmux session (keep services running)
# Press: Ctrl+b then d

# Reattach to session
tmux attach -t dart-tournament-dev
```

### Stop Development

```bash
# Stop all services
./stop-dev.sh
```

### Run Tests

```bash
# Test system health
./test-system.sh

# Test with backend running (more comprehensive)
./start-dev.sh  # In another terminal
./test-system.sh
```

## Tmux Quick Reference

When attached to the development session:

| Command | Action |
|---------|--------|
| `Ctrl+b` then `0-4` | Switch to window 0-4 |
| `Ctrl+b` then `n` | Next window |
| `Ctrl+b` then `p` | Previous window |
| `Ctrl+b` then `w` | List windows |
| `Ctrl+b` then `d` | Detach session |
| `Ctrl+b` then `[` | Scroll mode (q to exit) |

## Troubleshooting

### Tmux session won't start
```bash
./stop-dev.sh  # Kill existing session
./start-dev.sh  # Start fresh
```

### Port already in use
```bash
./stop-dev.sh  # Will kill processes on dev ports
```

### Frontend dependencies missing
The start script will automatically run `npm install` if `node_modules` is missing.

### Backend venv missing
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Script Locations

All main development scripts are in the project root:
- `/home/dart/dart-tournament-software/start-dev.sh`
- `/home/dart/dart-tournament-software/stop-dev.sh`
- `/home/dart/dart-tournament-software/test-system.sh`

## Additional Documentation

See `DEVELOPMENT.md` in the project root for comprehensive development documentation.
