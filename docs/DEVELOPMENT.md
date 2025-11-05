# Development Guide

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- tmux (for development script)

### Initial Setup

1. **Clone Repository:**
```bash
git clone <repository-url>
cd dart-tournament-software
```

2. **Backend Setup:**
```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. **Database Setup:**
```bash
# Create PostgreSQL database
createdb dart_tournament

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql+asyncpg://localhost/dart_tournament
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=development-secret-key-change-in-production
DEBUG=true
EOF
```

4. **Frontend Setup:**
```bash
# Scoring Terminal
cd scoring-terminal
npm install
cp .env.local.example .env.local

# Display Terminal
cd ../display-terminal
npm install
cp .env.local.example .env.local

# Mobile App
cd ../mobile-app
npm install
cp .env.local.example .env.local
```

### Running Development Environment

#### Option 1: Using tmux Script (Recommended)
```bash
./scripts/start-dev.sh
```

This starts all services in a tmux session:
- Window 0: Backend (port 8000)
- Window 1: Scoring Terminal (port 3001)
- Window 2: Display Terminal (port 3002)
- Window 3: Mobile App (port 3003)
- Window 4: Logs

**tmux Commands:**
- `Ctrl-b` then `0-4`: Switch between windows
- `Ctrl-b` then `d`: Detach from session
- `Ctrl-b` then `[`: Scroll mode
- `./scripts/stop-dev.sh`: Stop all services

#### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Scoring:**
```bash
cd scoring-terminal
npm run dev
```

**Terminal 3 - Display:**
```bash
cd display-terminal
npm run dev
```

**Terminal 4 - Mobile:**
```bash
cd mobile-app
npm run dev
```

### Project Structure

```
dart-tournament-software/
├── backend/
│   ├── api/              # API route handlers
│   ├── core/             # Core configuration
│   ├── models/           # Database models
│   ├── schemas/          # Pydantic schemas
│   ├── services/         # Business logic
│   ├── websocket/        # WebSocket handlers
│   └── main.py           # Application entry point
├── scoring-terminal/     # Touch-optimized scoring interface
├── display-terminal/     # Read-only display interface
├── mobile-app/           # PWA mobile application
├── shared/               # Shared TypeScript types
│   ├── types/            # TypeScript interfaces
│   └── constants/        # Shared constants
├── deployment/           # Deployment configurations
│   ├── docker/           # Docker files
│   ├── standalone/       # Raspberry Pi standalone
│   ├── multi-pi-nas/     # Multi-Pi setup
│   └── systemd/          # systemd service files
├── scripts/              # Development scripts
└── docs/                 # Documentation
```

### Backend Development

#### Adding a New API Endpoint

1. **Create route handler** in `backend/api/`:
```python
# backend/api/example.py
from fastapi import APIRouter, Depends
from backend.core import get_db

router = APIRouter(prefix="/example", tags=["example"])

@router.get("")
async def list_items(db = Depends(get_db)):
    # Implementation
    pass
```

2. **Register router** in `backend/main.py`:
```python
from backend.api.example import router as example_router
app.include_router(example_router)
```

#### Adding a New Model

1. **Create model** in `backend/models/`:
```python
from backend.models.base import BaseModel
from sqlalchemy import Column, String

class Example(BaseModel):
    __tablename__ = "examples"

    name = Column(String, nullable=False)
```

2. **Create schema** in `backend/schemas/`:
```python
from pydantic import BaseModel

class ExampleCreate(BaseModel):
    name: str
```

3. **Update** `__init__.py` files

#### Database Migrations

Using Alembic:
```bash
# Create migration
alembic revision --autogenerate -m "Description"

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Frontend Development

#### Adding a New Page

1. **Create page** in `src/app/`:
```typescript
// src/app/example/page.tsx
'use client'

export default function ExamplePage() {
  return <div>Example</div>
}
```

#### Adding a Component

1. **Create component** in `src/components/`:
```typescript
// src/components/example.tsx
interface ExampleProps {
  data: string
}

export function Example({ data }: ExampleProps) {
  return <div>{data}</div>
}
```

#### Using API Client

```typescript
import { api } from '@/lib/api'

async function fetchData() {
  try {
    const tournaments = await api.getTournaments()
    console.log(tournaments)
  } catch (error) {
    console.error('Error:', error)
  }
}
```

#### Using WebSocket

```typescript
import { wsClient } from '@/lib/websocket'
import { WebSocketEventType } from '@shared/types'

// Subscribe to topic
wsClient.subscribe('tournament:uuid')

// Listen for events
wsClient.on(WebSocketEventType.MATCH_UPDATED, (message) => {
  console.log('Match updated:', message.data)
})

// Cleanup
wsClient.off(WebSocketEventType.MATCH_UPDATED, handler)
wsClient.unsubscribe('tournament:uuid')
```

### Testing

#### Backend Tests
```bash
cd backend
pytest
pytest tests/test_api.py -v
pytest --cov=backend
```

#### Frontend Tests
```bash
cd scoring-terminal
npm test
npm run test:watch
```

### Code Quality

#### Backend Linting
```bash
cd backend
black .
flake8
mypy .
```

#### Frontend Linting
```bash
cd scoring-terminal
npm run lint
npm run lint:fix
```

### Database Management

#### Reset Database
```bash
# Drop and recreate
dropdb dart_tournament
createdb dart_tournament

# Run migrations
cd backend
alembic upgrade head
```

#### Seed Test Data
```bash
cd backend
python scripts/seed_data.py
```

### WebSocket Testing

Use `wscat` for testing WebSocket connections:
```bash
npm install -g wscat

wscat -c ws://localhost:8000/ws

# Subscribe to topic
> {"action": "subscribe", "topic": "tournaments"}

# Ping
> {"action": "ping", "timestamp": 1234567890}
```

### Common Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :8000

# Kill process
kill -9 <PID>
```

#### Database Connection Error
```bash
# Check PostgreSQL is running
pg_isready

# Check connection string in .env
DATABASE_URL=postgresql+asyncpg://localhost/dart_tournament
```

#### Module Not Found
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd scoring-terminal
npm install
```

### Performance Profiling

#### Backend
```python
# Add to route handler
import cProfile
import pstats

profiler = cProfile.Profile()
profiler.enable()

# Your code here

profiler.disable()
stats = pstats.Stats(profiler)
stats.sort_stats('cumtime')
stats.print_stats()
```

#### Frontend
Use React DevTools Profiler

### Debugging

#### Backend
```python
# Add breakpoint
import pdb; pdb.set_trace()

# Or use debugpy for VS Code
import debugpy
debugpy.listen(5678)
debugpy.wait_for_client()
```

#### Frontend
Use browser DevTools or VS Code debugger

### Contributing

1. Create feature branch: `git checkout -b feature/name`
2. Make changes
3. Run tests and linting
4. Commit: `git commit -m "Description"`
5. Push: `git push origin feature/name`
6. Create Pull Request

### Release Process

1. Update version in `package.json` and `main.py`
2. Update CHANGELOG.md
3. Create git tag: `git tag v1.0.0`
4. Build Docker images
5. Deploy to production
