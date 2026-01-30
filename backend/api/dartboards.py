from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID

from backend.core import get_db
from backend.models import Dartboard, Match, MatchStatus
from backend.schemas import DartboardCreate, DartboardUpdate, DartboardResponse
from backend.api.auth import get_current_admin_or_player

router = APIRouter(prefix="/dartboards", tags=["dartboards"])


@router.post("", response_model=DartboardResponse, status_code=status.HTTP_201_CREATED)
async def create_dartboard(
    dartboard_create: DartboardCreate,
    current_player=Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Create a new dartboard (admin only)."""
    # Check if board number already exists
    result = await db.execute(
        select(Dartboard).where(Dartboard.number == dartboard_create.number)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dartboard with number {dartboard_create.number} already exists"
        )

    dartboard = Dartboard(
        number=dartboard_create.number,
        name=dartboard_create.name,
        is_available=True
    )
    db.add(dartboard)
    await db.flush()
    await db.refresh(dartboard)

    return dartboard


@router.get("", response_model=List[DartboardResponse])
async def list_dartboards(
    is_available: Optional[bool] = Query(None, description="Filter by availability"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """List all dartboards with optional availability filter."""
    query = select(Dartboard).offset(skip).limit(limit)

    if is_available is not None:
        query = query.where(Dartboard.is_available == is_available)

    query = query.order_by(Dartboard.number)

    result = await db.execute(query)
    dartboards = result.scalars().all()

    return dartboards


@router.get("/available", response_model=List[DartboardResponse])
async def list_available_dartboards(
    db: AsyncSession = Depends(get_db)
):
    """List only available dartboards."""
    result = await db.execute(
        select(Dartboard)
        .where(Dartboard.is_available == True)
        .order_by(Dartboard.number)
    )
    dartboards = result.scalars().all()

    return dartboards


@router.get("/{dartboard_id}", response_model=DartboardResponse)
async def get_dartboard(
    dartboard_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific dartboard."""
    result = await db.execute(
        select(Dartboard).where(Dartboard.id == dartboard_id)
    )
    dartboard = result.scalar_one_or_none()

    if not dartboard:
        raise HTTPException(status_code=404, detail="Dartboard not found")

    return dartboard


@router.patch("/{dartboard_id}", response_model=DartboardResponse)
async def update_dartboard(
    dartboard_id: UUID,
    dartboard_update: DartboardUpdate,
    current_player=Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Update dartboard details."""
    result = await db.execute(
        select(Dartboard).where(Dartboard.id == dartboard_id)
    )
    dartboard = result.scalar_one_or_none()

    if not dartboard:
        raise HTTPException(status_code=404, detail="Dartboard not found")

    update_data = dartboard_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dartboard, field, value)

    await db.flush()
    await db.refresh(dartboard)

    return dartboard


@router.delete("/{dartboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dartboard(
    dartboard_id: UUID,
    current_player=Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Delete a dartboard."""
    result = await db.execute(
        select(Dartboard).where(Dartboard.id == dartboard_id)
    )
    dartboard = result.scalar_one_or_none()

    if not dartboard:
        raise HTTPException(status_code=404, detail="Dartboard not found")

    # Check if dartboard is currently assigned to an active match
    result = await db.execute(
        select(Match).where(
            Match.dartboard_id == dartboard_id,
            Match.status.in_([MatchStatus.PENDING, MatchStatus.IN_PROGRESS])
        )
    )
    active_match = result.scalar_one_or_none()
    if active_match:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete dartboard that is assigned to an active match"
        )

    db.delete(dartboard)
    await db.flush()

    return None


@router.post("/matches/{match_id}/assign-board/{dartboard_id}", response_model=DartboardResponse)
async def assign_board_to_match(
    match_id: UUID,
    dartboard_id: UUID,
    current_player=Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Assign a dartboard to a match. Sets the board as unavailable.
    Uses row-level locking to prevent race conditions."""
    # Get the match
    result = await db.execute(
        select(Match).where(Match.id == match_id)
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.status == MatchStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign board to completed match"
        )

    # Get the dartboard WITH ROW LOCK to prevent race conditions
    # This ensures only one transaction can check/modify this row at a time
    result = await db.execute(
        select(Dartboard)
        .where(Dartboard.id == dartboard_id)
        .with_for_update()  # Lock the row
    )
    dartboard = result.scalar_one_or_none()
    if not dartboard:
        raise HTTPException(status_code=404, detail="Dartboard not found")

    if not dartboard.is_available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dartboard is not available"
        )

    # Release any previously assigned board
    if match.dartboard_id:
        result = await db.execute(
            select(Dartboard)
            .where(Dartboard.id == match.dartboard_id)
            .with_for_update()
        )
        old_dartboard = result.scalar_one_or_none()
        if old_dartboard:
            old_dartboard.is_available = True

    # Assign the new board
    match.dartboard_id = dartboard_id
    dartboard.is_available = False

    await db.flush()
    await db.refresh(dartboard)

    return dartboard


@router.post("/matches/{match_id}/release-board", response_model=Optional[DartboardResponse])
async def release_board_from_match(
    match_id: UUID,
    current_player=Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Release a dartboard from a match. Sets the board as available."""
    # Get the match
    result = await db.execute(
        select(Match).where(Match.id == match_id)
    )
    match = result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if not match.dartboard_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Match has no dartboard assigned"
        )

    # Get and release the dartboard
    result = await db.execute(
        select(Dartboard).where(Dartboard.id == match.dartboard_id)
    )
    dartboard = result.scalar_one_or_none()
    if dartboard:
        dartboard.is_available = True

    match.dartboard_id = None

    await db.flush()
    if dartboard:
        await db.refresh(dartboard)

    return dartboard
