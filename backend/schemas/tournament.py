from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date, time
from backend.models.tournament import TournamentFormat, TournamentStatus, GameType


class TournamentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    game_type: GameType
    format: TournamentFormat
    max_players: Optional[int] = Field(None, gt=0)
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[time] = None
    starting_score: Optional[int] = Field(None, gt=0)
    legs_to_win: int = Field(default=1, gt=0)
    sets_to_win: int = Field(default=1, gt=0)
    double_in: bool = False
    double_out: bool = True
    master_out: bool = False  # Can finish on double, triple, or bull
    is_coed: bool = False


class TournamentCreate(TournamentBase):
    event_id: UUID


class TournamentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    status: Optional[TournamentStatus] = None
    max_players: Optional[int] = Field(None, gt=0)
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[time] = None
    is_coed: Optional[bool] = None


class TournamentResponse(TournamentBase):
    id: UUID
    event_id: Optional[UUID] = None
    status: TournamentStatus
    start_time: Optional[datetime] = None  # Actual start time
    end_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TournamentEntryCreate(BaseModel):
    tournament_id: UUID
    player_id: UUID


class TournamentEntryResponse(BaseModel):
    id: UUID
    tournament_id: UUID
    player_id: UUID
    seed: Optional[int]
    checked_in: Optional[datetime]
    paid: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class TournamentEntryUpdate(BaseModel):
    paid: Optional[bool] = None
    seed: Optional[int] = None
