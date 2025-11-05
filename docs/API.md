# Dart Tournament API Documentation

## Base URL
```
http://localhost:8000
```

## Authentication

All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

### POST /auth/register
Register a new player.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword",
  "phone": "+1234567890"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "skill_level": 0,
  "is_active": true
}
```

### POST /auth/login
Login with email and password.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

### GET /auth/me
Get current authenticated player information.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "skill_level": 0,
  "is_active": true
}
```

## Players

### GET /players
List all players.

**Query Parameters:**
- `skip` (optional): Number of records to skip (default: 0)
- `limit` (optional): Maximum number of records (default: 100)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "skill_level": 0,
    "is_active": true
  }
]
```

### GET /players/{player_id}
Get a specific player.

**Response:** `200 OK`

### PATCH /players/{player_id}
Update player information (own profile only).

**Headers:** `Authorization: Bearer <token>`

## Tournaments

### POST /tournaments
Create a new tournament.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "name": "Friday Night WAMO",
  "game_type": "301",
  "format": "single_elimination",
  "max_players": 32,
  "legs_to_win": 3,
  "sets_to_win": 1,
  "double_out": true
}
```

**Response:** `201 Created`

### GET /tournaments
List all tournaments.

**Query Parameters:**
- `status`: Filter by status (draft, registration, in_progress, completed)

### POST /tournaments/{tournament_id}/entries
Register for a tournament.

**Headers:** `Authorization: Bearer <token>`

### POST /tournaments/{tournament_id}/start
Start a tournament and generate brackets.

**Headers:** `Authorization: Bearer <token>`

## Matches

### GET /matches
List matches.

**Query Parameters:**
- `tournament_id`: Filter by tournament
- `status`: Filter by status

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "tournament_id": "uuid",
    "round_number": 1,
    "match_number": 1,
    "status": "in_progress",
    "players": [
      {
        "player_id": "uuid",
        "position": 1,
        "sets_won": 0,
        "legs_won": 1
      }
    ]
  }
]
```

### POST /matches/{match_id}/start
Start a match.

**Headers:** `Authorization: Bearer <token>`

### GET /matches/{match_id}/games
List all games in a match.

## Scoring

### POST /scoring/submit
Submit a throw score.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "game_id": "uuid",
  "player_id": "uuid",
  "throw": {
    "scores": [20, 20, 20],
    "multipliers": [3, 3, 3]
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "total": 180,
  "remaining": 121,
  "is_bust": false
}
```

### GET /scoring/game/{game_id}
Get current game state.

### GET /scoring/player/{player_id}/stats
Get player statistics.

**Query Parameters:**
- `game_id` (optional): Filter stats for specific game

## WebSocket

### WS /ws
Real-time updates via WebSocket.

**Connect:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws');
```

**Subscribe to Topics:**
```json
{
  "action": "subscribe",
  "topic": "tournament:uuid"
}
```

**Available Topics:**
- `tournaments` - All tournament updates
- `tournament:{id}` - Specific tournament updates
- `match:{id}` - Specific match updates
- `game:{id}` - Specific game updates

**Event Types:**
- `match:started`
- `match:updated`
- `match:completed`
- `score:submitted`
- `game:updated`
- `tournament:started`

## Error Responses

All endpoints may return standard HTTP error codes:

**400 Bad Request:**
```json
{
  "detail": "Error message"
}
```

**401 Unauthorized:**
```json
{
  "detail": "Could not validate credentials"
}
```

**404 Not Found:**
```json
{
  "detail": "Resource not found"
}
```

**500 Internal Server Error:**
```json
{
  "detail": "Internal server error"
}
```
