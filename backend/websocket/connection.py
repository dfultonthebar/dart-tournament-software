"""
WebSocket connection manager for real-time updates.
"""

from typing import Dict, Set, List
from uuid import UUID
from fastapi import WebSocket
import json
import asyncio
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and broadcasting."""

    def __init__(self):
        # Active connections: websocket -> connection_id
        self.active_connections: Dict[str, WebSocket] = {}

        # Subscriptions: topic -> set of connection_ids
        self.subscriptions: Dict[str, Set[str]] = {}

        # Connection metadata: connection_id -> {player_id, topics}
        self.connection_metadata: Dict[str, Dict] = {}

    async def connect(self, websocket: WebSocket, connection_id: str, player_id: UUID = None):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        self.connection_metadata[connection_id] = {
            "player_id": str(player_id) if player_id else None,
            "topics": set()
        }
        logger.info(f"WebSocket connected: {connection_id}")

    def disconnect(self, connection_id: str):
        """Remove a WebSocket connection."""
        if connection_id in self.active_connections:
            # Unsubscribe from all topics
            metadata = self.connection_metadata.get(connection_id, {})
            for topic in metadata.get("topics", set()):
                if topic in self.subscriptions:
                    self.subscriptions[topic].discard(connection_id)
                    if not self.subscriptions[topic]:
                        del self.subscriptions[topic]

            # Remove connection
            del self.active_connections[connection_id]
            if connection_id in self.connection_metadata:
                del self.connection_metadata[connection_id]

            logger.info(f"WebSocket disconnected: {connection_id}")

    async def subscribe(self, connection_id: str, topic: str):
        """Subscribe a connection to a topic."""
        if connection_id not in self.active_connections:
            return

        if topic not in self.subscriptions:
            self.subscriptions[topic] = set()

        self.subscriptions[topic].add(connection_id)

        if connection_id in self.connection_metadata:
            self.connection_metadata[connection_id]["topics"].add(topic)

        logger.info(f"Connection {connection_id} subscribed to {topic}")

    async def unsubscribe(self, connection_id: str, topic: str):
        """Unsubscribe a connection from a topic."""
        if topic in self.subscriptions:
            self.subscriptions[topic].discard(connection_id)
            if not self.subscriptions[topic]:
                del self.subscriptions[topic]

        if connection_id in self.connection_metadata:
            self.connection_metadata[connection_id]["topics"].discard(topic)

        logger.info(f"Connection {connection_id} unsubscribed from {topic}")

    async def send_personal_message(self, message: dict, connection_id: str):
        """Send a message to a specific connection."""
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to {connection_id}: {e}")
                self.disconnect(connection_id)

    async def broadcast(self, message: dict, topic: str = None):
        """
        Broadcast a message to all connections or specific topic subscribers.
        """
        if topic:
            # Send to topic subscribers only
            connection_ids = self.subscriptions.get(topic, set())
        else:
            # Send to all connections
            connection_ids = set(self.active_connections.keys())

        # Send messages concurrently
        tasks = []
        for connection_id in connection_ids:
            if connection_id in self.active_connections:
                websocket = self.active_connections[connection_id]
                tasks.append(self._safe_send(websocket, message, connection_id))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _safe_send(self, websocket: WebSocket, message: dict, connection_id: str):
        """Safely send message and handle errors."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error broadcasting to {connection_id}: {e}")
            self.disconnect(connection_id)

    async def send_to_player(self, message: dict, player_id: UUID):
        """Send message to all connections for a specific player."""
        player_id_str = str(player_id)
        sent_count = 0

        for connection_id, metadata in self.connection_metadata.items():
            if metadata.get("player_id") == player_id_str:
                await self.send_personal_message(message, connection_id)
                sent_count += 1

        if sent_count == 0:
            logger.warning(f"No WS connections found for player {player_id_str[:8]}... ({len(self.connection_metadata)} total connections)")
        else:
            logger.info(f"Sent message to {sent_count} connection(s) for player {player_id_str[:8]}...")

    def get_topic_subscriber_count(self, topic: str) -> int:
        """Get number of subscribers for a topic."""
        return len(self.subscriptions.get(topic, set()))

    def get_connection_topics(self, connection_id: str) -> List[str]:
        """Get all topics a connection is subscribed to."""
        metadata = self.connection_metadata.get(connection_id, {})
        return list(metadata.get("topics", set()))


# Global connection manager instance
manager = ConnectionManager()
