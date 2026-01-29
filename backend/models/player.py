from sqlalchemy import Column, String, Integer, Boolean
from sqlalchemy.orm import relationship
from backend.models.base import BaseModel


class Player(BaseModel):
    __tablename__ = "players"

    name = Column(String(100), nullable=False)
    nickname = Column(String(50), nullable=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=True)  # Optional if using PIN
    pin = Column(String(4), nullable=True)  # 4-digit PIN for quick login
    skill_level = Column(Integer, default=0)  # 0=Beginner, 1=Intermediate, 2=Advanced, 3=Expert
    is_active = Column(Boolean, default=True)
    marketing_opt_in = Column(Boolean, default=False)  # Opt-in for tournament/promo texts and emails
    qr_code = Column(String(255), nullable=True)  # For quick check-in

    # Relationships
    tournament_entries = relationship("TournamentEntry", back_populates="player", cascade="all, delete-orphan")
    match_players = relationship("MatchPlayer", back_populates="player", cascade="all, delete-orphan")
    event_entries = relationship("EventEntry", back_populates="player", cascade="all, delete-orphan")
