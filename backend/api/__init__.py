from backend.api.auth import router as auth_router, get_current_player
from backend.api.players import router as players_router
from backend.api.tournaments import router as tournaments_router
from backend.api.matches import router as matches_router
from backend.api.scoring import router as scoring_router
from backend.api.events import router as events_router
from backend.api.dartboards import router as dartboards_router

__all__ = [
    "auth_router",
    "players_router",
    "tournaments_router",
    "matches_router",
    "scoring_router",
    "events_router",
    "dartboards_router",
    "get_current_player",
]
