from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class PlayerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    skill_level: int = Field(default=0, ge=0, le=3)


class PlayerCreate(PlayerBase):
    password: str = Field(..., min_length=8, max_length=100)


class PlayerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    skill_level: Optional[int] = Field(None, ge=0, le=3)
    is_active: Optional[bool] = None


class PlayerResponse(PlayerBase):
    id: UUID
    is_active: bool
    qr_code: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PlayerLogin(BaseModel):
    email: EmailStr
    password: str
