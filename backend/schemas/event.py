from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from enum import Enum


class EventStatus(str, Enum):
    DRAFT = "draft"
    REGISTRATION = "registration"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class SportType(str, Enum):
    DARTS = "darts"
    VOLLEYBALL = "volleyball"


class EventBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    location: Optional[str] = Field(None, max_length=300)
    start_date: date
    end_date: date
    max_participants: Optional[int] = Field(None, gt=0)


class EventCreate(EventBase):
    sport_type: SportType = SportType.DARTS


class EventUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[EventStatus] = None
    max_participants: Optional[int] = Field(None, gt=0)
    sport_type: Optional[SportType] = None


class EventResponse(EventBase):
    id: UUID
    status: EventStatus
    sport_type: SportType
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Event Entry schemas
class EventEntryBase(BaseModel):
    notes: Optional[str] = Field(None, max_length=500)


class EventEntryCreate(EventEntryBase):
    pass


class EventEntryUpdate(BaseModel):
    paid: Optional[bool] = None
    notes: Optional[str] = None


class EventEntryResponse(EventEntryBase):
    id: UUID
    event_id: UUID
    player_id: UUID
    checked_in: Optional[datetime]
    paid: bool
    created_at: datetime

    class Config:
        from_attributes = True
