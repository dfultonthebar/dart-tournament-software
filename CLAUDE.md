# WAMO Dart Tournament System - Claude AI Assistant Guide

This document provides guidance for AI assistants (like Claude Code) working with the WAMO Dart Tournament Management System.

## System Overview

This is a **production-ready** dart tournament management system designed for Raspberry Pi deployment, supporting 500+ concurrent players.

### Key Technologies
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.x (async), PostgreSQL, Redis
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript 5.3, Tailwind CSS
- **Testing**: Playwright (E2E), pytest (backend)
- **Deployment**: Docker, Raspberry Pi standalone, systemd services

### Architecture Components

```
├── backend/              # FastAPI async backend
│   ├── api/             # REST endpoints
│   ├── core/            # Config, security, database
│   ├── models/          # SQLAlchemy models
│   ├── schemas/         # Pydantic validation
│   ├── services/        # Business logic & WAMO rules
│   └── websocket/       # Real-time connections
├── scoring-terminal/     # Touch-optimized scoring UI (port 3001)
├── display-terminal/     # Read-only display UI (port 3002)
├── mobile-app/          # PWA mobile app (port 3003)
├── shared/              # TypeScript types shared across frontends
├── tests/               # Playwright E2E tests
└── deployment/          # Docker & Raspberry Pi configs
```

## System Status

✅ **All components are complete and production-ready**

The system includes:
- Complete backend API with JWT auth
- All 7 WAMO game types (301/501, Cricket, Round the Clock, Killer, Shanghai, Baseball)
- Three fully-functional frontends
- Comprehensive deployment configurations
- Complete documentation
- CI/CD pipeline (GitHub Actions)
- E2E testing suite (Playwright)
- Development tooling (linting, formatting, pre-commit hooks)

## Working with This System

### As a System Expert

When asked to help with this system:

1. **Review existing code first** - Most features are already implemented
2. **Check IMPLEMENTATION_SUMMARY.md** - Complete feature status
3. **Read PROJECT_SPEC.md** - Original requirements and architecture
4. **Consult README.md** - Quick start and feature overview

### Common Tasks

#### Starting Development Environment

```bash
# Install all dependencies
npm run install:all

# Start all services (requires PostgreSQL and Redis)
./start-dev.sh

# Stop all services
./stop-dev.sh

# Test system health
./test-system.sh
```

#### Database Operations

```bash
# Initialize database (creates all tables)
python backend/scripts/init_db.py

# Seed with sample data
python backend/scripts/seed_data.py
```

#### Running Tests

```bash
# E2E tests
npm run test:e2e                 # Run all Playwright tests
npm run test:e2e:ui              # Interactive UI mode
npm run test:e2e:headed          # Watch tests run

# Backend tests (requires running database)
cd backend && pytest

# Linting
npm run lint                     # All linting
npm run format                   # Format all code
```

#### MCP Integration

This project includes MCP (Model Context Protocol) configuration:

- **Playwright MCP**: Browser automation and testing
- Located in `.claude/mcp_config.json`
- See `.claude/README.md` for MCP usage

### Understanding the WAMO Rules Engine

The heart of this system is the WAMO rules engine in `backend/services/wamo_rules.py`:

**Game Types Implemented:**
1. **X01Rules** (301/501) - Countdown with double in/out options
2. **CricketRules** - Standard and cut-throat variants
3. **RoundTheClockRules** - Sequential 1-20 then bull
4. **KillerRules** - Elimination-style gameplay
5. **ShanghaiRules** - 7-inning points game with instant win
6. **BaseballRules** - 9-inning scoring game

Each game type has:
- `validate_throw()` - Validate and score individual throws
- `is_game_over()` - Check for win conditions
- `determine_winner()` - Calculate winner

### Code Standards

#### Backend (Python)
- **Type hints required** - Use Python 3.12 type annotations
- **Async/await** - All database operations must be async
- **Pydantic v2** - Use for all schemas and validation
- **Black formatting** - Line length 100
- **Import sorting** - Use isort with Black profile

#### Frontend (TypeScript)
- **Strict mode** - TypeScript strict enabled
- **Touch targets** - Minimum 44x44px for all interactive elements
- **App Router** - Use Next.js 14 App Router (NOT Pages Router)
- **Server Components** - Prefer RSC where possible
- **Offline-first** - Support offline score submission with sync queue

### API Endpoints

The backend provides these main endpoints:

```
/auth/*           - JWT authentication (register, login)
/players/*        - Player CRUD and management
/tournaments/*    - Tournament CRUD and bracket generation
/matches/*        - Match operations and game management
/scoring/*        - Score submission and validation
/ws               - WebSocket for real-time updates
/health           - System health check
/docs             - Interactive API documentation
```

See `docs/API.md` for complete API reference.

### WebSocket Events

Real-time updates via WebSocket:

- `tournament:update` - Tournament status changes
- `match:update` - Match status/score changes
- `game:update` - Game state changes
- `score:update` - Individual throw scored

### Environment Setup

Required environment variables (`.env`):

```env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/dart_tournament
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=<random-32+-char-secret>
CORS_ORIGINS=http://localhost:3001,http://localhost:3002,http://localhost:3003
```

