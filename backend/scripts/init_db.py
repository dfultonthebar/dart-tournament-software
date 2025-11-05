"""Initialize database with all tables."""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine
from backend.models import Base
from backend.core.config import settings


async def init_db():
    """Drop and recreate all database tables."""
    # Convert postgresql:// to postgresql+asyncpg://
    database_url = settings.DATABASE_URL.replace(
        "postgresql://", "postgresql+asyncpg://"
    )
    
    print(f"Connecting to database...")
    print(f"URL: {database_url.split('@')[1] if '@' in database_url else 'localhost'}")
    
    engine = create_async_engine(database_url, echo=True)
    
    try:
        async with engine.begin() as conn:
            print("\nDropping all existing tables...")
            await conn.run_sync(Base.metadata.drop_all)
            
            print("\nCreating all tables...")
            await conn.run_sync(Base.metadata.create_all)
        
        print("\n" + "="*60)
        print("✓ Database initialized successfully!")
        print("="*60)
        print("\nTables created:")
        for table in Base.metadata.sorted_tables:
            print(f"  ✓ {table.name}")
        print()
        
    except Exception as e:
        print(f"\n✗ Error initializing database: {e}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_db())
