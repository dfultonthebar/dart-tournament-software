from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
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
)
from backend.websocket import manager, WebSocketEvents

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Startup
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database initialized")

    yield

    # Shutdown
    logger.info("Closing Redis connection...")
    await close_redis()
    logger.info("Application shutdown complete")


app = FastAPI(
    title="Dart Tournament API",
    version="1.0.0",
    description="WAMO Dart Tournament Management System",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
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


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Dart Tournament API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time updates.

    Message format:
    {
        "action": "subscribe" | "unsubscribe" | "ping",
        "topic": "tournament:UUID" | "match:UUID" | "game:UUID" | "tournaments",
        "data": {...}
    }
    """
    connection_id = str(uuid.uuid4())

    await manager.connect(websocket, connection_id)

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
