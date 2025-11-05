from sqlalchemy import Column, String, ForeignKey, Integer, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from backend.models.base import BaseModel
import enum


class MatchStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Match(BaseModel):
    __tablename__ = "matches"

    tournament_id = Column(UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    round_number = Column(Integer, nullable=False)
    match_number = Column(Integer, nullable=False)
    status = Column(Enum(MatchStatus), default=MatchStatus.PENDING, nullable=False)

    # For bracket positioning
    bracket_position = Column(String(50), nullable=True)  # e.g., "W1", "L2" for double elimination

    # Match timing
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Winner
    winner_id = Column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    tournament = relationship("Tournament", back_populates="matches")
    winner = relationship("Player", foreign_keys=[winner_id])
    match_players = relationship("MatchPlayer", back_populates="match", cascade="all, delete-orphan")
    games = relationship("Game", back_populates="match", cascade="all, delete-orphan")
