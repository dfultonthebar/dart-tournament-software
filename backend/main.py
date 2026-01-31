from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import uuid
import json
import logging

from backend.core import init_db, close_redis, settings
from backend.api import (
    auth_router,
    players_router,
    tournaments_router,
    matches_router,
    scoring_router,
    events_router,
    dartboards_router,
)
from backend.websocket import manager, WebSocketEvents

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Startup
    if "change-in-production" in settings.SECRET_KEY:
        logger.warning("Using default SECRET_KEY! Set SECRET_KEY in .env for production.")
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database initialized")

    yield

    # Shutdown
    logger.info("Closing Redis connection...")
    await close_redis()
    logger.info("Disposing database engine...")
    from backend.core.database import engine
    await engine.dispose()
    logger.info("Application shutdown complete")


app = FastAPI(
    title="Dart Tournament API",
    version="1.0.0",
    description="WAMO Dart Tournament Management System",
    lifespan=lifespan
)

# CORS middleware — allow any host on our frontend ports so phones on the
# LAN can reach the API (not just localhost).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^http://.*:(3001|3002|3003)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(players_router, prefix="/api")
app.include_router(tournaments_router, prefix="/api")
app.include_router(matches_router, prefix="/api")
app.include_router(scoring_router, prefix="/api")
app.include_router(events_router, prefix="/api")
app.include_router(dartboards_router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Dart Tournament API",
        "version": "1.0.0",
        "status": "running"
    }


def _get_network_info():
    """Sync function for blocking network operations."""
    import socket
    hostname = socket.gethostname()
    ip_addresses = []
    try:
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ip_addresses and not ip.startswith('127.'):
                ip_addresses.append(ip)
        if not ip_addresses:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip_addresses.append(s.getsockname()[0])
            s.close()
    except Exception:
        ip_addresses = []
    return hostname, ip_addresses


@app.get("/health")
async def health():
    """Health check endpoint."""
    hostname, ip_addresses = await asyncio.to_thread(_get_network_info)

    return {
        "status": "healthy",
        "hostname": hostname,
        "ip_addresses": ip_addresses
    }


# In-memory display settings (shared between admin and display terminals)
_display_settings = {
    "qr_code_enabled": False,
}


@app.get("/api/display-settings")
async def get_display_settings():
    """Get current display terminal settings."""
    return _display_settings


@app.patch("/api/display-settings")
async def update_display_settings(settings_update: dict):
    """Update display terminal settings (admin only in practice)."""
    for key in settings_update:
        if key in _display_settings:
            _display_settings[key] = settings_update[key]
    return _display_settings


@app.get("/server-info")
async def server_info():
    """
    Get server information for QR code generation.

    Returns the server's base URL that can be used to generate QR codes
    for player self-registration.
    """
    import os

    hostname, ip_addresses = await asyncio.to_thread(_get_network_info)
    port = int(os.environ.get("PORT", 8000))

    primary_ip = ip_addresses[0] if ip_addresses else None

    # Build base URLs
    base_url = f"http://{primary_ip}:{port}" if primary_ip else f"http://localhost:{port}"
    registration_url = f"{base_url}/api/players/register"

    return {
        "hostname": hostname,
        "ip_address": primary_ip,
        "port": port,
        "base_url": base_url,
        "registration_url": registration_url,
        "api_docs_url": f"{base_url}/docs",
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, player_id: str = None):
    """
    WebSocket endpoint for real-time updates.

    Query params:
        player_id: Optional player UUID. When provided, enables direct
                   player-targeted messages (e.g. board assignment notifications).

    Message format:
    {
        "action": "subscribe" | "unsubscribe" | "ping",
        "topic": "tournament:UUID" | "match:UUID" | "game:UUID" | "tournaments",
        "data": {...}
    }
    """
    connection_id = str(uuid.uuid4())

    # Parse player_id if provided
    parsed_player_id = None
    if player_id:
        try:
            parsed_player_id = uuid.UUID(player_id)
        except ValueError:
            logger.warning(f"Invalid player_id in WebSocket connect: {player_id}")

    await manager.connect(websocket, connection_id, parsed_player_id)

    # Send connection acknowledgment
    await manager.send_personal_message(
        {
            "type": WebSocketEvents.CONNECTION_ACK,
            "connection_id": connection_id,
            "message": "Connected to Dart Tournament WebSocket"
        },
        connection_id
    )

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                action = message.get("action")
                topic = message.get("topic")

                if action == "subscribe" and topic:
                    await manager.subscribe(connection_id, topic)
                    await manager.send_personal_message(
                        {
                            "type": WebSocketEvents.SUBSCRIPTION_ACK,
                            "topic": topic,
                            "subscribed": True
                        },
                        connection_id
                    )

                elif action == "unsubscribe" and topic:
                    await manager.unsubscribe(connection_id, topic)
                    await manager.send_personal_message(
                        {
                            "type": WebSocketEvents.SUBSCRIPTION_ACK,
                            "topic": topic,
                            "subscribed": False
                        },
                        connection_id
                    )

                elif action == "ping":
                    await manager.send_personal_message(
                        {"type": "pong", "timestamp": message.get("timestamp")},
                        connection_id
                    )

                else:
                    await manager.send_personal_message(
                        {
                            "type": WebSocketEvents.ERROR,
                            "error": "Unknown action or missing topic"
                        },
                        connection_id
                    )

            except json.JSONDecodeError:
                await manager.send_personal_message(
                    {
                        "type": WebSocketEvents.ERROR,
                        "error": "Invalid JSON"
                    },
                    connection_id
                )

    except WebSocketDisconnect:
        manager.disconnect(connection_id)
        logger.info(f"Client {connection_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for {connection_id}: {e}")
        manager.disconnect(connection_id)
