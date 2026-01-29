from sqlalchemy import Column, String, Date, Enum, Text, Integer
from sqlalchemy.orm import relationship
from backend.models.base import BaseModel
import enum


class EventStatus(str, enum.Enum):
    DRAFT = "draft"
    REGISTRATION = "registration"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class SportType(str, enum.Enum):
    DARTS = "darts"
    VOLLEYBALL = "volleyball"


class Event(BaseModel):
    __tablename__ = "events"

    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(300), nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(Enum(EventStatus), default=EventStatus.DRAFT, nullable=False)
    max_participants = Column(Integer, nullable=True)
    sport_type = Column(Enum(SportType), nullable=False, default=SportType.DARTS)

    # Relationships
    tournaments = relationship("Tournament", back_populates="event", cascade="all, delete-orphan")
    entries = relationship("EventEntry", back_populates="event", cascade="all, delete-orphan")
