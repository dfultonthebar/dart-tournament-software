"""Seed database with sample data."""
import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from backend.models import (
    Player, Tournament, TournamentEntry, Match, MatchPlayer,
    GameType, TournamentStatus, MatchStatus
)
from backend.core.config import settings
from backend.core.security import get_password_hash


async def seed_data():
    """Seed database with sample data."""
    # Convert postgresql:// to postgresql+asyncpg://
    database_url = settings.DATABASE_URL.replace(
        "postgresql://", "postgresql+asyncpg://"
    )
    
    engine = create_async_engine(database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    try:
        async with async_session() as session:
            print("Seeding database with sample data...\n")
            
            # Create sample players
            players = []
            player_names = [
                "Alice Johnson", "Bob Smith", "Charlie Brown", "Diana Prince",
                "Edward Norton", "Fiona Apple", "George Martin", "Helen Hunt",
                "Ivan Drago", "Julia Roberts", "Kevin Hart", "Laura Palmer"
            ]
            
            for i, name in enumerate(player_names, 1):
                player = Player(
                    name=name,
                    email=f"player{i}@example.com",
                    phone=f"555-010{i:02d}",
                    password_hash=get_password_hash("password123")
                )
                players.append(player)
                session.add(player)
            
            await session.flush()
            print(f"✓ Created {len(players)} players")
            
            # Create sample tournaments
            game_types = [GameType.GAME_501, GameType.CRICKET, GameType.GAME_301]
            tournaments = []
            
            for i, game_type in enumerate(game_types, 1):
                tournament = Tournament(
                    name=f"Weekly {game_type.value.upper()} Championship #{i}",
                    game_type=game_type,
                    status=TournamentStatus.PENDING if i == 1 else TournamentStatus.ACTIVE,
                    max_players=16,
                    start_date=datetime.utcnow() + timedelta(days=i)
                )
                tournaments.append(tournament)
                session.add(tournament)
            
            await session.flush()
            print(f"✓ Created {len(tournaments)} tournaments")
            
            # Add players to first tournament
            tournament = tournaments[0]
            for player in players[:8]:  # Add first 8 players
                entry = TournamentEntry(
                    tournament_id=tournament.id,
                    player_id=player.id,
                    seed=players.index(player) + 1
                )
                session.add(entry)
            
            await session.flush()
            print(f"✓ Added 8 players to tournament: {tournament.name}")
            
            # Create a sample match
            match = Match(
                tournament_id=tournament.id,
                round_number=1,
                match_number=1,
                status=MatchStatus.PENDING
            )
            session.add(match)
            await session.flush()
            
            # Add players to match
            match_player1 = MatchPlayer(
                match_id=match.id,
                player_id=players[0].id,
                player_number=1
            )
            match_player2 = MatchPlayer(
                match_id=match.id,
                player_id=players[1].id,
                player_number=2
            )
            session.add(match_player1)
            session.add(match_player2)
            
            await session.commit()
            print(f"✓ Created sample match: {players[0].name} vs {players[1].name}")
            
            print("\n" + "="*60)
            print("✓ Database seeded successfully!")
            print("="*60)
            print("\nSummary:")
            print(f"  - {len(players)} players")
            print(f"  - {len(tournaments)} tournaments")
            print(f"  - 8 tournament entries")
            print(f"  - 1 sample match")
            print()
            
    except Exception as e:
        print(f"\n✗ Error seeding database: {e}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_data())
