from sqlalchemy import Column, String, Boolean
from backend.models.base import BaseModel


class Admin(BaseModel):
    """System administrator - separate from tournament players."""
    __tablename__ = "admins"

    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    pin = Column(String(4), nullable=True)  # 4-digit PIN for quick login
    hashed_password = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_super_admin = Column(Boolean, default=False, nullable=False)  # Can manage other admins
