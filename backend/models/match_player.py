from sqlalchemy import Column, ForeignKey, Integer, DateTime, Boolean
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

    # Team support (Lucky Draw Doubles)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    team_position = Column(Integer, nullable=True)  # 1 or 2 within team

    # Board presence
    on_my_way = Column(DateTime, nullable=True)  # When player indicated they're heading to the board
    arrived_at_board = Column(DateTime, nullable=True)  # When player indicated they're at the board

    # Self-reported result: True = "I won", False = "I lost", None = not yet reported
    reported_win = Column(Boolean, nullable=True)

    # Relationships
    match = relationship("Match", back_populates="match_players")
    player = relationship("Player", back_populates="match_players")
    team = relationship("Team", foreign_keys=[team_id])
