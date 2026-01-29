from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class TeamBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    tournament_id: UUID
    player1_id: UUID
    player2_id: UUID


class TeamCreate(TeamBase):
    pass


class TeamResponse(TeamBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TeamWithPlayers(TeamResponse):
    """Team response that includes player names for display."""
    player1_name: Optional[str] = None
    player2_name: Optional[str] = None
