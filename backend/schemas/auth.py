from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


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


class PinLoginRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Player name for lookup")
    pin: str = Field(..., min_length=4, max_length=4, pattern=r'^\d{4}$', description="4-digit PIN")


class PlayerRegisterRequest(BaseModel):
    """Player registration with required contact info and marketing opt-in."""
    name: str = Field(..., min_length=2, max_length=100, description="Player's full name")
    pin: str = Field(..., min_length=4, max_length=4, pattern=r'^\d{4}$', description="4-digit PIN")
    email: EmailStr = Field(..., description="Email address (required)")
    phone: str = Field(..., min_length=10, max_length=20, description="Phone number (required)")
    marketing_opt_in: bool = Field(False, description="Opt-in to receive texts/emails about tournaments and specials")
    gender: Optional[Literal['M', 'F']] = Field(None, description="Player gender (M or F)")
