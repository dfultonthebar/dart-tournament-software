from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class DartboardCreate(BaseModel):
    number: int = Field(..., gt=0)
    name: Optional[str] = Field(None, max_length=100)


class DartboardUpdate(BaseModel):
    name: Optional[str] = None
    is_available: Optional[bool] = None


class DartboardResponse(BaseModel):
    id: UUID
    number: int
    name: Optional[str]
    is_available: bool
    created_at: datetime

    class Config:
        from_attributes = True
