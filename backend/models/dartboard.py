from sqlalchemy import Column, String, Integer, Boolean
from sqlalchemy.orm import relationship
from backend.models.base import BaseModel


class Dartboard(BaseModel):
    __tablename__ = "dartboards"

    number = Column(Integer, nullable=False, unique=True)  # Board 1, 2, 3...
    name = Column(String(100), nullable=True)  # Optional name like "Main Stage"
    is_available = Column(Boolean, default=True)

    # Relationship to matches
    matches = relationship("Match", back_populates="dartboard")