### Deployment Options

1. **Development** - tmux-based multi-service (./start-dev.sh)
2. **Docker Compose** - Complete stack with one command
3. **Raspberry Pi Standalone** - Automated setup script
4. **systemd Services** - Native Linux services

See `docs/DEPLOYMENT.md` for detailed instructions.

### Common Issues and Solutions

#### Database Connection Errors
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check database exists
psql -l | grep dart_tournament

# Reinitialize if needed
python backend/scripts/init_db.py
```

#### Frontend Build Errors
```bash
# Clear caches and reinstall
cd <frontend-dir>
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

#### Port Already in Use
```bash
# Stop all services
./stop-dev.sh

# Or manually kill processes
lsof -ti:8000 | xargs kill -9  # Backend
lsof -ti:3001 | xargs kill -9  # Scoring Terminal
```

### Files to Reference

- **API Documentation**: `docs/API.md`
- **Deployment Guide**: `docs/DEPLOYMENT.md`
- **Game Rules**: `docs/WAMO_RULES.md`
- **Development Setup**: `DEVELOPMENT.md`
- **Implementation Status**: `IMPLEMENTATION_SUMMARY.md`
- **Original Spec**: `PROJECT_SPEC.md`

### Testing Strategy

1. **Unit Tests** - pytest for backend business logic
2. **Integration Tests** - API endpoint testing
3. **E2E Tests** - Playwright for full user workflows
4. **Manual Testing** - Actual tournament simulation

### Performance Considerations

This system is optimized for Raspberry Pi:
- Async I/O throughout
- Redis caching with TTL
- Database connection pooling
- Efficient SQL queries with proper indexes
- WebSocket multiplexing
- Static asset optimization

**Tested with:**
- 500+ concurrent players
- 50+ simultaneous matches
- Real-time score updates
- Multiple display terminals

### Contributing Guidelines

When adding features or fixing bugs:

1. **Read existing code** - Most patterns are established
2. **Follow type safety** - No `any` types, use proper annotations
3. **Test thoroughly** - Add E2E tests for user-facing features
4. **Update documentation** - Keep docs in sync with code
5. **Run linters** - Use pre-commit hooks or manual `npm run lint`
6. **Commit atomically** - Small, focused commits with clear messages

### CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`):
- ✅ Linting (Python & TypeScript)
- ✅ Backend tests with PostgreSQL & Redis
- ✅ Frontend builds (all 3 apps)
- ✅ E2E tests with Playwright
- ✅ Docker build verification

### Quick Reference Commands

```bash
# Development
./start-dev.sh                    # Start all services
./stop-dev.sh                     # Stop all services
./test-system.sh                  # System health check

# Testing
npm run test:e2e                  # E2E tests
npm run test:e2e:ui              # Interactive test UI
cd backend && pytest              # Backend tests

# Linting & Formatting
npm run lint                      # Lint everything
npm run format                    # Format everything
npm run lint:backend             # Python only
npm run lint:frontend            # TypeScript only

# Database
python backend/scripts/init_db.py    # Initialize DB
python backend/scripts/seed_data.py  # Seed sample data

# Building
npm run build:all                 # Build all frontends
cd backend && docker build        # Build backend container
```

## For AI Assistants: Key Behaviors

1. **Start with documentation** - Check IMPLEMENTATION_SUMMARY.md and PROJECT_SPEC.md first
2. **Verify completion** - Most features are done; avoid reimplementing
3. **Maintain patterns** - Follow established code patterns
4. **Test changes** - Use Playwright for E2E testing
5. **Update docs** - Keep documentation current

## Questions to Ask Users

When helping users, determine:

1. **What component?** - Backend, scoring terminal, display, mobile?
2. **What environment?** - Development, Docker, Raspberry Pi?
3. **Services running?** - PostgreSQL and Redis status?
4. **Error messages?** - Console logs, API responses?
5. **Expected behavior?** - What should happen vs what does happen?

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet / LAN                        │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────┼───────────┬───────────────┐
          │          │           │               │
    ┌─────▼────┐ ┌──▼───────┐ ┌─▼─────────┐ ┌──▼──────┐
    │ Scoring  │ │ Display  │ │  Mobile   │ │ Players │
    │ Terminal │ │ Terminal │ │    App    │ │ Devices │
    │ (3001)   │ │ (3002)   │ │  (3003)   │ │         │
    └─────┬────┘ └──┬───────┘ └─┬─────────┘ └────┬────┘
          │         │            │                 │
          └─────────┼────────────┴─────────────────┘
                    │
                    │ HTTP/WebSocket
                    │
              ┌─────▼──────┐
              │  FastAPI   │
              │  Backend   │
              │   (8000)   │
              └─────┬──────┘
                    │
          ┌─────────┼─────────┐
          │                   │
    ┌─────▼──────┐     ┌─────▼─────┐
    │ PostgreSQL │     │   Redis   │
    │  Database  │     │   Cache   │
    └────────────┘     └───────────┘
```

---

**Remember**: This is a complete, production-ready system. Most questions can be answered by reading the existing code and documentation. Focus on understanding and maintaining the established patterns rather than reimplementing existing features.
