from datetime import datetime, timedelta
from typing import Optional
import asyncio
from jose import JWTError, jwt
from passlib.context import CryptContext
from backend.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _verify_password_sync(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _get_password_hash_sync(password: str) -> str:
    password_bytes = password.encode('utf-8')[:72]
    return pwd_context.hash(password_bytes.decode('utf-8', errors='ignore'))


async def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash. Runs bcrypt in thread pool to avoid blocking."""
    return await asyncio.to_thread(_verify_password_sync, plain_password, hashed_password)


async def get_password_hash(password: str) -> str:
    """Hash a password. Runs bcrypt in thread pool to avoid blocking.

    Note: bcrypt has a 72-byte password limit. Passwords are truncated if needed.
    """
    return await asyncio.to_thread(_get_password_hash_sync, password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None
