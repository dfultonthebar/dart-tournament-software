from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from backend.models.game import GameStatus


class ThrowCreate(BaseModel):
    scores: List[int] = Field(..., min_length=1, max_length=3)
    multipliers: Optional[List[Optional[int]]] = Field(None, min_length=1, max_length=3)


class ThrowResponse(BaseModel):
    id: UUID
    game_id: UUID
    player_id: UUID
    turn_number: int
    scores: List[int]
    multipliers: Optional[List[Optional[int]]]
    total: int
    remaining: Optional[int]
    is_bust: bool
    created_at: datetime

    class Config:
        from_attributes = True


class GameCreate(BaseModel):
    match_id: UUID
    set_number: int = Field(..., ge=1)
    leg_number: int = Field(..., ge=1)


class GameUpdate(BaseModel):
    status: Optional[GameStatus] = None
    current_player_id: Optional[UUID] = None
    winner_id: Optional[UUID] = None
    game_data: Optional[Dict[str, Any]] = None


class GameResponse(BaseModel):
    id: UUID
    match_id: UUID
    set_number: int
    leg_number: int
    status: GameStatus
    current_player_id: Optional[UUID]
    winner_id: Optional[UUID]
    game_data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScoreSubmission(BaseModel):
    game_id: UUID
    player_id: UUID
    throw: ThrowCreate
