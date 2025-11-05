from sqlalchemy import Column, ForeignKey, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from backend.models.base import BaseModel
import enum


class GameStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Game(BaseModel):
    __tablename__ = "games"

    match_id = Column(UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    set_number = Column(Integer, nullable=False)
    leg_number = Column(Integer, nullable=False)
    status = Column(Enum(GameStatus), default=GameStatus.PENDING, nullable=False)

    # Current game state
    current_player_id = Column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="SET NULL"), nullable=True)
    winner_id = Column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="SET NULL"), nullable=True)

    # Game data (stores current scores, cricket marks, etc.)
    game_data = Column(JSONB, default=dict, nullable=False)

    # Relationships
    match = relationship("Match", back_populates="games")
    current_player = relationship("Player", foreign_keys=[current_player_id])
    winner = relationship("Player", foreign_keys=[winner_id])
    throws = relationship("Throw", back_populates="game", cascade="all, delete-orphan")
