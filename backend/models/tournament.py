from sqlalchemy import Column, String, Enum, Integer, DateTime, Date, Time, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from backend.models.base import BaseModel
import enum


class TournamentFormat(str, enum.Enum):
    SINGLE_ELIMINATION = "single_elimination"
    DOUBLE_ELIMINATION = "double_elimination"
    ROUND_ROBIN = "round_robin"
    LUCKY_DRAW_DOUBLES = "lucky_draw_doubles"


class TournamentStatus(str, enum.Enum):
    DRAFT = "draft"
    REGISTRATION = "registration"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class GameType(str, enum.Enum):
    THREE_ZERO_ONE = "301"
    FIVE_ZERO_ONE = "501"
    CRICKET = "cricket"
    CRICKET_CUTTHROAT = "cricket_cutthroat"
    ROUND_THE_CLOCK = "round_the_clock"
    KILLER = "killer"
    SHANGHAI = "shanghai"
    BASEBALL = "baseball"


class Tournament(BaseModel):
    __tablename__ = "tournaments"

    name = Column(String(200), nullable=False)
    description = Column(String(1000), nullable=True)
    game_type = Column(Enum(GameType), nullable=False)
    format = Column(Enum(TournamentFormat), nullable=False)
    status = Column(Enum(TournamentStatus), default=TournamentStatus.DRAFT, nullable=False)
    max_players = Column(Integer, nullable=True)
    scheduled_date = Column(Date, nullable=True)
    scheduled_time = Column(Time, nullable=True)
    start_time = Column(DateTime, nullable=True)  # Actual start time (set when tournament begins)
    end_time = Column(DateTime, nullable=True)

    # Game-specific settings
    starting_score = Column(Integer, nullable=True)  # For 301/501
    legs_to_win = Column(Integer, default=1)
    sets_to_win = Column(Integer, default=1)
    double_in = Column(Boolean, default=False)
    double_out = Column(Boolean, default=True)
    master_out = Column(Boolean, default=False)  # Can finish on double, triple, or bull
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=True)
    is_coed = Column(Boolean, default=False, server_default="false")

    # Relationships
    entries = relationship("TournamentEntry", back_populates="tournament", cascade="all, delete-orphan")
    matches = relationship("Match", back_populates="tournament", cascade="all, delete-orphan")
    teams = relationship("Team", back_populates="tournament", cascade="all, delete-orphan")
    event = relationship("Event", back_populates="tournaments")
