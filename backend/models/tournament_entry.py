from sqlalchemy import Column, ForeignKey, Integer, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from backend.models.base import BaseModel


class TournamentEntry(BaseModel):
    __tablename__ = "tournament_entries"

    tournament_id = Column(UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False)
    player_id = Column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    seed = Column(Integer, nullable=True)  # Tournament seeding
    checked_in = Column(DateTime, nullable=True)
    paid = Column(Boolean, default=False)  # Entry fee paid status

    # Relationships
    tournament = relationship("Tournament", back_populates="entries")
    player = relationship("Player", back_populates="tournament_entries")
