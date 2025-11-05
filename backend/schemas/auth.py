from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    player_id: Optional[UUID] = None
    email: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)
