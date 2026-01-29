from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from datetime import datetime
import math

from backend.core import get_db
from backend.models import (
    Tournament,
    TournamentEntry,
    TournamentStatus,
    TournamentFormat,
    Player,
    Match,
    MatchPlayer,
    MatchStatus,
    Team,
    Admin,
    Event,
)
from backend.schemas import (
    TournamentCreate,
    TournamentUpdate,
    TournamentResponse,
    TournamentEntryCreate,
    TournamentEntryUpdate,
    TournamentEntryResponse,
    TeamWithPlayers,
)
from backend.api.auth import get_current_admin_or_player

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


@router.post("", response_model=TournamentResponse, status_code=status.HTTP_201_CREATED)
async def create_tournament(
    tournament_create: TournamentCreate,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Create a new tournament (admin only). Requires event_id."""
    # Validate event exists
    result = await db.execute(
        select(Event).where(Event.id == tournament_create.event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event not found. All tournaments must belong to an event."
        )

    tournament = Tournament(
        name=tournament_create.name,
        description=tournament_create.description,
        game_type=tournament_create.game_type,
        format=tournament_create.format,
        max_players=tournament_create.max_players,
        scheduled_date=tournament_create.scheduled_date,
        scheduled_time=tournament_create.scheduled_time,
        starting_score=tournament_create.starting_score,
        legs_to_win=tournament_create.legs_to_win,
        sets_to_win=tournament_create.sets_to_win,
        double_in=tournament_create.double_in,
        double_out=tournament_create.double_out,
        master_out=tournament_create.master_out,
        event_id=tournament_create.event_id,
        status=TournamentStatus.DRAFT
    )
    db.add(tournament)
    await db.flush()
    await db.refresh(tournament)

    return tournament


@router.get("", response_model=List[TournamentResponse])
async def list_tournaments(
    status_filter: Optional[TournamentStatus] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """List all tournaments with optional status filter."""
    query = select(Tournament).offset(skip).limit(limit)

    if status_filter is not None:
        query = query.where(Tournament.status == status_filter)

    query = query.order_by(Tournament.created_at.desc())

    result = await db.execute(query)
    tournaments = result.scalars().all()

    return tournaments


@router.get("/{tournament_id}", response_model=TournamentResponse)
async def get_tournament(
    tournament_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific tournament."""
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    return tournament


@router.patch("/{tournament_id}", response_model=TournamentResponse)
async def update_tournament(
    tournament_id: UUID,
    tournament_update: TournamentUpdate,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Update tournament details."""
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    update_data = tournament_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tournament, field, value)

    await db.flush()
    await db.refresh(tournament)

    return tournament


@router.delete("/{tournament_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tournament(
    tournament_id: UUID,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Delete a tournament."""
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # Check if tournament is in progress
    if tournament.status == TournamentStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete tournament that is in progress"
        )

    db.delete(tournament)
    await db.flush()

    return None


# Tournament Entry endpoints
@router.post("/{tournament_id}/entries", response_model=TournamentEntryResponse, status_code=status.HTTP_201_CREATED)
async def register_for_tournament(
    tournament_id: UUID,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Register current player for a tournament."""
    # Check tournament exists and is open for registration
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    if tournament.status != TournamentStatus.REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tournament is not open for registration"
        )

    # Check if player is already registered
    result = await db.execute(
        select(TournamentEntry).where(
            TournamentEntry.tournament_id == tournament_id,
            TournamentEntry.player_id == current_player.id
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already registered for this tournament"
        )

    # Check max players
    if tournament.max_players:
        result = await db.execute(
            select(TournamentEntry).where(TournamentEntry.tournament_id == tournament_id)
        )
        current_count = len(result.scalars().all())
        if current_count >= tournament.max_players:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tournament is at maximum capacity"
            )

    entry = TournamentEntry(
        tournament_id=tournament_id,
        player_id=current_player.id,
        paid=False
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)

    return entry


@router.post("/{tournament_id}/entries/{player_id}", response_model=TournamentEntryResponse, status_code=status.HTTP_201_CREATED)
async def add_player_to_tournament(
    tournament_id: UUID,
    player_id: UUID,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Add a specific player to a tournament (admin only)."""
    # Check if current user is admin
    is_admin = isinstance(current_player, Admin)
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can add other players"
        )

    # Check tournament exists
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # Check player exists
    result = await db.execute(
        select(Player).where(Player.id == player_id)
    )
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Check if player is already registered
    result = await db.execute(
        select(TournamentEntry).where(
            TournamentEntry.tournament_id == tournament_id,
            TournamentEntry.player_id == player_id
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Player already registered for this tournament"
        )

    # Check max players
    if tournament.max_players:
        result = await db.execute(
            select(TournamentEntry).where(TournamentEntry.tournament_id == tournament_id)
        )
        current_count = len(result.scalars().all())
        if current_count >= tournament.max_players:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tournament is at maximum capacity"
            )

    entry = TournamentEntry(
        tournament_id=tournament_id,
        player_id=player_id,
        paid=False
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)

    return entry


@router.get("/{tournament_id}/entries", response_model=List[TournamentEntryResponse])
async def list_tournament_entries(
    tournament_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """List all entries for a tournament."""
    # Check tournament exists
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    result = await db.execute(
        select(TournamentEntry)
        .where(TournamentEntry.tournament_id == tournament_id)
        .offset(skip)
        .limit(limit)
        .order_by(TournamentEntry.seed.nullsfirst(), TournamentEntry.created_at)
    )
    entries = result.scalars().all()

    return entries


@router.patch("/{tournament_id}/entries/{entry_id}", response_model=TournamentEntryResponse)
async def update_tournament_entry(
    tournament_id: UUID,
    entry_id: UUID,
    entry_update: TournamentEntryUpdate,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Update a tournament entry (admin can update any, player can update own)."""
    result = await db.execute(
        select(TournamentEntry).where(
            TournamentEntry.id == entry_id,
            TournamentEntry.tournament_id == tournament_id
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


@router.delete("/{tournament_id}/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tournament_entry(
    tournament_id: UUID,
    entry_id: UUID,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Remove a registration from a tournament."""
    result = await db.execute(
        select(TournamentEntry).where(
            TournamentEntry.id == entry_id,
            TournamentEntry.tournament_id == tournament_id
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

    # Check if tournament has started
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()
    if tournament and tournament.status == TournamentStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot withdraw from tournament that has started"
        )

    db.delete(entry)
    await db.flush()

    return None


@router.post("/{tournament_id}/entries/{entry_id}/check-in", response_model=TournamentEntryResponse)
async def check_in_entry(
    tournament_id: UUID,
    entry_id: UUID,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Check in a player for a tournament."""
    result = await db.execute(
        select(TournamentEntry).where(
            TournamentEntry.id == entry_id,
            TournamentEntry.tournament_id == tournament_id
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


@router.post("/{tournament_id}/generate-bracket", response_model=TournamentResponse)
async def generate_bracket(
    tournament_id: UUID,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate bracket and matches for a tournament.
    Changes tournament status to IN_PROGRESS.
    """
    # Get tournament with entries
    result = await db.execute(
        select(Tournament)
        .options(selectinload(Tournament.entries))
        .where(Tournament.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    if tournament.status != TournamentStatus.REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tournament must be in registration status to generate bracket"
        )

    # Lucky Draw Doubles uses teams instead of individual entries
    if tournament.format == TournamentFormat.LUCKY_DRAW_DOUBLES:
        await _generate_lucky_draw_doubles_bracket(tournament, db)
    else:
        # Get entries that are both checked-in AND paid
        ready_entries = [e for e in tournament.entries if e.checked_in and e.paid]
        unpaid_checked_in = [e for e in tournament.entries if e.checked_in and not e.paid]

        if unpaid_checked_in:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot start tournament: {len(unpaid_checked_in)} checked-in player(s) have not paid yet"
            )

        if len(ready_entries) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Need at least 2 paid and checked-in players to generate bracket"
            )

        checked_in_entries = ready_entries  # Use only paid entries

        # Sort by seed (if set) or check-in time
        sorted_entries = sorted(
            checked_in_entries,
            key=lambda e: (e.seed if e.seed else float('inf'), e.checked_in)
        )

        if tournament.format == TournamentFormat.SINGLE_ELIMINATION:
            await _generate_single_elimination_bracket(tournament, sorted_entries, db)
        elif tournament.format == TournamentFormat.DOUBLE_ELIMINATION:
            await _generate_double_elimination_bracket(tournament, sorted_entries, db)
        elif tournament.format == TournamentFormat.ROUND_ROBIN:
            await _generate_round_robin_bracket(tournament, sorted_entries, db)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Bracket generation not supported for format: {tournament.format}"
            )

    tournament.status = TournamentStatus.IN_PROGRESS
    tournament.start_time = datetime.utcnow()

    await db.flush()
    await db.refresh(tournament)

    return tournament


async def _generate_single_elimination_bracket(
    tournament: Tournament,
    entries: List[TournamentEntry],
    db: AsyncSession
):
    """Generate single elimination bracket with minimal byes.

    Uses a flexible bracket structure where each round pairs up teams,
    giving exactly 1 bye per round if the count is odd. This means:
    - 11 teams: R1 has 5 matches + 1 bye (not 5 byes in a 16-bracket)
    - 16 teams: R1 has 8 matches, no byes (perfect power of 2)

    The advancement formula (match_in_round + 1) // 2 still works because
    matches are numbered sequentially within each round and each pair of
    matches feeds into the next round's match.
    """
    num_entries = len(entries)

    # Calculate round structure: how many match slots per round
    round_sizes = []
    remaining = num_entries
    while remaining > 1:
        match_slots = (remaining + 1) // 2  # ceil(remaining / 2)
        round_sizes.append(match_slots)
        remaining = match_slots  # each slot produces 1 winner

    num_rounds = len(round_sizes)

    # Create all matches for all rounds
    matches_by_round = {}
    match_number = 1

    for round_num in range(1, num_rounds + 1):
        matches_in_round = round_sizes[round_num - 1]
        matches_by_round[round_num] = []

        for match_idx in range(matches_in_round):
            match = Match(
                tournament_id=tournament.id,
                round_number=round_num,
                match_number=match_number,
                bracket_position=f"R{round_num}M{match_idx + 1}",
                status=MatchStatus.PENDING
            )
            db.add(match)
            matches_by_round[round_num].append(match)
            match_number += 1

    await db.flush()

    # Seed R1: pair entries sequentially, last entry gets bye if odd count
    first_round_matches = matches_by_round[1]
    entry_idx = 0

    for match_idx, match in enumerate(first_round_matches):
        # Position 1
        if entry_idx < num_entries:
            mp1 = MatchPlayer(
                match_id=match.id,
                player_id=entries[entry_idx].player_id,
                position=1,
                sets_won=0,
                legs_won=0
            )
            db.add(mp1)
            entry_idx += 1

        # Position 2 (may be empty if this is the bye match)
        if entry_idx < num_entries:
            mp2 = MatchPlayer(
                match_id=match.id,
                player_id=entries[entry_idx].player_id,
                position=2,
                sets_won=0,
                legs_won=0
            )
            db.add(mp2)
            entry_idx += 1

    await db.flush()

    # Auto-complete bye matches (1 player) and cascade
    from backend.api.matches import _advance_winner_in_bracket
    for match in first_round_matches:
        await db.refresh(match, attribute_names=["match_players"])
        player_count = len(match.match_players)
        if player_count == 1:
            match.status = MatchStatus.COMPLETED
            match.completed_at = datetime.utcnow()
            match.winner_id = match.match_players[0].player_id
            await db.flush()
            await db.refresh(match)
            await _advance_winner_in_bracket(match, db)
        elif player_count == 0:
            match.status = MatchStatus.COMPLETED
            match.completed_at = datetime.utcnow()
            await db.flush()


async def _generate_double_elimination_bracket(
    tournament: Tournament,
    entries: List[TournamentEntry],
    db: AsyncSession
):
    """Generate double elimination bracket matches."""
    # For now, generate as single elimination
    # Full implementation would include winners and losers brackets
    await _generate_single_elimination_bracket(tournament, entries, db)


async def _generate_round_robin_bracket(
    tournament: Tournament,
    entries: List[TournamentEntry],
    db: AsyncSession
):
    """Generate round robin matches where everyone plays everyone."""
    num_players = len(entries)
    match_number = 1

    # Generate all pairings
    for i in range(num_players):
        for j in range(i + 1, num_players):
            match = Match(
                tournament_id=tournament.id,
                round_number=1,  # All matches in round 1 for round robin
                match_number=match_number,
                bracket_position=f"RR{match_number}",
                status=MatchStatus.PENDING
            )
            db.add(match)
            await db.flush()

            # Add both players
            mp1 = MatchPlayer(
                match_id=match.id,
                player_id=entries[i].player_id,
                position=1,
                sets_won=0,
                legs_won=0
            )
            mp2 = MatchPlayer(
                match_id=match.id,
                player_id=entries[j].player_id,
                position=2,
                sets_won=0,
                legs_won=0
            )
            db.add(mp1)
            db.add(mp2)

            match_number += 1


async def _generate_lucky_draw_doubles_bracket(
    tournament: Tournament,
    db: AsyncSession
):
    """Generate single elimination bracket for Lucky Draw Doubles.

    Uses teams (not individual entries) as bracket units. Each match has
    4 MatchPlayers (2 per team). Uses the same flexible round structure
    as singles bracket generation.
    """
    from sqlalchemy.orm import selectinload as _sel

    # Load teams for this tournament
    result = await db.execute(
        select(Team)
        .options(_sel(Team.player1), _sel(Team.player2))
        .where(Team.tournament_id == tournament.id)
        .order_by(Team.created_at)
    )
    teams = list(result.scalars().all())

    if len(teams) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Need at least 2 teams to generate bracket. Generate teams first."
        )

    num_teams = len(teams)

    # Calculate round structure (same as singles)
    round_sizes = []
    remaining = num_teams
    while remaining > 1:
        match_slots = (remaining + 1) // 2
        round_sizes.append(match_slots)
        remaining = match_slots

    num_rounds = len(round_sizes)

    # Create all matches for all rounds
    matches_by_round = {}
    match_number = 1

    for round_num in range(1, num_rounds + 1):
        matches_in_round = round_sizes[round_num - 1]
        matches_by_round[round_num] = []

        for match_idx in range(matches_in_round):
            match = Match(
                tournament_id=tournament.id,
                round_number=round_num,
                match_number=match_number,
                bracket_position=f"R{round_num}M{match_idx + 1}",
                status=MatchStatus.PENDING
            )
            db.add(match)
            matches_by_round[round_num].append(match)
            match_number += 1

    await db.flush()

    # Seed R1: pair teams sequentially, last team gets bye if odd count
    first_round_matches = matches_by_round[1]
    team_idx = 0

    for match_idx, match in enumerate(first_round_matches):
        # Team A (position 1)
        if team_idx < num_teams:
            team_a = teams[team_idx]
            mp1 = MatchPlayer(
                match_id=match.id,
                player_id=team_a.player1_id,
                position=1,
                team_id=team_a.id,
                team_position=1,
                sets_won=0,
                legs_won=0
            )
            mp2 = MatchPlayer(
                match_id=match.id,
                player_id=team_a.player2_id,
                position=1,
                team_id=team_a.id,
                team_position=2,
                sets_won=0,
                legs_won=0
            )
            db.add(mp1)
            db.add(mp2)
            team_idx += 1

        # Team B (position 2) - may be empty if this is the bye match
        if team_idx < num_teams:
            team_b = teams[team_idx]
            mp3 = MatchPlayer(
                match_id=match.id,
                player_id=team_b.player1_id,
                position=2,
                team_id=team_b.id,
                team_position=1,
                sets_won=0,
                legs_won=0
            )
            mp4 = MatchPlayer(
                match_id=match.id,
                player_id=team_b.player2_id,
                position=2,
                team_id=team_b.id,
                team_position=2,
                sets_won=0,
                legs_won=0
            )
            db.add(mp3)
            db.add(mp4)
            team_idx += 1

    await db.flush()

    # Auto-complete bye matches (1 team = 2 players) and cascade
    from backend.api.matches import _advance_team_in_bracket
    for match in first_round_matches:
        await db.refresh(match, attribute_names=["match_players"])
        team_ids = set(mp.team_id for mp in match.match_players if mp.team_id)
        if len(team_ids) == 1:
            # Single team bye - auto-complete
            winning_team_id = list(team_ids)[0]
            match.status = MatchStatus.COMPLETED
            match.completed_at = datetime.utcnow()
            match.winner_team_id = winning_team_id
            # Set winner_id to player1 of winning team for backward compat
            match.winner_id = match.match_players[0].player_id
            await db.flush()
            await db.refresh(match)
            await _advance_team_in_bracket(match, db)
        elif len(team_ids) == 0:
            # Empty match (shouldn't happen with teams but handle anyway)
            match.status = MatchStatus.COMPLETED
            match.completed_at = datetime.utcnow()
            await db.flush()


# Team endpoints for Lucky Draw tournaments
@router.get("/{tournament_id}/teams", response_model=List[TeamWithPlayers])
async def list_tournament_teams(
    tournament_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """List all teams for a tournament."""
    # Check tournament exists
    result = await db.execute(
        select(Tournament).where(Tournament.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # Get teams with player info
    result = await db.execute(
        select(Team)
        .options(selectinload(Team.player1), selectinload(Team.player2))
        .where(Team.tournament_id == tournament_id)
        .order_by(Team.name)
    )
    teams = result.scalars().all()

    # Convert to response with player names
    team_responses = []
    for team in teams:
        team_responses.append(TeamWithPlayers(
            id=team.id,
            name=team.name,
            tournament_id=team.tournament_id,
            player1_id=team.player1_id,
            player2_id=team.player2_id,
            created_at=team.created_at,
            updated_at=team.updated_at,
            player1_name=team.player1.name if team.player1 else None,
            player2_name=team.player2.name if team.player2 else None
        ))

    return team_responses


@router.post("/{tournament_id}/lucky-draw", response_model=List[TeamWithPlayers])
async def generate_lucky_draw_teams(
    tournament_id: UUID,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Generate random teams from checked-in players for Lucky Draw tournament."""
    import random

    # Get tournament with entries
    result = await db.execute(
        select(Tournament)
        .options(selectinload(Tournament.entries))
        .where(Tournament.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()

    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    if tournament.status == TournamentStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot regenerate teams while tournament is in progress"
        )

    # Get checked-in entries with player info
    checked_in_entries = [e for e in tournament.entries if e.checked_in]

    if len(checked_in_entries) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Need at least 2 checked-in players to generate teams"
        )

    if len(checked_in_entries) % 2 != 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Need an even number of checked-in players for team pairing"
        )

    # Delete existing teams for this tournament
    result = await db.execute(
        select(Team).where(Team.tournament_id == tournament_id)
    )
    existing_teams = result.scalars().all()
    for team in existing_teams:
        db.delete(team)
    await db.flush()

    # Shuffle players randomly
    player_ids = [e.player_id for e in checked_in_entries]
    random.shuffle(player_ids)

    # Get player info for names
    result = await db.execute(
        select(Player).where(Player.id.in_(player_ids))
    )
    players_by_id = {p.id: p for p in result.scalars().all()}

    # Create teams
    teams = []
    team_num = 1
    for i in range(0, len(player_ids), 2):
        p1_id = player_ids[i]
        p2_id = player_ids[i + 1]
        p1 = players_by_id.get(p1_id)
        p2 = players_by_id.get(p2_id)

        # Generate team name from player names
        if p1 and p2:
            team_name = f"{p1.name.split()[0]} & {p2.name.split()[0]}"
        else:
            team_name = f"Team {team_num}"

        team = Team(
            tournament_id=tournament_id,
            player1_id=p1_id,
            player2_id=p2_id,
            name=team_name
        )
        db.add(team)
        teams.append((team, p1, p2))
        team_num += 1

    await db.flush()

    # Build response
    team_responses = []
    for team, p1, p2 in teams:
        await db.refresh(team)
        team_responses.append(TeamWithPlayers(
            id=team.id,
            name=team.name,
            tournament_id=team.tournament_id,
            player1_id=team.player1_id,
            player2_id=team.player2_id,
            created_at=team.created_at,
            updated_at=team.updated_at,
            player1_name=p1.name if p1 else None,
            player2_name=p2.name if p2 else None
        ))

    return team_responses
