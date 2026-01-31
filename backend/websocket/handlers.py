"""
WebSocket event handlers for real-time updates.
"""

from typing import Dict, Any
from uuid import UUID
from backend.websocket.connection import manager
import logging

logger = logging.getLogger(__name__)


class WebSocketEvents:
    """Event types for WebSocket messages."""

    # Match events
    MATCH_STARTED = "match:started"
    MATCH_UPDATED = "match:updated"
    MATCH_COMPLETED = "match:completed"

    # Game events
    GAME_STARTED = "game:started"
    GAME_UPDATED = "game:updated"
    GAME_COMPLETED = "game:completed"

    # Score events
    SCORE_SUBMITTED = "score:submitted"
    SCORE_VALIDATED = "score:validated"

    # Tournament events
    TOURNAMENT_STARTED = "tournament:started"
    TOURNAMENT_UPDATED = "tournament:updated"
    TOURNAMENT_COMPLETED = "tournament:completed"

    # Board events
    BOARD_ASSIGNED = "board:assigned"

    # Player events
    PLAYER_JOINED = "player:joined"
    PLAYER_LEFT = "player:left"

    # System events
    CONNECTION_ACK = "connection:ack"
    SUBSCRIPTION_ACK = "subscription:ack"
    ERROR = "error"


class WebSocketHandler:
    """Handles WebSocket events and broadcasts."""

    @staticmethod
    async def handle_match_event(event_type: str, match_data: Dict[str, Any]):
        """Handle match-related events."""
        message = {
            "type": event_type,
            "data": match_data,
            "timestamp": match_data.get("updated_at")
        }

        # Broadcast to tournament topic
        tournament_id = match_data.get("tournament_id")
        if tournament_id:
            await manager.broadcast(message, f"tournament:{tournament_id}")

        # Broadcast to match topic
        match_id = match_data.get("id")
        if match_id:
            await manager.broadcast(message, f"match:{match_id}")

        logger.info(f"Broadcasted {event_type} for match {match_id}")

    @staticmethod
    async def handle_game_event(event_type: str, game_data: Dict[str, Any]):
        """Handle game-related events."""
        message = {
            "type": event_type,
            "data": game_data,
            "timestamp": game_data.get("updated_at")
        }

        # Broadcast to match topic
        match_id = game_data.get("match_id")
        if match_id:
            await manager.broadcast(message, f"match:{match_id}")

        # Broadcast to game topic
        game_id = game_data.get("id")
        if game_id:
            await manager.broadcast(message, f"game:{game_id}")

        logger.info(f"Broadcasted {event_type} for game {game_id}")

    @staticmethod
    async def handle_score_event(event_type: str, score_data: Dict[str, Any]):
        """Handle scoring events."""
        message = {
            "type": event_type,
            "data": score_data,
            "timestamp": score_data.get("created_at")
        }

        # Broadcast to game topic
        game_id = score_data.get("game_id")
        if game_id:
            await manager.broadcast(message, f"game:{game_id}")

        # Notify player
        player_id = score_data.get("player_id")
        if player_id:
            try:
                await manager.send_to_player(message, UUID(player_id))
            except ValueError:
                logger.debug(f"Invalid player_id UUID in score event: {player_id}")

        logger.info(f"Broadcasted {event_type} for game {game_id}")

    @staticmethod
    async def handle_tournament_event(event_type: str, tournament_data: Dict[str, Any]):
        """Handle tournament-related events."""
        message = {
            "type": event_type,
            "data": tournament_data,
            "timestamp": tournament_data.get("updated_at")
        }

        # Broadcast to tournament topic
        tournament_id = tournament_data.get("id")
        if tournament_id:
            await manager.broadcast(message, f"tournament:{tournament_id}")

        # Also broadcast to global tournaments feed
        await manager.broadcast(message, "tournaments")

        logger.info(f"Broadcasted {event_type} for tournament {tournament_id}")

    @staticmethod
    async def send_error(connection_id: str, error_message: str, error_code: str = None):
        """Send error message to a specific connection."""
        message = {
            "type": WebSocketEvents.ERROR,
            "error": error_message,
            "code": error_code,
        }

        await manager.send_personal_message(message, connection_id)

    @staticmethod
    async def send_ack(connection_id: str, ack_type: str, data: Dict[str, Any] = None):
        """Send acknowledgment message."""
        message = {
            "type": ack_type,
            "data": data or {},
        }

        await manager.send_personal_message(message, connection_id)


# Helper functions for easy access
async def notify_match_started(match_data: Dict[str, Any]):
    """Notify that a match has started."""
    await WebSocketHandler.handle_match_event(WebSocketEvents.MATCH_STARTED, match_data)


async def notify_match_updated(match_data: Dict[str, Any]):
    """Notify that a match has been updated."""
    await WebSocketHandler.handle_match_event(WebSocketEvents.MATCH_UPDATED, match_data)


async def notify_match_completed(match_data: Dict[str, Any]):
    """Notify that a match has been completed."""
    await WebSocketHandler.handle_match_event(WebSocketEvents.MATCH_COMPLETED, match_data)


async def notify_score_submitted(score_data: Dict[str, Any]):
    """Notify that a score has been submitted."""
    await WebSocketHandler.handle_score_event(WebSocketEvents.SCORE_SUBMITTED, score_data)


async def notify_game_updated(game_data: Dict[str, Any]):
    """Notify that a game has been updated."""
    await WebSocketHandler.handle_game_event(WebSocketEvents.GAME_UPDATED, game_data)


async def notify_tournament_started(tournament_data: Dict[str, Any]):
    """Notify that a tournament has started."""
    await WebSocketHandler.handle_tournament_event(WebSocketEvents.TOURNAMENT_STARTED, tournament_data)


async def notify_tournament_updated(tournament_data: Dict[str, Any]):
    """Notify that a tournament has been updated."""
    await WebSocketHandler.handle_tournament_event(WebSocketEvents.TOURNAMENT_UPDATED, tournament_data)


async def notify_board_assigned(data: Dict[str, Any]):
    """Notify players that a board has been assigned to their match.

    Sends a direct message to each player in the match, plus broadcasts
    to the match and tournament topics.

    Expected data keys:
        match_id, tournament_id, dartboard_number, dartboard_name,
        players: [{player_id, player_name, team_id}]
    """
    message = {
        "type": WebSocketEvents.BOARD_ASSIGNED,
        "data": data,
    }

    # Send directly to each player in the match
    players = data.get("players", [])
    for player in players:
        player_id = player.get("player_id")
        if player_id:
            try:
                await manager.send_to_player(message, UUID(player_id))
            except ValueError:
                logger.debug(f"Invalid player_id UUID in board assignment: {player_id}")

    # Also broadcast to match and tournament topics for other subscribers
    match_id = data.get("match_id")
    if match_id:
        await manager.broadcast(message, f"match:{match_id}")

    tournament_id = data.get("tournament_id")
    if tournament_id:
        await manager.broadcast(message, f"tournament:{tournament_id}")

    logger.info(f"Notified board assignment for match {match_id}")
