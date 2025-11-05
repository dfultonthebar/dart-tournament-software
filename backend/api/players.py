from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from backend.core import get_db
from backend.models import Player
from backend.schemas import PlayerResponse, PlayerUpdate
from backend.api.auth import get_current_player

router = APIRouter(prefix="/players", tags=["players"])


@router.get("", response_model=List[PlayerResponse])
async def list_players(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """List all players."""
    result = await db.execute(
        select(Player).offset(skip).limit(limit).order_by(Player.name)
    )
    players = result.scalars().all()
    return players


@router.get("/{player_id}", response_model=PlayerResponse)
async def get_player(
    player_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific player by ID."""
    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalar_one_or_none()

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    return player


@router.patch("/{player_id}", response_model=PlayerResponse)
async def update_player(
    player_id: UUID,
    player_update: PlayerUpdate,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Update player information (only own profile)."""
    if current_player.id != player_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only update own profile"
        )

    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalar_one_or_none()

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Update fields
    update_data = player_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(player, field, value)

    await db.flush()
    await db.refresh(player)

    return player


@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_player(
    player_id: UUID,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Soft delete player (set inactive)."""
    if current_player.id != player_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only delete own account"
        )

    result = await db.execute(select(Player).where(Player.id == player_id))
    player = result.scalar_one_or_none()

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    player.is_active = False
    await db.flush()

    return None
