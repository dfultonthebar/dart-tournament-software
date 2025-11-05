from sqlalchemy import Column, String, Integer, Boolean
from sqlalchemy.orm import relationship
from backend.models.base import BaseModel


class Player(BaseModel):
    __tablename__ = "players"

    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    skill_level = Column(Integer, default=0)  # 0=Beginner, 1=Intermediate, 2=Advanced, 3=Expert
    is_active = Column(Boolean, default=True)
    qr_code = Column(String(255), nullable=True)  # For quick check-in

    # Relationships
    tournament_entries = relationship("TournamentEntry", back_populates="player", cascade="all, delete-orphan")
    match_players = relationship("MatchPlayer", back_populates="player", cascade="all, delete-orphan")
