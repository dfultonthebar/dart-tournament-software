# Dart Tournament Software - Complete Implementation Specification

## Project Overview
Build a complete, production-ready WAMO dart tournament management system for Raspberry Pi deployment supporting 500+ players.

## Architecture Completed
- ✅ Directory structure created
- ✅ Basic FastAPI backend with database models
- ✅ Players and Tournaments API endpoints
- ✅ PostgreSQL and Redis configuration

## What Needs to be Built

### 1. Backend Components (Python/FastAPI)

#### A. Complete API Endpoints
- **backend/api/matches.py** - Match CRUD, scoring, winner determination
- **backend/api/scoring.py** - Real-time score submission, validation
- **backend/api/auth.py** - JWT authentication, login, register

#### B. WebSocket Support
- **backend/websocket/connection.py** - WebSocket connection manager
- **backend/websocket/handlers.py** - Real-time score updates, tournament updates

#### C. WAMO Rules Engine
- **backend/services/wamo_rules.py** - Complete game logic for:
  - 301/501 (single/double/triple in/out)
  - Cricket (standard and cut-throat)
  - Round the Clock
  - Killer
  - Shanghai
  - Baseball
- **backend/services/scoring.py** - Score validation, checkout calculations
- **backend/services/bracket.py** - Tournament bracket generation (single/double elimination, round-robin)

#### D. Schemas
- **backend/schemas/player.py** - Pydantic models for Player CRUD
- **backend/schemas/tournament.py** - Pydantic models for Tournament CRUD
- **backend/schemas/match.py** - Pydantic models for Match CRUD
- **backend/schemas/auth.py** - Login, Register, Token schemas

### 2. Scoring Terminal (Next.js 14 - Touch Interface)

**Directory:** `scoring-terminal/`

#### Required Files:
- **package.json** - Next.js 14.1.0, React 18.2.0, TypeScript 5.3.3, Tailwind 3.4.1
- **tsconfig.json** - Strict TypeScript config
- **next.config.js** - Next.js configuration
- **tailwind.config.ts** - Tailwind with touch-optimized utilities
- **postcss.config.js** - PostCSS configuration

#### App Structure (App Router):
- **src/app/layout.tsx** - Root layout with Tailwind
- **src/app/page.tsx** - Home page with tournament selection
- **src/app/scoring/page.tsx** - Touch-optimized score entry interface
- **src/app/matches/page.tsx** - Active matches list

#### Components:
- **src/components/dartboard.tsx** - Visual dartboard for score entry (44px minimum touch targets)
- **src/components/score-input.tsx** - Number pad for score entry
- **src/components/match-card.tsx** - Match display card

#### Utilities:
- **src/lib/api.ts** - API client for backend
- **src/lib/websocket.ts** - WebSocket connection handler
- **src/lib/offline.ts** - Offline queue and sync manager

### 3. Display Terminal (Next.js 14 - Read-Only)

**Directory:** `display-terminal/`

Similar structure to scoring terminal but read-only, auto-refresh every 30 seconds.

#### App Structure:
- **src/app/layout.tsx** - Full-screen layout
- **src/app/page.tsx** - Live tournament overview
- **src/app/brackets/page.tsx** - Tournament bracket display
- **src/app/leaderboard/page.tsx** - Real-time leaderboard

#### Components:
- **src/components/bracket-display.tsx** - Visual bracket tree
- **src/components/leaderboard.tsx** - Animated leaderboard
- **src/components/live-match.tsx** - Current match scores

### 4. Mobile App (Next.js 14 PWA)

**Directory:** `mobile-app/`

