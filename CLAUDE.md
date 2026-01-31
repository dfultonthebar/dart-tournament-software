# WAMO Dart Tournament System - Claude AI Assistant Guide

This document provides guidance for AI assistants (like Claude Code) working with the WAMO Dart Tournament Management System.

---

## Local Installation Notes (darts-admin Desktop)

**Setup Date:** 2026-01-27
**Local Path:** ~/DartTournament
**Repository:** https://github.com/dfultonthebar/dart-tournament-software
**Git Identity:** Dan Fulton <dan@thebar.com>

### Quick Start (Single Machine, No Docker)

```bash
# PRODUCTION — use this for running actual tournaments
cd ~/DartTournament
./start-prod.sh          # builds all frontends, then serves them
./stop-prod.sh           # stop production servers

# DEVELOPMENT — only use this when actively writing code
./start-dev.sh           # hot-reload dev servers (fragile .next cache)
./stop-dev.sh            # stop dev servers
```

**IMPORTANT:** Never run `npx next build` while dev servers are running — it
corrupts the `.next` cache and causes 404 errors. Use `start-prod.sh` for
stable operation; it builds everything before starting.

### Services & Ports
| Service           | Port | URL                        |
|-------------------|------|----------------------------|
| Backend API       | 8000 | http://localhost:8000      |
| Scoring Terminal  | 3001 | http://localhost:3001      |
| Display Terminal  | 3002 | http://localhost:3002      |
| Mobile App        | 3003 | http://localhost:3003      |
| API Docs          | 8000 | http://localhost:8000/docs |

### Database Credentials
- **Database:** dart_tournament
- **User:** dart_user
- **Password:** dart_password
- **Connection:** postgresql://dart_user:dart_password@localhost:5432/dart_tournament

### Virtual Environments
- **Backend Python venv:** ~/DartTournament/backend/venv
- **Activate:** `source ~/DartTournament/backend/venv/bin/activate`

### Tmux Commands (while in start-dev.sh session)
- `Ctrl+b` then `0-4` - Switch between windows (backend, scoring, display, mobile, monitor)
- `Ctrl+b` then `n/p` - Next/previous window
- `Ctrl+b` then `d` - Detach (services keep running)
- `tmux attach -t dart-tournament-dev` - Reattach to session

---

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

✅ **Core system complete and production-ready**

The system includes:
- Complete backend API with JWT auth
- All 7 WAMO game types (301/501, Cricket, Round the Clock, Killer, Shanghai, Baseball)
- **Lucky Draw Doubles** team tournament support (added 2026-01-28)
- Three frontends (scoring, display, mobile)
- Comprehensive deployment configurations
- Complete documentation
- CI/CD pipeline (GitHub Actions)
- E2E testing suite (Playwright)
- Development tooling (linting, formatting, pre-commit hooks)

### Lucky Draw Doubles Feature (2026-01-28)

Team-based tournament format: randomly pair registered players into 2-person teams,
then run a single elimination bracket where teams are the bracket units.

**Backend files modified:**
- `backend/models/match.py` — `winner_team_id` column + Team relationship
- `backend/models/match_player.py` — `team_id`, `team_position` columns + Team relationship
- `backend/schemas/match.py` — `team_id`, `team_position`, `winner_team_id` in schemas
- `backend/api/tournaments.py` — `_generate_lucky_draw_doubles_bracket()`, format guard
- `backend/api/matches.py` — `_advance_team_in_bracket()`, `_check_team_bye_cascade()`, doubles reporting

**Database columns added:**
- `matches.winner_team_id` (UUID FK -> teams.id)
- `match_players.team_id` (UUID FK -> teams.id)
- `match_players.team_position` (Integer, 1 or 2 within team)

**Frontend files updated (team-aware rendering):**
- `shared/types/match.ts` — MatchPlayerInfo, Match, MatchStatus
- `display-terminal/src/app/brackets/[id]/page.tsx`
- `display-terminal/src/app/page.tsx`
- `scoring-terminal/src/app/brackets/[id]/page.tsx`
- `scoring-terminal/src/app/admin/announce/page.tsx`
- `scoring-terminal/src/app/matches/page.tsx`

**How it works:**
1. Admin creates tournament with format `lucky_draw_doubles`
2. Players register normally (individual entries)
3. Admin calls `POST /tournaments/{id}/lucky-draw` to randomly pair into teams
4. Admin calls `POST /tournaments/{id}/generate-bracket` to create bracket
5. Each match has 4 MatchPlayers (2 per team), identified by `team_id`
6. One player per team reports result via `POST /matches/{id}/report-result`
7. Both teams must agree; disagreement triggers `DISPUTED` status
8. Winner team advances — both team members appear in next round match

**Simulation script:** `/tmp/sim_doubles.js` — verified 22 players, 11 teams, full bracket completion

### Double Elimination Bracket Feature (2026-01-29)

Full double elimination bracket support with Winners Bracket, Losers Bracket, and
Grand Final (with optional reset match).

**Backend files modified:**
- `backend/api/tournaments.py` — `_generate_double_elimination_bracket()`, `_get_seed_positions()`, proper seeding
- `backend/api/matches.py` — `_advance_double_elim_winner()`, `_advance_wb_match()`, `_advance_lb_match()`, `_advance_gf1()`, `_advance_gf2()`, `_place_player_in_match()`, `_check_double_elim_bye_cascade()`, `_all_feeders_done()`, `_get_loser_id()`

**Bracket position format:**
- Winners Bracket: `WR{round}M{index}` (e.g., `WR1M1`, `WR2M3`)
- Losers Bracket: `LR{round}M{index}` (e.g., `LR1M1`, `LR3M2`)
- Grand Final: `GF1` (first match), `GF2` (reset match)

