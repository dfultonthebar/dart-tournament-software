from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from backend.models.match import MatchStatus


class MatchPlayerInfo(BaseModel):
    player_id: UUID
    position: int
    sets_won: int = 0
    legs_won: int = 0


class MatchBase(BaseModel):
    tournament_id: UUID
    round_number: int = Field(..., ge=1)
    match_number: int = Field(..., ge=1)
    bracket_position: Optional[str] = None


class MatchCreate(MatchBase):
    player_ids: List[UUID] = Field(..., min_length=2, max_length=2)


class MatchUpdate(BaseModel):
    status: Optional[MatchStatus] = None
    winner_id: Optional[UUID] = None


class MatchResponse(MatchBase):
    id: UUID
    status: MatchStatus
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    winner_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MatchWithPlayers(MatchResponse):
    players: List[MatchPlayerInfo]


class MatchPlayerCreate(BaseModel):
    match_id: UUID
    player_id: UUID
    position: int = Field(..., ge=1, le=2)
