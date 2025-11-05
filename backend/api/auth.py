from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from uuid import UUID

from backend.core import get_db, verify_password, get_password_hash, create_access_token, decode_access_token
from backend.models import Player
from backend.schemas import (
    Token,
    LoginRequest,
    RegisterRequest,
    PlayerResponse,
    PasswordChange,
)

router = APIRouter(prefix="/auth", tags=["authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


async def get_current_player(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Player:
    """Dependency to get current authenticated player."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    player_id: Optional[str] = payload.get("sub")
    if player_id is None:
        raise credentials_exception

    try:
        player_uuid = UUID(player_id)
    except ValueError:
        raise credentials_exception

    result = await db.execute(select(Player).where(Player.id == player_uuid))
    player = result.scalar_one_or_none()

    if player is None:
        raise credentials_exception

    if not player.is_active:
        raise HTTPException(status_code=400, detail="Inactive player")

    return player


@router.post("/register", response_model=PlayerResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new player."""
    # Check if email already exists
    result = await db.execute(select(Player).where(Player.email == request.email))
    existing_player = result.scalar_one_or_none()

    if existing_player:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new player
    hashed_password = get_password_hash(request.password)
    new_player = Player(
        name=request.name,
        email=request.email,
        phone=request.phone,
        hashed_password=hashed_password,
    )

    db.add(new_player)
    await db.flush()
    await db.refresh(new_player)

    return new_player


@router.post("/login", response_model=Token)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Login with email and password."""
    result = await db.execute(select(Player).where(Player.email == request.email))
    player = result.scalar_one_or_none()

    if not player or not verify_password(request.password, player.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not player.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive"
        )

    access_token = create_access_token(data={"sub": str(player.id), "email": player.email})

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/token", response_model=Token)
async def token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """OAuth2 compatible token endpoint."""
    result = await db.execute(select(Player).where(Player.email == form_data.username))
    player = result.scalar_one_or_none()

    if not player or not verify_password(form_data.password, player.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not player.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive"
        )

    access_token = create_access_token(data={"sub": str(player.id), "email": player.email})

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=PlayerResponse)
async def get_me(current_player: Player = Depends(get_current_player)):
    """Get current player information."""
    return current_player


@router.post("/change-password")
async def change_password(
    request: PasswordChange,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Change player password."""
    if not verify_password(request.current_password, current_player.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )

    current_player.hashed_password = get_password_hash(request.new_password)
    await db.flush()

    return {"message": "Password updated successfully"}