**Round number encoding:**
- Winners Bracket: rounds 1–N
- Losers Bracket: rounds 101+
- Grand Final 1: round 200
- Grand Final 2: round 201

**Frontend files updated:**
- `display-terminal/src/app/brackets/[id]/page.tsx` — Three-section rendering (WB/GF/LB)
- `display-terminal/src/app/globals.css` — Double elimination CSS classes
- `scoring-terminal/src/app/brackets/[id]/page.tsx` — WB/LB/GF section grouping
- `scoring-terminal/src/app/matches/page.tsx` — Bracket type labels on match cards

**How it works:**
1. Admin creates tournament with format `double_elimination`
2. Players register and are seeded into the Winners Bracket
3. Admin calls `POST /tournaments/{id}/generate-bracket` to create the full bracket structure
4. Winners Bracket losers drop into the Losers Bracket at the corresponding round
5. Losers Bracket losers are eliminated from the tournament
6. The Winners Bracket final winner and Losers Bracket final winner meet in Grand Final 1 (GF1)
7. If the Losers Bracket player wins GF1, a reset match (GF2) is played to determine the champion
8. If the Winners Bracket player wins GF1, they are the champion (no reset needed)
9. Byes cascade automatically when bracket positions have only one feeder match

**Test script:** `test_double_elim.js`

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

## Business Rules — Do Not Change

These are deliberate design decisions from the bar owner. Do not remove or make optional.

- **Gender is REQUIRED on the player registration form.** It is used for co-ed lucky draw
  tournament pairings (male/female team matching). It must not be made optional or removed.
- **Player registration requires:** name, gender, email, phone. PIN is optional (for mobile access).
- **QR code on the display terminal** points players to the scoring terminal registration
  page (`http://<LAN_IP>:3001/register`). Players must be on the Customer WiFi.
- **Mobile app (port 3003) is read-only** — players cannot submit scores from it. Only the
  scoring terminal (port 3001) allows score entry, protected behind admin JWT auth.
- **Production mode (`start-prod.sh`)** should be used for running tournaments. Dev mode
  (`start-dev.sh`) is only for active code changes. Never run `npx next build` while dev
  servers are running — it corrupts the `.next` cache.

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

## Known Issues (Audit 2026-01-28)

### Not Yet Fixed (require larger refactoring)

(All items from the original audit have been addressed — see Fixed in This Session.)

### Fixed — Session 2026-01-28

- Shared `MatchStatus` enum: added `WAITING_FOR_PLAYERS`, `DISPUTED`
- Shared `MatchPlayerInfo`: added `arrived_at_board`, `reported_win`
- Shared `Match`: added `dartboard_id`
- Shared `TournamentEntry`: added `paid`
- `.replace('_', ' ')` changed to `.replace(/_/g, ' ')` in 7 files
- Database: added FK constraint on `matches.dartboard_id`
- Database: added unique index on `players.phone` (fixed 20 duplicate phone records)
- Database: added 15 FK performance indexes
- Backend: added `asyncpg` to `requirements.txt`
- Doubles scoring pages: now have team grouping logic for 4-player doubles matches
- Player matches page: `getOpponent()` fixed for doubles, uses `winner_team_id`
- mobile-app/ broken directory: restructured, builds successfully
- `getApiUrl()` duplicated in ~20 files: shared utility created at `shared/lib/api-url.ts`
- `api.ts` uses hardcoded localhost: now uses `getApiUrl`/`getWsUrl` from shared utility
- ESLint not installed: installed in all frontends with `next/core-web-vitals` config

### Fixed — Session 2026-01-30 (10-Bug Audit)

- Bracket page crash: added `.ok` guards on API responses in `display-terminal/src/app/brackets/[id]/page.tsx`
- CORS default: changed from `["*"]` to specific localhost origins in `backend/core/config.py`
- Dartboard race condition: added `with_for_update()` on old board in `backend/api/dartboards.py`
- Database indexes: added 3 indexes on matches table (`tournament_id`, `status`, `tournament_id+bracket_position`)
- Doubles match validation: fixed vacuous truth bug in `all_arrived` check in `backend/api/matches.py`
- WebSocket exception logging: replaced silent `except: pass` with `logger.warning` in `backend/api/matches.py` and `backend/websocket/handlers.py`
- QR code: uses `getApiUrl()` instead of hardcoded port, points to scoring terminal (port 3001)
- SECRET_KEY startup warning: added check in `backend/main.py` lifespan
- `catch(err: any)` replaced with typed `catch(err)` + `getErrorMessage()` across 34 instances in 15 files
- Mobile app dependencies updated to match other frontends (Next.js 14.2.35, React 18.3.1)

### Fixed — Session 2026-01-31

- CORS: added `allow_origin_regex` in `backend/main.py` so phones on the LAN can reach the API (not just localhost)
- Gender field: made required on registration form (was incorrectly labeled optional)
- Production scripts: created `start-prod.sh` / `stop-prod.sh` for stable tournament operation
- `.next` cache corruption: root cause documented — never run `npx next build` while dev servers are running

---

## Operational Notes

- **LAN IP:** `192.168.1.22` (may change if DHCP lease renews)
- **Customer WiFi:** Players must connect to "Customer WiFi" network to access the scoring terminal
- **Swap:** System uses disk swap at `/swap.img`, swappiness set to 10
- **Desktop launcher:** "Dart Tournament" in Applications menu (runs start-dev.sh)
- **npm workspaces:** `node_modules` is hoisted to the project root. All frontends share the same Next.js/React installation. This means you must `cd` into the correct subdirectory before running `npx next build` or `npx next start`.

---

**Remember**: This is a complete, production-ready system. Most questions can be answered by reading the existing code and documentation. Focus on understanding and maintaining the established patterns rather than reimplementing existing features.
