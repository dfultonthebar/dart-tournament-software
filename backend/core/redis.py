from redis.asyncio import Redis, from_url
from backend.core.config import settings
from typing import Optional
import json

redis_client: Optional[Redis] = None


async def get_redis() -> Redis:
    """Get Redis client instance."""
    global redis_client
    if redis_client is None:
        redis_client = await from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
    return redis_client


async def close_redis() -> None:
    """Close Redis connection."""
    global redis_client
    if redis_client:
        await redis_client.close()


class CacheService:
    """Service for caching data in Redis."""

    def __init__(self, redis: Redis):
        self.redis = redis

    async def get(self, key: str) -> Optional[dict]:
        """Get cached value."""
        value = await self.redis.get(key)
        if value:
            return json.loads(value)
        return None

    async def set(self, key: str, value: dict, ttl: int = settings.REDIS_CACHE_TTL) -> None:
        """Set cached value with TTL."""
        await self.redis.setex(key, ttl, json.dumps(value))

    async def delete(self, key: str) -> None:
        """Delete cached value."""
        await self.redis.delete(key)

    async def delete_pattern(self, pattern: str) -> None:
        """Delete all keys matching pattern."""
        async for key in self.redis.scan_iter(match=pattern):
            await self.redis.delete(key)
