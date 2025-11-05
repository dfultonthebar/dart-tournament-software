from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
from datetime import datetime

from backend.core import get_db
from backend.models import Match, MatchPlayer, Player, Game, Tournament, MatchStatus, GameStatus
from backend.schemas import (
    MatchResponse,
    MatchWithPlayers,
    MatchPlayerInfo,
    MatchUpdate,
    GameCreate,
    GameResponse,
)
from backend.services import WAMOGameEngine
from backend.api.auth import get_current_player

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("", response_model=List[MatchWithPlayers])
async def list_matches(
    tournament_id: UUID = None,
    status_filter: MatchStatus = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    """List matches with optional filters."""
    query = select(Match).options(selectinload(Match.match_players)).offset(skip).limit(limit)

    if tournament_id:
        query = query.where(Match.tournament_id == tournament_id)

    if status_filter:
        query = query.where(Match.status == status_filter)

    query = query.order_by(Match.round_number, Match.match_number)

    result = await db.execute(query)
    matches = result.scalars().unique().all()

    # Convert to response with player info
    response = []
    for match in matches:
        players = [
            MatchPlayerInfo(
                player_id=mp.player_id,
                position=mp.position,
                sets_won=mp.sets_won,
                legs_won=mp.legs_won
            )
            for mp in match.match_players
        ]

        match_dict = {
            "id": match.id,
            "tournament_id": match.tournament_id,
            "round_number": match.round_number,
            "match_number": match.match_number,
            "bracket_position": match.bracket_position,
            "status": match.status,
            "started_at": match.started_at,
            "completed_at": match.completed_at,
            "winner_id": match.winner_id,
            "created_at": match.created_at,
            "updated_at": match.updated_at,
            "players": players
        }
        response.append(match_dict)

    return response


@router.get("/{match_id}", response_model=MatchWithPlayers)
async def get_match(
    match_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific match with player information."""
    result = await db.execute(
        select(Match)
        .options(selectinload(Match.match_players))
        .where(Match.id == match_id)
    )
    match = result.scalar_one_or_none()

    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    players = [
        MatchPlayerInfo(
            player_id=mp.player_id,
            position=mp.position,
            sets_won=mp.sets_won,
            legs_won=mp.legs_won
        )
        for mp in match.match_players
    ]

    return {
        "id": match.id,
        "tournament_id": match.tournament_id,
        "round_number": match.round_number,
        "match_number": match.match_number,
        "bracket_position": match.bracket_position,
        "status": match.status,
        "started_at": match.started_at,
        "completed_at": match.completed_at,
        "winner_id": match.winner_id,
        "created_at": match.created_at,
        "updated_at": match.updated_at,
        "players": players
    }


@router.post("/{match_id}/start", response_model=MatchResponse)
async def start_match(
    match_id: UUID,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Start a match and create initial game."""
    result = await db.execute(
        select(Match)
        .options(selectinload(Match.tournament))
        .where(Match.id == match_id)
    )
    match = result.scalar_one_or_none()

    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.status != MatchStatus.PENDING:
        raise HTTPException(status_code=400, detail="Match already started or completed")

    # Update match status
    match.status = MatchStatus.IN_PROGRESS
    match.started_at = datetime.utcnow()

    # Create first game
    tournament = match.tournament
    game_data = WAMOGameEngine.create_game(
        tournament.game_type,
        starting_score=tournament.starting_score,
        double_in=tournament.double_in,
        double_out=tournament.double_out
    )

    game = Game(
        match_id=match_id,
        set_number=1,
        leg_number=1,
        status=GameStatus.IN_PROGRESS,
        game_data=game_data
    )
    db.add(game)

    await db.flush()
    await db.refresh(match)

    return match


@router.patch("/{match_id}", response_model=MatchResponse)
async def update_match(
    match_id: UUID,
    match_update: MatchUpdate,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Update match details."""
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()

    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    update_data = match_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(match, field, value)

    if match.status == MatchStatus.COMPLETED and not match.completed_at:
        match.completed_at = datetime.utcnow()

    await db.flush()
    await db.refresh(match)

    return match


@router.get("/{match_id}/games", response_model=List[GameResponse])
async def list_match_games(
    match_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """List all games in a match."""
    result = await db.execute(
        select(Game)
        .where(Game.match_id == match_id)
        .order_by(Game.set_number, Game.leg_number)
    )
    games = result.scalars().all()
    return games


@router.post("/{match_id}/games", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
async def create_game(
    match_id: UUID,
    game_create: GameCreate,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Create a new game in a match."""
    result = await db.execute(
        select(Match)
        .options(selectinload(Match.tournament))
        .where(Match.id == match_id)
    )
    match = result.scalar_one_or_none()

    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.status != MatchStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Match not in progress")

    tournament = match.tournament
    game_data = WAMOGameEngine.create_game(
        tournament.game_type,
        starting_score=tournament.starting_score,
        double_in=tournament.double_in,
        double_out=tournament.double_out
    )

    game = Game(
        match_id=match_id,
        set_number=game_create.set_number,
        leg_number=game_create.leg_number,
        status=GameStatus.IN_PROGRESS,
        game_data=game_data
    )

    db.add(game)
    await db.flush()
    await db.refresh(game)

    return game
