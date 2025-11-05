from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from backend.core import get_db, get_redis, CacheService
from backend.models import (
    Game,
    Throw,
    Player,
    Match,
    MatchPlayer,
    Tournament,
    GameStatus,
    MatchStatus,
)
from backend.schemas import (
    ScoreSubmission,
    ThrowResponse,
    GameResponse,
)
from backend.services import ScoringService
from backend.api.auth import get_current_player

router = APIRouter(prefix="/scoring", tags=["scoring"])


@router.post("/submit", response_model=ThrowResponse, status_code=status.HTTP_201_CREATED)
async def submit_score(
    submission: ScoreSubmission,
    current_player: Player = Depends(get_current_player),
    db: AsyncSession = Depends(get_db)
):
    """Submit a throw score."""
    # Get game with related data
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.match).selectinload(Match.tournament))
        .where(Game.id == submission.game_id)
    )
    game = result.scalar_one_or_none()

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game.status != GameStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Game is not in progress")

    # Verify player is in the match
    result = await db.execute(
        select(MatchPlayer)
        .where(
            MatchPlayer.match_id == game.match_id,
            MatchPlayer.player_id == submission.player_id
        )
    )
    match_player = result.scalar_one_or_none()

    if not match_player:
        raise HTTPException(status_code=400, detail="Player not in this match")

    # Get current turn number
    result = await db.execute(
        select(Throw)
        .where(Throw.game_id == submission.game_id)
        .order_by(Throw.turn_number.desc())
    )
    last_throw = result.first()
    turn_number = (last_throw[0].turn_number + 1) if last_throw else 1

    # Validate and process throw
    tournament = game.match.tournament
    is_valid, message, updated_game_data, is_winner = ScoringService.validate_throw(
        tournament.game_type,
        game.game_data,
        str(submission.player_id),
        submission.throw.scores,
        submission.throw.multipliers
    )

    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # Calculate throw total
    total = ScoringService.calculate_throw_total(
        submission.throw.scores,
        submission.throw.multipliers
    )

    # Determine remaining score (for x01 games)
    remaining = None
    is_bust = "Bust" in message

    if str(submission.player_id) in updated_game_data.get("players", {}):
        player_data = updated_game_data["players"][str(submission.player_id)]
        remaining = player_data.get("score")

    # Create throw record
    new_throw = Throw(
        game_id=submission.game_id,
        player_id=submission.player_id,
        turn_number=turn_number,
        scores=submission.throw.scores,
        multipliers=submission.throw.multipliers,
        total=total,
        remaining=remaining,
        is_bust=is_bust
    )

    db.add(new_throw)

    # Update game data
    game.game_data = updated_game_data

    # If winner, update game and match
    if is_winner:
        game.status = GameStatus.COMPLETED
        game.winner_id = submission.player_id

        # Update match player stats
        match_player.legs_won += 1

        # Check if match is won
        if match_player.legs_won >= tournament.legs_to_win:
            match_player.sets_won += 1

            if match_player.sets_won >= tournament.sets_to_win:
                # Match won!
                match = game.match
                match.status = MatchStatus.COMPLETED
                match.winner_id = submission.player_id

    await db.flush()
    await db.refresh(new_throw)

    # Invalidate cache for this game/match
    redis = await get_redis()
    cache = CacheService(redis)
    await cache.delete(f"game:{submission.game_id}")
    await cache.delete(f"match:{game.match_id}")

    return new_throw


@router.get("/game/{game_id}/throws", response_model=List[ThrowResponse])
async def get_game_throws(
    game_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get all throws for a game."""
    result = await db.execute(
        select(Throw)
        .where(Throw.game_id == game_id)
        .order_by(Throw.turn_number)
    )
    throws = result.scalars().all()
    return throws


@router.get("/game/{game_id}", response_model=GameResponse)
async def get_game_state(
    game_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get current game state."""
    # Try cache first
    redis = await get_redis()
    cache = CacheService(redis)
    cached = await cache.get(f"game:{game_id}")

    if cached:
        return cached

    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Cache for 10 seconds
    game_dict = {
        "id": str(game.id),
        "match_id": str(game.match_id),
        "set_number": game.set_number,
        "leg_number": game.leg_number,
        "status": game.status.value,
        "current_player_id": str(game.current_player_id) if game.current_player_id else None,
        "winner_id": str(game.winner_id) if game.winner_id else None,
        "game_data": game.game_data,
        "created_at": game.created_at.isoformat(),
        "updated_at": game.updated_at.isoformat(),
    }

    await cache.set(f"game:{game_id}", game_dict, ttl=10)

    return game


@router.get("/player/{player_id}/stats")
async def get_player_stats(
    player_id: UUID,
    game_id: UUID = None,
    db: AsyncSession = Depends(get_db)
):
    """Get player statistics for a game or overall."""
    query = select(Throw).where(Throw.player_id == player_id)

    if game_id:
        query = query.where(Throw.game_id == game_id)

    result = await db.execute(query.order_by(Throw.created_at))
    throws = result.scalars().all()

    # Convert to dict format for stats calculation
    throws_data = [
        {
            "scores": t.scores,
            "multipliers": t.multipliers,
            "total": t.total,
            "is_bust": t.is_bust,
        }
        for t in throws
    ]

    # Get tournament game type if game_id provided
    game_type = None
    if game_id:
        result = await db.execute(
            select(Game)
            .options(selectinload(Game.match).selectinload(Match.tournament))
            .where(Game.id == game_id)
        )
        game = result.scalar_one_or_none()
        if game:
            game_type = game.match.tournament.game_type

    stats = ScoringService.calculate_player_stats(throws_data, game_type)

    return stats
