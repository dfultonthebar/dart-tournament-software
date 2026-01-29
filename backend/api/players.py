from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List

from backend.core import get_db
from backend.api.auth import get_current_admin_or_player
from backend.models import Player, Admin
from backend.schemas import PlayerResponse, PlayerUpdate, PlayerSelfRegister
from sqlalchemy import or_

router = APIRouter(prefix="/players", tags=["players"])


@router.post("/register", response_model=PlayerResponse, status_code=status.HTTP_201_CREATED)
async def self_register(
    request: PlayerSelfRegister,
    db: AsyncSession = Depends(get_db)
):
    """
    Public endpoint for player self-registration.

    No authentication required. Players can register themselves with name, email, and phone.
    The system will assign a PIN for quick login later.
    """
    # Check for duplicate email or phone
    result = await db.execute(
        select(Player).where(
            or_(
                Player.email == request.email,
                Player.phone == request.phone
            )
        )
    )
    existing_player = result.scalar_one_or_none()

    if existing_player:
        if existing_player.email == request.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        if existing_player.phone == request.phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number already registered"
            )

    # Create new player (no password, PIN can be set later)
    new_player = Player(
        name=request.name,
        nickname=request.nickname,
        email=request.email,
        phone=request.phone,
    )

    db.add(new_player)
    await db.flush()
    await db.refresh(new_player)

    return new_player


@router.get("", response_model=List[PlayerResponse])
async def list_players(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """List all players."""
    result = await db.execute(
        select(Player)
        .where(Player.is_active == True)
        .offset(skip)
        .limit(limit)
        .order_by(Player.name)
    )
    return result.scalars().all()


@router.get("/{player_id}", response_model=PlayerResponse)
async def get_player(
    player_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a single player."""
    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player


@router.patch("/{player_id}", response_model=PlayerResponse)
async def update_player(
    player_id: UUID,
    player_update: PlayerUpdate,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Update player profile."""
    if current_player.id != player_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only update own profile"
        )

    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalar_one_or_none()

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    update_data = player_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(player, field, value)

    await db.flush()
    await db.refresh(player)
    return player


@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_player(
    player_id: UUID,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Hard delete player from database. Admin can delete any player."""
    is_admin = isinstance(current_player, Admin)
    if current_player.id != player_id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only delete own account"
        )

    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalar_one_or_none()

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Admins are in a separate table now, no check needed here

    # Hard delete - remove from database (NO await on delete)
    db.delete(player)
    await db.commit()

    return None
