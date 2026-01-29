import re

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
from datetime import datetime

from backend.core import get_db
from backend.models import Match, MatchPlayer, Player, Game, Tournament, MatchStatus, GameStatus, Dartboard, Admin, Team
from backend.schemas import (
    MatchResponse,
    MatchWithPlayers,
    MatchPlayerInfo,
    MatchUpdate,
    GameCreate,
    GameResponse,
)
from backend.services import WAMOGameEngine
from backend.api.auth import get_current_admin_or_player

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
                legs_won=mp.legs_won,
                arrived_at_board=mp.arrived_at_board,
                reported_win=mp.reported_win,
                team_id=mp.team_id,
                team_position=mp.team_position,
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
            "winner_team_id": match.winner_team_id,
            "dartboard_id": match.dartboard_id,
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
            legs_won=mp.legs_won,
            team_id=mp.team_id,
            team_position=mp.team_position,
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
        "winner_team_id": match.winner_team_id,
        "dartboard_id": match.dartboard_id,
        "created_at": match.created_at,
        "updated_at": match.updated_at,
        "players": players
    }


@router.post("/{match_id}/start", response_model=MatchResponse)
async def start_match(
    match_id: UUID,
    current_player: Player = Depends(get_current_admin_or_player),
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
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Update match details. If setting a winner, also advances them in the bracket."""
    result = await db.execute(
        select(Match)
        .options(selectinload(Match.match_players))
        .where(Match.id == match_id)
    )
    match = result.scalar_one_or_none()

    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    update_data = match_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(match, field, value)

    if match.status == MatchStatus.COMPLETED and not match.completed_at:
        match.completed_at = datetime.utcnow()

    # Auto-release dartboard when match is completed
    if match.status == MatchStatus.COMPLETED and match.dartboard_id:
        result = await db.execute(
            select(Dartboard).where(Dartboard.id == match.dartboard_id)
        )
        dartboard = result.scalar_one_or_none()
        if dartboard:
            dartboard.is_available = True

    # If match is completed with a winner, advance them to next round match
    if match.status == MatchStatus.COMPLETED:
        if match.winner_team_id:
            await _advance_team_in_bracket(match, db)
        elif match.winner_id:
            await _advance_winner_in_bracket(match, db)

    await db.flush()
    await db.refresh(match)

    return match


async def _advance_winner_in_bracket(match: Match, db: AsyncSession):
    """
    Advance the winner of a match to the next round in a single elimination bracket.
    After advancing, checks if the destination match is a bye (both feeders done,
    only 1 player) and auto-completes it recursively.

    bracket_position is formatted as "R{round}M{index}" where index is 1-based
    within the round (e.g., R1M1, R1M2, ..., R2M1, R2M2, ...).
    match_number is a global sequential counter across all rounds, so we must
    use bracket_position to determine the within-round index.
    """
    next_round = match.round_number + 1

    # Parse the within-round match index from bracket_position
    bp_match = re.match(r'R(\d+)M(\d+)', match.bracket_position or '')
    if not bp_match:
        return
    current_match_in_round = int(bp_match.group(2))

    # In single elimination: matches 1&2 -> next round match 1, 3&4 -> match 2, etc.
    next_match_in_round = (current_match_in_round + 1) // 2
    next_bracket_position = f"R{next_round}M{next_match_in_round}"

    # Find the next match by bracket_position
    result = await db.execute(
        select(Match)
        .options(selectinload(Match.match_players))
        .where(
            Match.tournament_id == match.tournament_id,
            Match.bracket_position == next_bracket_position
        )
    )
    next_match = result.scalar_one_or_none()

    if not next_match:
        # No next match - this was the final
        return

    # Check if winner is already in the next match
    existing_player_ids = [mp.player_id for mp in next_match.match_players]
    if match.winner_id in existing_player_ids:
        return

    # Determine position (1 or 2) based on which match in current round
    # Odd match indices go to position 1, even to position 2
    position = 1 if current_match_in_round % 2 == 1 else 2

    # Add winner to next match
    match_player = MatchPlayer(
        match_id=next_match.id,
        player_id=match.winner_id,
        position=position,
        sets_won=0,
        legs_won=0
    )
    db.add(match_player)
    await db.flush()

    # Check if the next match should auto-complete as a bye
    await _check_bye_cascade(next_match, db)


async def _check_bye_cascade(match: Match, db: AsyncSession):
    """
    Check if a match should auto-complete as a bye. A match is a bye when
    both feeder matches are completed but only 0 or 1 player is present.
    If auto-completed, recursively advances the winner and checks the next match.
    """
    bp_match = re.match(r'R(\d+)M(\d+)', match.bracket_position or '')
    if not bp_match:
        return
    round_num = int(bp_match.group(1))
    match_in_round = int(bp_match.group(2))

    if round_num <= 1:
        return  # R1 byes are handled during bracket generation

    # Find the feeder matches from the previous round.
    # In a power-of-2 bracket there are always 2 feeders. In a flexible bracket
    # (non-power-of-2 entries), the previous round may have an odd number of
    # matches, so the last match in this round has only 1 feeder.
    prev_round = round_num - 1
    feeder1_pos = f"R{prev_round}M{2 * match_in_round - 1}"
    feeder2_pos = f"R{prev_round}M{2 * match_in_round}"

    result = await db.execute(
        select(Match).where(
            Match.tournament_id == match.tournament_id,
            Match.bracket_position.in_([feeder1_pos, feeder2_pos])
        )
    )
    feeders = result.scalars().all()

    # At least 1 feeder must exist, and ALL existing feeders must be completed
    if len(feeders) == 0 or not all(f.status == MatchStatus.COMPLETED for f in feeders):
        return

    # Refresh match to get current players
    await db.refresh(match, attribute_names=["match_players"])
    player_count = len(match.match_players)

    if player_count == 1 and match.status == MatchStatus.PENDING:
        # Single-player bye: auto-complete
        match.status = MatchStatus.COMPLETED
        match.completed_at = datetime.utcnow()
        match.winner_id = match.match_players[0].player_id
        await db.flush()
        await db.refresh(match)
        await _advance_winner_in_bracket(match, db)
    elif player_count == 0 and match.status == MatchStatus.PENDING:
        # Empty match (double bye): mark completed, no winner
        match.status = MatchStatus.COMPLETED
        match.completed_at = datetime.utcnow()
        await db.flush()
        # No winner to advance, but check if the NEXT match also needs cascade
        # by pretending this completed (the next match's other feeder might also be done)
        await _check_next_match_cascade(match, db)


async def _check_next_match_cascade(match: Match, db: AsyncSession):
    """After an empty match completes, check if the next round match needs cascade."""
    bp_match = re.match(r'R(\d+)M(\d+)', match.bracket_position or '')
    if not bp_match:
        return
    current_in_round = int(bp_match.group(2))
    next_round = match.round_number + 1
    next_match_in_round = (current_in_round + 1) // 2
    next_bracket_position = f"R{next_round}M{next_match_in_round}"

    result = await db.execute(
        select(Match)
        .options(selectinload(Match.match_players))
        .where(
            Match.tournament_id == match.tournament_id,
            Match.bracket_position == next_bracket_position
        )
    )
    next_match = result.scalar_one_or_none()
    if next_match:
        await _check_bye_cascade(next_match, db)


async def _advance_team_in_bracket(match: Match, db: AsyncSession):
    """
    Advance the winning team of a doubles match to the next round.
    Creates 2 MatchPlayers in the next match (both team members).
    """
    if not match.winner_team_id:
        return

    next_round = match.round_number + 1
    bp_match = re.match(r'R(\d+)M(\d+)', match.bracket_position or '')
    if not bp_match:
        return
    current_match_in_round = int(bp_match.group(2))
    next_match_in_round = (current_match_in_round + 1) // 2
    next_bracket_position = f"R{next_round}M{next_match_in_round}"

    result = await db.execute(
        select(Match)
        .options(selectinload(Match.match_players))
        .where(
            Match.tournament_id == match.tournament_id,
            Match.bracket_position == next_bracket_position
        )
    )
    next_match = result.scalar_one_or_none()

    if not next_match:
        return  # Final match, no next round

    # Check if this team is already in the next match
    existing_team_ids = set(mp.team_id for mp in next_match.match_players if mp.team_id)
    if match.winner_team_id in existing_team_ids:
        return

    # Load winning team to get both players
    team_result = await db.execute(
        select(Team).where(Team.id == match.winner_team_id)
    )
    winning_team = team_result.scalar_one_or_none()
    if not winning_team:
        return

    # Odd match indices -> position 1, even -> position 2
    position = 1 if current_match_in_round % 2 == 1 else 2

    # Add both team members to next match
    mp1 = MatchPlayer(
        match_id=next_match.id,
        player_id=winning_team.player1_id,
        position=position,
        team_id=winning_team.id,
        team_position=1,
        sets_won=0,
        legs_won=0
    )
    mp2 = MatchPlayer(
        match_id=next_match.id,
        player_id=winning_team.player2_id,
        position=position,
        team_id=winning_team.id,
        team_position=2,
        sets_won=0,
        legs_won=0
    )
    db.add(mp1)
    db.add(mp2)
    await db.flush()

    await _check_team_bye_cascade(next_match, db)


async def _check_team_bye_cascade(match: Match, db: AsyncSession):
    """
    Check if a doubles match should auto-complete as a bye.
    Counts distinct team_ids instead of individual players.
    """
    bp_match = re.match(r'R(\d+)M(\d+)', match.bracket_position or '')
    if not bp_match:
        return
    round_num = int(bp_match.group(1))
    match_in_round = int(bp_match.group(2))

    if round_num <= 1:
        return  # R1 byes handled during bracket generation

    # Find feeder matches
    prev_round = round_num - 1
    feeder1_pos = f"R{prev_round}M{2 * match_in_round - 1}"
    feeder2_pos = f"R{prev_round}M{2 * match_in_round}"

    result = await db.execute(
        select(Match).where(
            Match.tournament_id == match.tournament_id,
            Match.bracket_position.in_([feeder1_pos, feeder2_pos])
        )
    )
    feeders = result.scalars().all()

    if len(feeders) == 0 or not all(f.status == MatchStatus.COMPLETED for f in feeders):
        return

    # Refresh to get current players
    await db.refresh(match, attribute_names=["match_players"])
    team_ids = set(mp.team_id for mp in match.match_players if mp.team_id)

    if len(team_ids) == 1 and match.status == MatchStatus.PENDING:
        # Single team bye: auto-complete
        winning_team_id = list(team_ids)[0]
        match.status = MatchStatus.COMPLETED
        match.completed_at = datetime.utcnow()
        match.winner_team_id = winning_team_id
        # Set winner_id for backward compat
        match.winner_id = match.match_players[0].player_id
        await db.flush()
        await db.refresh(match)
        await _advance_team_in_bracket(match, db)
    elif len(team_ids) == 0 and match.status == MatchStatus.PENDING:
        # Empty match (double bye)
        match.status = MatchStatus.COMPLETED
        match.completed_at = datetime.utcnow()
        await db.flush()
        await _check_team_next_match_cascade(match, db)


async def _check_team_next_match_cascade(match: Match, db: AsyncSession):
    """After an empty doubles match completes, cascade to next round."""
    bp_match = re.match(r'R(\d+)M(\d+)', match.bracket_position or '')
    if not bp_match:
        return
    current_in_round = int(bp_match.group(2))
    next_round = match.round_number + 1
    next_match_in_round = (current_in_round + 1) // 2
    next_bracket_position = f"R{next_round}M{next_match_in_round}"

    result = await db.execute(
        select(Match)
        .options(selectinload(Match.match_players))
        .where(
            Match.tournament_id == match.tournament_id,
            Match.bracket_position == next_bracket_position
        )
    )
    next_match = result.scalar_one_or_none()
    if next_match:
        await _check_team_bye_cascade(next_match, db)


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
    current_player: Player = Depends(get_current_admin_or_player),
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


@router.post("/{match_id}/arrive", response_model=MatchResponse)
async def player_arrive_at_board(
    match_id: UUID,
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Player indicates they have arrived at their assigned dartboard."""
    if isinstance(current_player, Admin):
        raise HTTPException(status_code=400, detail="Only players can mark board arrival")

    result = await db.execute(
        select(Match)
        .options(selectinload(Match.match_players))
        .where(Match.id == match_id)
    )
    match = result.scalar_one_or_none()

    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.status not in (MatchStatus.PENDING, MatchStatus.WAITING_FOR_PLAYERS):
        raise HTTPException(status_code=400, detail="Match is not waiting for players")

    # Find this player in the match
    match_player = None
    for mp in match.match_players:
        if mp.player_id == current_player.id:
            match_player = mp
            break

    if not match_player:
        raise HTTPException(status_code=403, detail="You are not in this match")

    if match_player.arrived_at_board:
        raise HTTPException(status_code=400, detail="Already marked as arrived")

    match_player.arrived_at_board = datetime.utcnow()

    # If board is assigned but match is still pending, move to waiting_for_players
    if match.status == MatchStatus.PENDING and match.dartboard_id:
        match.status = MatchStatus.WAITING_FOR_PLAYERS

    # Check if all players have arrived
    # For doubles (4 players) all 4 must arrive; for singles, 2
    all_arrived = all(mp.arrived_at_board for mp in match.match_players if mp.player_id)
    is_doubles = any(mp.team_id for mp in match.match_players)
    min_players = 4 if is_doubles else 2
    if all_arrived and len(match.match_players) >= min_players:
        # Auto-start the match
        match.status = MatchStatus.IN_PROGRESS
        match.started_at = datetime.utcnow()

        # Create first game
        tournament_result = await db.execute(
            select(Tournament).where(Tournament.id == match.tournament_id)
        )
        tournament = tournament_result.scalar_one_or_none()
        if tournament:
            from backend.services import WAMOGameEngine
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


@router.post("/{match_id}/report-result", response_model=MatchResponse)
async def report_match_result(
    match_id: UUID,
    i_won: bool = Query(..., description="True if reporting player claims they won"),
    current_player: Player = Depends(get_current_admin_or_player),
    db: AsyncSession = Depends(get_db)
):
    """Player reports match result. When both sides agree, match auto-completes.
    For doubles: one player per team reports for their team."""
    if isinstance(current_player, Admin):
        raise HTTPException(status_code=400, detail="Only players can report results. Admins use PATCH /matches/{id}")

    result = await db.execute(
        select(Match)
        .options(selectinload(Match.match_players))
        .where(Match.id == match_id)
    )
    match = result.scalar_one_or_none()

    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.status == MatchStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Match already completed")

    # Find this player in the match
    reporting_player = None
    for mp in match.match_players:
        if mp.player_id == current_player.id:
            reporting_player = mp
            break

    if not reporting_player:
        raise HTTPException(status_code=403, detail="You are not in this match")

    # Detect doubles match
    is_doubles = reporting_player.team_id is not None

    if is_doubles:
        # --- DOUBLES REPORTING ---
        # Check if anyone on this team already reported
        my_team_id = reporting_player.team_id
        teammates = [mp for mp in match.match_players if mp.team_id == my_team_id]
        if any(mp.reported_win is not None for mp in teammates):
            raise HTTPException(status_code=400, detail="Your team already reported a result")

        # Set reported_win on the reporting player
        reporting_player.reported_win = i_won

        # Find other team's report
        other_team_players = [mp for mp in match.match_players if mp.team_id and mp.team_id != my_team_id]
        other_team_reporter = None
        for mp in other_team_players:
            if mp.reported_win is not None:
                other_team_reporter = mp
                break

        if other_team_reporter is not None:
            other_team_id = other_team_reporter.team_id
            # Both teams have reported
            if i_won and not other_team_reporter.reported_win:
                # Reporter's team wins
                match.status = MatchStatus.COMPLETED
                match.completed_at = datetime.utcnow()
                match.winner_team_id = my_team_id
                # backward compat: set winner_id to first player of winning team
                winning_team_result = await db.execute(select(Team).where(Team.id == my_team_id))
                winning_team = winning_team_result.scalar_one_or_none()
                if winning_team:
                    match.winner_id = winning_team.player1_id

                # Release dartboard
                if match.dartboard_id:
                    board_result = await db.execute(select(Dartboard).where(Dartboard.id == match.dartboard_id))
                    board = board_result.scalar_one_or_none()
                    if board:
                        board.is_available = True

                await _advance_team_in_bracket(match, db)

            elif not i_won and other_team_reporter.reported_win:
                # Other team wins
                match.status = MatchStatus.COMPLETED
                match.completed_at = datetime.utcnow()
                match.winner_team_id = other_team_id
                winning_team_result = await db.execute(select(Team).where(Team.id == other_team_id))
                winning_team = winning_team_result.scalar_one_or_none()
                if winning_team:
                    match.winner_id = winning_team.player1_id

                # Release dartboard
                if match.dartboard_id:
                    board_result = await db.execute(select(Dartboard).where(Dartboard.id == match.dartboard_id))
                    board = board_result.scalar_one_or_none()
                    if board:
                        board.is_available = True

                await _advance_team_in_bracket(match, db)

            else:
                # Both claim win or both claim loss -> dispute
                match.status = MatchStatus.DISPUTED
                reporting_player.reported_win = None
                other_team_reporter.reported_win = None
    else:
        # --- SINGLES REPORTING (unchanged) ---
        if reporting_player.reported_win is not None:
            raise HTTPException(status_code=400, detail="You already reported a result")

        reporting_player.reported_win = i_won

        # Check if both players have reported
        other_player = None
        for mp in match.match_players:
            if mp.player_id != current_player.id and mp.player_id:
                other_player = mp
                break

        if other_player and other_player.reported_win is not None:
            # Both have reported - check agreement
            if i_won and not other_player.reported_win:
                # Reporter says won, other says lost -> reporter wins
                match.status = MatchStatus.COMPLETED
                match.completed_at = datetime.utcnow()
                match.winner_id = current_player.id

                # Release dartboard
                if match.dartboard_id:
                    board_result = await db.execute(
                        select(Dartboard).where(Dartboard.id == match.dartboard_id)
                    )
                    board = board_result.scalar_one_or_none()
                    if board:
                        board.is_available = True

                # Advance winner
                await _advance_winner_in_bracket(match, db)

            elif not i_won and other_player.reported_win:
                # Reporter says lost, other says won -> other wins
                match.status = MatchStatus.COMPLETED
                match.completed_at = datetime.utcnow()
                match.winner_id = other_player.player_id

                # Release dartboard
                if match.dartboard_id:
                    board_result = await db.execute(
                        select(Dartboard).where(Dartboard.id == match.dartboard_id)
                    )
                    board = board_result.scalar_one_or_none()
                    if board:
                        board.is_available = True

                # Advance winner
                await _advance_winner_in_bracket(match, db)

            else:
                # Both claim win or both claim loss -> dispute
                match.status = MatchStatus.DISPUTED
                # Reset reports so admin can resolve and players can re-report
                reporting_player.reported_win = None
                other_player.reported_win = None

    await db.flush()
    await db.refresh(match)

    return match
