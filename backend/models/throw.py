from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from backend.models.base import BaseModel


class Throw(BaseModel):
    __tablename__ = "throws"

    game_id = Column(UUID(as_uuid=True), ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    player_id = Column(UUID(as_uuid=True), ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    turn_number = Column(Integer, nullable=False)

    # Dart scores [dart1, dart2, dart3]
    scores = Column(ARRAY(Integer), nullable=False)

    # Dart multipliers [1=single, 2=double, 3=triple] or None for miss
    multipliers = Column(ARRAY(Integer), nullable=True)

    # Total score for this throw (3 darts)
    total = Column(Integer, nullable=False)

    # Remaining score after this throw (for x01 games)
    remaining = Column(Integer, nullable=True)

    # Was this a bust? (went below 0 or invalid finish in x01)
    is_bust = Column(Integer, default=False)

    # Relationships
    game = relationship("Game", back_populates="throws")
    player = relationship("Player")
