from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class AdminBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: Optional[EmailStr] = None


class AdminCreate(AdminBase):
    pin: str = Field(..., min_length=4, max_length=4, pattern=r'^\d{4}$')
    password: Optional[str] = Field(None, min_length=6)
    is_super_admin: bool = False


class AdminUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    pin: Optional[str] = Field(None, min_length=4, max_length=4, pattern=r'^\d{4}$')
    is_active: Optional[bool] = None
    is_super_admin: Optional[bool] = None


class AdminResponse(AdminBase):
    id: UUID
    is_active: bool
    is_super_admin: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AdminLoginRequest(BaseModel):
    """Admin login with name and PIN."""
    name: str
    pin: str = Field(..., min_length=4, max_length=4)
