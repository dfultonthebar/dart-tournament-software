from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
from datetime import datetime

from backend.core import get_db
from backend.models import Tournament, TournamentEntry, Player, Match, MatchPlayer, TournamentStatus
from backend.schemas import (
    TournamentCreate,
    TournamentUpdate,
    TournamentResponse,
    TournamentEntryCreate,
    TournamentEntryResponse,
)
from backend.services import BracketService
from backend.api.auth import get_current_player

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


@router.post("", response_model=TournamentResponse, status_code=status.HTTP_201_CREATED)
async def create_tournament(
    tournament: TournamentCreate,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Create a new tournament."""
    new_tournament = Tournament(**tournament.model_dump())
    db.add(new_tournament)
    await db.flush()
    await db.refresh(new_tournament)

    return new_tournament


@router.get("", response_model=List[TournamentResponse])
async def list_tournaments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status_filter: TournamentStatus = None,
    db: AsyncSession = Depends(get_db)
):
    """List tournaments with optional status filter."""
    query = select(Tournament).offset(skip).limit(limit).order_by(Tournament.created_at.desc())

    if status_filter:
        query = query.where(Tournament.status == status_filter)

    result = await db.execute(query)
    tournaments = result.scalars().all()
    return tournaments


@router.get("/{tournament_id}", response_model=TournamentResponse)
async def get_tournament(
    tournament_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific tournament."""
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    return tournament


@router.patch("/{tournament_id}", response_model=TournamentResponse)
async def update_tournament(
    tournament_id: UUID,
    tournament_update: TournamentUpdate,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Update tournament details."""
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    update_data = tournament_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tournament, field, value)

    await db.flush()
    await db.refresh(tournament)

    return tournament


@router.post("/{tournament_id}/entries", response_model=TournamentEntryResponse, status_code=status.HTTP_201_CREATED)
async def register_for_tournament(
    tournament_id: UUID,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Register current player for a tournament."""
    # Check tournament exists and is accepting registration
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    if tournament.status not in [TournamentStatus.DRAFT, TournamentStatus.REGISTRATION]:
        raise HTTPException(status_code=400, detail="Tournament not accepting registrations")

    # Check if already registered
    result = await db.execute(
        select(TournamentEntry).where(
            TournamentEntry.tournament_id == tournament_id,
            TournamentEntry.player_id == current_player.id
        )
    )
    existing_entry = result.scalar_one_or_none()

    if existing_entry:
        raise HTTPException(status_code=400, detail="Already registered for this tournament")

    # Check max players
    if tournament.max_players:
        result = await db.execute(
            select(TournamentEntry).where(TournamentEntry.tournament_id == tournament_id)
        )
        entry_count = len(result.scalars().all())

        if entry_count >= tournament.max_players:
            raise HTTPException(status_code=400, detail="Tournament is full")

    # Create entry
    entry = TournamentEntry(
        tournament_id=tournament_id,
        player_id=current_player.id
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)

    return entry


@router.get("/{tournament_id}/entries", response_model=List[TournamentEntryResponse])
async def list_tournament_entries(
    tournament_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """List all players registered for a tournament."""
    result = await db.execute(
        select(TournamentEntry)
        .where(TournamentEntry.tournament_id == tournament_id)
        .order_by(TournamentEntry.seed)
    )
    entries = result.scalars().all()
    return entries


@router.post("/{tournament_id}/start", response_model=TournamentResponse)
async def start_tournament(
    tournament_id: UUID,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Start a tournament and generate brackets."""
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    if tournament.status != TournamentStatus.REGISTRATION:
        raise HTTPException(status_code=400, detail="Tournament must be in registration status")

    # Get all entries
    result = await db.execute(
        select(TournamentEntry).where(TournamentEntry.tournament_id == tournament_id)
    )
    entries = result.scalars().all()

    if len(entries) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players to start tournament")

    # Generate seeds based on skill level
    result = await db.execute(
        select(Player).where(Player.id.in_([e.player_id for e in entries]))
    )
    players = {p.id: p for p in result.scalars().all()}
    skill_levels = {pid: players[pid].skill_level for pid in players}

    seeds = BracketService.seed_players(list(players.keys()), skill_levels)

    # Update entry seeds
    for entry in entries:
        entry.seed = seeds.get(entry.player_id)

    # Generate bracket
    player_ids = [e.player_id for e in sorted(entries, key=lambda x: x.seed or 999)]

    if tournament.format.value == "single_elimination":
        matches_data = BracketService.generate_single_elimination(player_ids, seeds)
    elif tournament.format.value == "double_elimination":
        matches_data = BracketService.generate_double_elimination(player_ids, seeds)
    elif tournament.format.value == "round_robin":
        matches_data = BracketService.generate_round_robin(player_ids)
    else:
        raise HTTPException(status_code=400, detail="Unknown tournament format")

    # Create matches
    for match_data in matches_data:
        match = Match(
            tournament_id=tournament_id,
            round_number=match_data["round"],
            match_number=match_data["match_number"],
            bracket_position=match_data.get("bracket_position")
        )
        db.add(match)
        await db.flush()

        # Add players to match
        for i, player_id in enumerate([match_data["player1_id"], match_data["player2_id"]], 1):
            match_player = MatchPlayer(
                match_id=match.id,
                player_id=player_id,
                position=i
            )
            db.add(match_player)

    # Update tournament status
    tournament.status = TournamentStatus.IN_PROGRESS
    tournament.start_time = datetime.utcnow()

    await db.flush()
    await db.refresh(tournament)

    return tournament


@router.delete("/{tournament_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tournament(
    tournament_id: UUID,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Delete a tournament (only if not started)."""
    result = await db.execute(select(Tournament).where(Tournament.id == tournament_id))
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    if tournament.status not in [TournamentStatus.DRAFT, TournamentStatus.REGISTRATION]:
        raise HTTPException(status_code=400, detail="Cannot delete tournament that has started")

    await db.delete(tournament)
    await db.flush()

    return None
