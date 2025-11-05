from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from backend.models.base import BaseModel


class MatchPlayer(BaseModel):
    __tablename__ = "match_players"

    match_id = Column(UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    player_id = Column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False)  # 1 or 2 (player position in match)
    sets_won = Column(Integer, default=0)
    legs_won = Column(Integer, default=0)

    # Relationships
    match = relationship("Match", back_populates="match_players")
    player = relationship("Player", back_populates="match_players")
