from sqlalchemy import Column, ForeignKey, DateTime, Boolean, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from backend.models.base import BaseModel


class EventEntry(BaseModel):
    __tablename__ = "event_entries"

    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    player_id = Column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    checked_in = Column(DateTime, nullable=True)
    paid = Column(Boolean, default=False)
    notes = Column(String(500), nullable=True)

    # Relationships
    event = relationship("Event", back_populates="entries")
    player = relationship("Player", back_populates="event_entries")
