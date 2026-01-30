from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from backend.core import get_db
from backend.models import Event, EventEntry, EventStatus, Player, Tournament, Admin
from backend.schemas import (
    EventCreate,
    EventUpdate,
    EventResponse,
    EventEntryCreate,
    EventEntryUpdate,
    EventEntryResponse,
    TournamentResponse,
)
from backend.api.auth import get_current_admin_or_player

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_create: EventCreate,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Create a new event (admin only)."""
    event = Event(
        name=event_create.name,
        description=event_create.description,
        location=event_create.location,
        start_date=event_create.start_date,
        end_date=event_create.end_date,
        max_participants=event_create.max_participants,
        sport_type=event_create.sport_type,
        status=EventStatus.DRAFT
    )
    db.add(event)
    await db.flush()
    await db.commit()
    await db.refresh(event)

    return event


@router.get("", response_model=List[EventResponse])
async def list_events(
    status_filter: Optional[EventStatus] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """List all events with optional status filter."""
    query = select(Event).offset(skip).limit(limit)

    if status_filter is not None:
        query = query.where(Event.status == status_filter)

    query = query.order_by(Event.start_date.desc())

    result = await db.execute(query)
    events = result.scalars().all()

    return events


@router.post("/archive-completed")
async def archive_completed_events(
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Archive (delete) all completed and cancelled events. Admin only."""
    if not isinstance(current_player, Admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can archive events"
        )

    result = await db.execute(
        select(Event).where(
            Event.status.in_([EventStatus.COMPLETED, EventStatus.CANCELLED])
        )
    )
    events_to_archive = result.scalars().all()

    archived_events = [
        {"id": str(event.id), "name": event.name, "status": event.status.value}
        for event in events_to_archive
    ]

    for event in events_to_archive:
        await db.delete(event)

    await db.flush()

    return {"archived_count": len(archived_events), "archived_events": archived_events}


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific event."""
    result = await db.execute(
        select(Event).where(Event.id == event_id)
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return event


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: UUID,
    event_update: EventUpdate,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Update event details."""
    result = await db.execute(
        select(Event).where(Event.id == event_id)
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = event_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)

    await db.flush()
    await db.refresh(event)

    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: UUID,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Delete an event."""
    result = await db.execute(
        select(Event).where(Event.id == event_id)
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check if event has active tournaments
    result = await db.execute(
        select(Tournament).where(
            Tournament.event_id == event_id
        )
    )
    tournaments = result.scalars().all()
    if tournaments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete event with associated tournaments"
        )

    db.delete(event)
    await db.flush()

    return None


# Event Entry endpoints
@router.post("/{event_id}/entries", response_model=EventEntryResponse, status_code=status.HTTP_201_CREATED)
async def register_for_event(
    event_id: UUID,
    entry_create: EventEntryCreate,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Register current player for an event."""
    # Check event exists and is open for registration
    result = await db.execute(
        select(Event).where(Event.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.status != EventStatus.REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event is not open for registration"
        )

    # Check if player is already registered
    result = await db.execute(
        select(EventEntry).where(
            EventEntry.event_id == event_id,
            EventEntry.player_id == current_player.id
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already registered for this event"
        )

    # Check max participants
    if event.max_participants:
        result = await db.execute(
            select(func.count()).select_from(EventEntry).where(EventEntry.event_id == event_id)
        )
        current_count = result.scalar()
        if current_count >= event.max_participants:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Event is at maximum capacity"
            )

    entry = EventEntry(
        event_id=event_id,
        player_id=current_player.id,
        notes=entry_create.notes,
        paid=False
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)

    return entry


@router.post("/{event_id}/entries/{player_id}", response_model=EventEntryResponse, status_code=status.HTTP_201_CREATED)
async def add_player_to_event(
    event_id: UUID,
    player_id: UUID,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Add a specific player to an event (admin only)."""
    # Check if current user is admin
    is_admin = isinstance(current_player, Admin)
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can add other players"
        )

    # Check event exists
    result = await db.execute(
        select(Event).where(Event.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check player exists
    result = await db.execute(
        select(Player).where(Player.id == player_id)
    )
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Check if player is already registered
    result = await db.execute(
        select(EventEntry).where(
            EventEntry.event_id == event_id,
            EventEntry.player_id == player_id
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Player already registered for this event"
        )

    # Check max participants
    if event.max_participants:
        result = await db.execute(
            select(func.count()).select_from(EventEntry).where(EventEntry.event_id == event_id)
        )
        current_count = result.scalar()
        if current_count >= event.max_participants:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Event is at maximum capacity"
            )

    entry = EventEntry(
        event_id=event_id,
        player_id=player_id,
        paid=False
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)

    return entry


@router.get("/{event_id}/entries", response_model=List[EventEntryResponse])
async def list_event_entries(
    event_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """List all entries for an event."""
    # Check event exists
    result = await db.execute(
        select(Event).where(Event.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    result = await db.execute(
        select(EventEntry)
        .where(EventEntry.event_id == event_id)
        .offset(skip)
        .limit(limit)
        .order_by(EventEntry.created_at)
    )
    entries = result.scalars().all()

    return entries


@router.patch("/{event_id}/entries/{entry_id}", response_model=EventEntryResponse)
async def update_event_entry(
    event_id: UUID,
    entry_id: UUID,
    entry_update: EventEntryUpdate,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Update an event entry (admin can update any, player can update own)."""
    result = await db.execute(
        select(EventEntry).where(
            EventEntry.id == entry_id,
            EventEntry.event_id == event_id
        )
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # Only admin or the entry owner can update
    is_admin = isinstance(current_player, Admin)
    if entry.player_id != current_player.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only update own entry"
        )

    update_data = entry_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(entry, field, value)

    await db.flush()
    await db.refresh(entry)

    return entry


@router.delete("/{event_id}/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event_entry(
    event_id: UUID,
    entry_id: UUID,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Remove a registration from an event."""
    result = await db.execute(
        select(EventEntry).where(
            EventEntry.id == entry_id,
            EventEntry.event_id == event_id
        )
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # Only admin or the entry owner can delete
    is_admin = isinstance(current_player, Admin)
    if entry.player_id != current_player.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only delete own entry"
        )

    db.delete(entry)
    await db.flush()

    return None


@router.post("/{event_id}/entries/{entry_id}/check-in", response_model=EventEntryResponse)
async def check_in_entry(
    event_id: UUID,
    entry_id: UUID,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Check in a player for an event."""
    result = await db.execute(
        select(EventEntry).where(
            EventEntry.id == entry_id,
            EventEntry.event_id == event_id
        )
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if entry.checked_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already checked in"
        )

    entry.checked_in = datetime.utcnow()

    await db.flush()
    await db.refresh(entry)

    return entry


@router.get("/{event_id}/tournaments", response_model=List[TournamentResponse])
async def list_event_tournaments(
    event_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """List all tournaments for an event."""
    # Check event exists
    result = await db.execute(
        select(Event).where(Event.id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    result = await db.execute(
        select(Tournament)
        .where(Tournament.event_id == event_id)
        .offset(skip)
        .limit(limit)
        .order_by(Tournament.created_at.desc())
    )
    tournaments = result.scalars().all()

    return tournaments