#### Additional PWA Files:
- **public/manifest.json** - PWA manifest
- **public/icons/** - PWA icons (generated)

#### App Structure:
- **src/app/layout.tsx** - Mobile-optimized layout
- **src/app/page.tsx** - Home with login/register
- **src/app/register/page.tsx** - Player registration with QR code
- **src/app/my-matches/page.tsx** - Player's upcoming matches
- **src/app/brackets/page.tsx** - Tournament brackets view

### 5. Shared Types (TypeScript)

**Directory:** `shared/types/`

- **tournament.ts** - Tournament interfaces
- **player.ts** - Player interfaces
- **match.ts** - Match interfaces
- **game.ts** - Game/scoring interfaces
- **websocket.ts** - WebSocket message types

**Directory:** `shared/constants/`

- **wamo-rules.ts** - Game type constants, scoring rules

### 6. Deployment Scripts

**Directory:** `deployment/`

#### Docker:
- **docker/Dockerfile.backend** - Multi-stage Python build
- **docker/Dockerfile.frontend** - Multi-stage Node build
- **docker/docker-compose.prod.yml** - Production compose file

#### Raspberry Pi:
- **standalone/setup.sh** - Single Pi 4 setup script
- **multi-pi-nas/setup-server.sh** - NAS server setup
- **multi-pi-nas/setup-terminal.sh** - Terminal Pi setup

#### Systemd:
- **systemd/dart-backend.service** - Backend service
- **systemd/dart-scoring.service** - Scoring terminal service
- **systemd/dart-display.service** - Display terminal service

### 7. Development Scripts

**Directory:** `scripts/`

- **start-dev.sh** - Start all services with tmux
- **stop-dev.sh** - Stop all services
- **test-backend.sh** - Run backend tests
- **seed-data.sh** - Seed sample data

### 8. Documentation

**Directory:** `docs/`

- **API.md** - Complete API documentation
- **DEPLOYMENT.md** - Deployment guide for Raspberry Pi
- **WAMO_RULES.md** - WAMO game rules documentation
- **DEVELOPMENT.md** - Development setup guide

## Technical Requirements

### Backend:
- Python 3.12 with type hints
- F
cat > PROJECT_SPEC.md << 'EOF'
# Dart Tournament Software - Complete Implementation Specification

## Project Overview
Build a complete, production-ready WAMO dart tournament management system for Raspberry Pi deployment supporting 500+ players.

## Architecture Completed
- ✅ Directory structure created
- ✅ Basic FastAPI backend with database models
- ✅ Players and Tournaments API endpoints
- ✅ PostgreSQL and Redis configuration

## What Needs to be Built

### 1. Backend Components (Python/FastAPI)

#### A. Complete API Endpoints
- **backend/api/matches.py** - Match CRUD, scoring, winner determination
- **backend/api/scoring.py** - Real-time score submission, validation
- **backend/api/auth.py** - JWT authentication, login, register

#### B. WebSocket Support
- **backend/websocket/connection.py** - WebSocket connection manager
- **backend/websocket/handlers.py** - Real-time score updates, tournament updates

#### C. WAMO Rules Engine
- **backend/services/wamo_rules.py** - Complete game logic for:
  - 301/501 (single/double/triple in/out)
  - Cricket (standard and cut-throat)
  - Round the Clock
  - Killer
  - Shanghai
  - Baseball
- **backend/services/scoring.py** - Score validation, checkout calculations
- **backend/services/bracket.py** - Tournament bracket generation (single/double elimination, round-robin)

#### D. Schemas
- **backend/schemas/player.py** - Pydantic models for Player CRUD
- **backend/schemas/tournament.py** - Pydantic models for Tournament CRUD
- **backend/schemas/match.py** - Pydantic models for Match CRUD
- **backend/schemas/auth.py** - Login, Register, Token schemas

### 2. Scoring Terminal (Next.js 14 - Touch Interface)

**Directory:** `scoring-terminal/`

#### Required Files:
- **package.json** - Next.js 14.1.0, React 18.2.0, TypeScript 5.3.3, Tailwind 3.4.1
- **tsconfig.json** - Strict TypeScript config
- **next.config.js** - Next.js configuration
- **tailwind.config.ts** - Tailwind with touch-optimized utilities
- **postcss.config.js** - PostCSS configuration

#### App Structure (App Router):
- **src/app/layout.tsx** - Root layout with Tailwind
- **src/app/page.tsx** - Home page with tournament selection
- **src/app/scoring/page.tsx** - Touch-optimized score entry interface
- **src/app/matches/page.tsx** - Active matches list

#### Components:
- **src/components/dartboard.tsx** - Visual dartboard for score entry (44px minimum touch targets)
- **src/components/score-input.tsx** - Number pad for score entry
- **src/components/match-card.tsx** - Match display card

#### Utilities:
- **src/lib/api.ts** - API client for backend
- **src/lib/websocket.ts** - WebSocket connection handler
- **src/lib/offline.ts** - Offline queue and sync manager

### 3. Display Terminal (Next.js 14 - Read-Only)

**Directory:** `display-terminal/`

Similar structure to scoring terminal but read-only, auto-refresh every 30 seconds.

#### App Structure:
- **src/app/layout.tsx** - Full-screen layout
- **src/app/page.tsx** - Live tournament overview
- **src/app/brackets/page.tsx** - Tournament bracket display
- **src/app/leaderboard/page.tsx** - Real-time leaderboard

#### Components:
- **src/components/bracket-display.tsx** - Visual bracket tree
- **src/components/leaderboard.tsx** - Animated leaderboard
- **src/components/live-match.tsx** - Current match scores

### 4. Mobile App (Next.js 14 PWA)

**Directory:** `mobile-app/`

#### Additional PWA Files:
- **public/manifest.json** - PWA manifest
- **public/icons/** - PWA icons (generated)

#### App Structure:
- **src/app/layout.tsx** - Mobile-optimized layout
- **src/app/page.tsx** - Home with login/register
- **src/app/register/page.tsx** - Player registration with QR code
- **src/app/my-matches/page.tsx** - Player's upcoming matches
- **src/app/brackets/page.tsx** - Tournament brackets view

### 5. Shared Types (TypeScript)

**Directory:** `shared/types/`

- **tournament.ts** - Tournament interfaces
- **player.ts** - Player interfaces
- **match.ts** - Match interfaces
- **game.ts** - Game/scoring interfaces
- **websocket.ts** - WebSocket message types

**Directory:** `shared/constants/`

- **wamo-rules.ts** - Game type constants, scoring rules

### 6. Deployment Scripts

**Directory:** `deployment/`

#### Docker:
- **docker/Dockerfile.backend** - Multi-stage Python build
- **docker/Dockerfile.frontend** - Multi-stage Node build
- **docker/docker-compose.prod.yml** - Production compose file

#### Raspberry Pi:
- **standalone/setup.sh** - Single Pi 4 setup script
- **multi-pi-nas/setup-server.sh** - NAS server setup
- **multi-pi-nas/setup-terminal.sh** - Terminal Pi setup

#### Systemd:
- **systemd/dart-backend.service** - Backend service
- **systemd/dart-scoring.service** - Scoring terminal service
- **systemd/dart-display.service** - Display terminal service

### 7. Development Scripts

**Directory:** `scripts/`

- **start-dev.sh** - Start all services with tmux
- **stop-dev.sh** - Stop all services
- **test-backend.sh** - Run backend tests
- **seed-data.sh** - Seed sample data

### 8. Documentation

**Directory:** `docs/`

- **API.md** - Complete API documentation
- **DEPLOYMENT.md** - Deployment guide for Raspberry Pi
- **WAMO_RULES.md** - WAMO game rules documentation
- **DEVELOPMENT.md** - Development setup guide

## Technical Requirements

### Backend:
- Python 3.12 with type hints
- FastAPI async/await throughout
- SQLAlchemy 2.x async engine
- Pydantic v2 for validation
- Redis for caching and WebSocket state
- Proper error handling and logging
- JWT authentication
- WebSocket for real-time updates

### Frontend:
- Next.js 14 App Router (NOT Pages Router)
- TypeScript strict mode
- React Server Components where appropriate
- Tailwind CSS utility-first styling
- Touch-optimized (44x44px minimum)
- Offline-first architecture with sync queue
- WebSocket for live updates
- Progressive Web App (mobile only)

### Code Quality:
- Comprehensive error handling
- Logging throughout
- Type safety (Python type hints, TypeScript)
- RESTful API design
- Secure authentication
- Environment-based configuration
- Production-ready code (no TODOs or placeholders)

## Implementation Priority
1. Complete backend API endpoints and WebSocket
2. WAMO rules engine with all game types
3. Scoring terminal frontend
4. Display terminal frontend
5. Mobile app frontend
6. Deployment scripts
7. Documentation

## Success Criteria
- All API endpoints working with proper validation
- Real-time updates via WebSocket
- Offline-capable scoring terminals
- Touch-optimized interfaces
- Complete WAMO rules implementation
- Ready for Raspberry Pi deployment
- Comprehensive documentation
