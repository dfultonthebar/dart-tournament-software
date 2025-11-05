# Development Guide

## Quick Start

### Prerequisites

- Python 3.11+ with venv
- Node.js 18+ with npm
- PostgreSQL 14+
- Redis 6+
- tmux (for development scripts)

### Starting the Development Environment

```bash
./start-dev.sh
```

This will start all services in a tmux session:
- **Backend API**: http://localhost:8000 (FastAPI with uvicorn)
- **Scoring Terminal**: http://localhost:3001 (Next.js)
- **Display Terminal**: http://localhost:3002 (Next.js)
- **Mobile App**: http://localhost:3003 (Next.js)

### Stopping the Development Environment

```bash
./stop-dev.sh
```

This will cleanly stop all services and kill any lingering processes.

### Testing the System

```bash
./test-system.sh
```

This script verifies:
- Environment configuration (.env file)
- Backend API health
- Database connection
- All required database tables
- API endpoints accessibility

## Tmux Commands

When attached to the development session:

- **Switch windows**: `Ctrl+b` then `0-4` (or `n`/`p` for next/prev)
- **Detach session**: `Ctrl+b` then `d`
- **Reattach**: `tmux attach -t dart-tournament-dev`
- **List windows**: `Ctrl+b` then `w`

### Tmux Windows

1. `backend` - Backend API server
2. `scoring` - Scoring Terminal frontend
3. `display` - Display Terminal frontend
4. `mobile` - Mobile App frontend
5. `monitor` - System information and monitoring

## Manual Setup

If you need to start services manually:

### Backend

```bash
cd backend
source venv/bin/activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Scoring Terminal

```bash
cd scoring-terminal
npm install  # First time only
npm run dev
```

### Display Terminal

```bash
cd display-terminal
npm install  # First time only
npm run dev
```

### Mobile App

```bash
cd mobile-app
npm install  # First time only
npm run dev
```

## Environment Variables

The `.env` file should be in the project root with:

```env
DATABASE_URL=postgresql+asyncpg://dart_user:DartTournament2024!@localhost:5432/dart_tournament
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=change-this-to-random-secret-key-min-32-chars-abc123xyz789
CORS_ORIGINS=http://localhost:3001,http://localhost:3002,http://localhost:3003
```

## Troubleshooting

### Backend won't start

1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Check Redis is running: `sudo systemctl status redis`
3. Verify database exists: `psql -U dart_user -d dart_tournament -c "SELECT 1"`
4. Check virtual environment: `cd backend && source venv/bin/activate && python --version`

### Frontend won't start

1. Check node_modules exist: `ls <frontend-dir>/node_modules`
2. Reinstall dependencies: `cd <frontend-dir> && rm -rf node_modules package-lock.json && npm install`
3. Check port availability: `lsof -i:<port>`

### Port already in use

```bash
# Find and kill process using a port
lsof -ti:<port> | xargs kill -9

# Or use the stop script
./stop-dev.sh
```

### Tmux session won't start

```bash
# Kill existing session
tmux kill-session -t dart-tournament-dev

# Start fresh
./start-dev.sh
```

## API Documentation

Once the backend is running, visit:
- **Interactive API docs**: http://localhost:8000/docs
- **Alternative docs**: http://localhost:8000/redoc
- **OpenAPI schema**: http://localhost:8000/openapi.json

## Database Management

### Migrations

```bash
cd backend
source venv/bin/activate
# Add migration commands here when implemented
```

### Direct Database Access

```bash
psql -U dart_user -d dart_tournament
```

### Reset Database

```bash
cd backend
source venv/bin/activate
python scripts/init_db.py  # If script exists
```

## Development Workflow

1. Start development environment: `./start-dev.sh`
2. Make code changes
3. Changes auto-reload (backend) or hot-reload (frontends)
4. Test changes in browser
5. Run tests: `./test-system.sh`
6. Stop when done: `./stop-dev.sh`

## Production Build

### Backend

```bash
cd backend
source venv/bin/activate
# Backend runs same way in production, just without --reload flag
```

### Frontends

```bash
cd <frontend-dir>
npm run build
npm start
```

## Notes

- Backend runs in development mode with auto-reload
- Frontends run in development mode with hot-reload
- All services log to their respective tmux windows
- Database and Redis must be running before starting services
- Frontend dependencies are auto-installed if missing
