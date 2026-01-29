#!/usr/bin/env python3
"""
Comprehensive Stress Test for Dart Tournament System
Simulates multiple concurrent users, tests dartboard locking, scoring, board rotation, etc.
"""

import asyncio
import aiohttp
import random
import string
import time
import json
from datetime import date, datetime
from typing import Optional
from dataclasses import dataclass
from collections import defaultdict

# Configuration
BASE_URL = "http://localhost:8000/api"
ADMIN_NAME = "Admin"
ADMIN_PIN = "1972"

# Test parameters
NUM_PLAYERS = 20
NUM_DARTBOARDS = 4
CONCURRENT_SCORERS = 4
MAX_THROWS_PER_GAME = 30

# Statistics
stats = defaultdict(int)
errors = []
lock_violations = []


@dataclass
class TestContext:
    token: str
    event_id: str
    tournament_ids: list
    player_ids: list
    dartboard_ids: list
    match_ids: list


def log(msg: str, level: str = "INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"[{timestamp}] [{level}] {msg}")


def random_name():
    first_names = ["John", "Jane", "Mike", "Sarah", "Chris", "Emma", "David", "Lisa", "Tom", "Amy",
                   "James", "Emily", "Robert", "Jessica", "William", "Ashley", "Michael", "Amanda",
                   "Daniel", "Nicole", "Kevin", "Stephanie", "Brian", "Rachel", "Steve", "Laura"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
                  "Martinez", "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Martin", "Lee"]
    return f"{random.choice(first_names)} {random.choice(last_names)}"


def random_email():
    return f"player_{random.randint(1000, 9999)}_{int(time.time() * 1000) % 10000}@test.com"


def random_phone():
    return f"555-{random.randint(100, 999)}-{random.randint(1000, 9999)}"


async def make_request(session: aiohttp.ClientSession, method: str, endpoint: str,
                       token: Optional[str] = None, data: Optional[dict] = None,
                       expect_error: bool = False) -> tuple[bool, dict]:
    """Make an HTTP request and return (success, response_data)"""
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"{BASE_URL}{endpoint}"

    try:
        async with session.request(method, url, headers=headers, json=data) as resp:
            stats[f"{method}_{resp.status}"] += 1

            if resp.status == 204:
                return True, {}

            try:
                response_data = await resp.json()
            except:
                response_data = {"raw": await resp.text()}

            if resp.status >= 400:
                if not expect_error:
                    errors.append(f"{method} {endpoint}: {resp.status} - {response_data}")
                return False, response_data

            return True, response_data
    except Exception as e:
        stats["connection_errors"] += 1
        errors.append(f"{method} {endpoint}: {str(e)}")
        return False, {"error": str(e)}


async def login(session: aiohttp.ClientSession) -> Optional[str]:
    """Login and get auth token"""
    log("Logging in as admin...")
    success, data = await make_request(session, "POST", "/auth/pin-login",
                                        data={"name": ADMIN_NAME, "pin": ADMIN_PIN})
    if success and "access_token" in data:
        log("Login successful")
        return data["access_token"]
    else:
        log(f"Login failed: {data}", "ERROR")
        return None


async def create_dartboards(session: aiohttp.ClientSession, token: str) -> list[str]:
    """Create dartboards for testing"""
    log(f"Creating {NUM_DARTBOARDS} dartboards...")
    dartboard_ids = []

    for i in range(1, NUM_DARTBOARDS + 1):
        success, data = await make_request(session, "POST", "/dartboards", token,
                                           {"number": i, "name": f"Test Board {i}"})
        if success:
            dartboard_ids.append(data["id"])
            stats["dartboards_created"] += 1
        else:
            # Board might already exist, try to get it
            success, boards = await make_request(session, "GET", "/dartboards")
            if success:
                for board in boards:
                    if board["number"] == i:
                        dartboard_ids.append(board["id"])
                        break

    log(f"Dartboards ready: {len(dartboard_ids)}")
    return dartboard_ids


async def create_players(session: aiohttp.ClientSession, token: str) -> list[str]:
    """Create test players"""
    log(f"Creating {NUM_PLAYERS} test players...")
    player_ids = []

    # Create players concurrently via /players/register endpoint
    tasks = []
    for i in range(NUM_PLAYERS):
        player_data = {
            "name": random_name(),
            "email": random_email(),
            "phone": random_phone(),
            "pin": f"{random.randint(1000, 9999)}",
            "password": "testpass123"
        }
        tasks.append(make_request(session, "POST", "/players/register", token, player_data))

    results = await asyncio.gather(*tasks)

    for success, data in results:
        if success and "id" in data:
            player_ids.append(data["id"])
            stats["players_created"] += 1

    # If we couldn't create enough, get existing players
    if len(player_ids) < 8:
        log("Fetching existing players...")
        success, players = await make_request(session, "GET", "/players")
        if success:
            for player in players:
                if player["id"] not in player_ids and player.get("is_active", True):
                    if not player.get("email", "").endswith("@thebar.com"):
                        player_ids.append(player["id"])
                        if len(player_ids) >= NUM_PLAYERS:
                            break

    log(f"Players ready: {len(player_ids)}")
    return player_ids


async def create_event(session: aiohttp.ClientSession, token: str) -> Optional[str]:
    """Create a test event"""
    log("Creating test event...")
    event_data = {
        "name": f"Stress Test Event {int(time.time())}",
        "start_date": str(date.today()),
        "end_date": str(date.today()),
        "location": "Test Venue",
        "sport_type": "darts"
    }

    success, data = await make_request(session, "POST", "/events", token, event_data)
    if success:
        stats["events_created"] += 1
        log(f"Event created: {data['id']}")
        return data["id"]
    else:
        log(f"Failed to create event: {data}", "ERROR")
        return None


async def create_tournament(session: aiohttp.ClientSession, token: str, event_id: str,
                           config: dict) -> Optional[str]:
    """Create a single tournament"""
    tournament_data = {
        "event_id": event_id,
        "name": f"{config['name']} - Test",
        "game_type": config["game_type"],
        "format": config["format"],
        "max_players": config.get("max_players", 16),
        "legs_to_win": config.get("legs_to_win", 2),
        "sets_to_win": config.get("sets_to_win", 1),
        "double_in": config.get("double_in", False),
        "double_out": config.get("double_out", True),
        "master_out": False
    }

    if config["game_type"] in ["501", "301"]:
        tournament_data["starting_score"] = int(config["game_type"])

    success, data = await make_request(session, "POST", "/tournaments", token, tournament_data)
    if success:
        stats["tournaments_created"] += 1
        log(f"Tournament created: {config['name']}")
        return data["id"]
    return None


async def register_and_checkin_players(session: aiohttp.ClientSession, token: str,
                                        tournament_id: str, player_ids: list[str],
                                        count: int = 8):
    """Register and check in players for a tournament"""
    selected_players = random.sample(player_ids, min(count, len(player_ids)))

    # Register
    tasks = []
    for player_id in selected_players:
        tasks.append(make_request(session, "POST",
                                  f"/tournaments/{tournament_id}/entries/{player_id}", token))
    results = await asyncio.gather(*tasks)
    registered = sum(1 for success, _ in results if success)
    stats["tournament_registrations"] += registered

    # Check in
    success, entries = await make_request(session, "GET", f"/tournaments/{tournament_id}/entries")
    if success:
        for entry in entries:
            await make_request(session, "POST",
                               f"/tournaments/{tournament_id}/entries/{entry['id']}/check-in", token)
            await make_request(session, "PATCH",
                               f"/tournaments/{tournament_id}/entries/{entry['id']}", token,
                               {"paid": True})

    return selected_players


async def start_tournament(session: aiohttp.ClientSession, token: str,
                           tournament_id: str) -> list[str]:
    """Open registration and start tournament"""
    match_ids = []

    # Open registration
    await make_request(session, "PATCH", f"/tournaments/{tournament_id}", token,
                      {"status": "registration"})

    # Generate bracket
    success, data = await make_request(session, "POST",
                                       f"/tournaments/{tournament_id}/generate-bracket", token)
    if success:
        stats["tournaments_started"] += 1

        # Get matches
        success, matches = await make_request(session, "GET", f"/matches?tournament_id={tournament_id}")
        if success:
            for match in matches:
                match_ids.append(match["id"])
                stats["matches_created"] += 1
    else:
        log(f"Failed to start tournament: {data}", "WARN")

    return match_ids


async def test_501_tournament(session: aiohttp.ClientSession, token: str,
                               event_id: str, player_ids: list[str], dartboard_ids: list[str]):
    """Test a full 501 tournament with scoring"""
    log("\n" + "="*50)
    log("TESTING 501 SINGLES TOURNAMENT")
    log("="*50)

    # Create tournament
    tournament_id = await create_tournament(session, token, event_id, {
        "name": "501 Singles",
        "game_type": "501",
        "format": "single_elimination",
        "legs_to_win": 1,
        "double_out": True
    })

    if not tournament_id:
        return []

    # Register players
    await register_and_checkin_players(session, token, tournament_id, player_ids, 8)

    # Start tournament
    match_ids = await start_tournament(session, token, tournament_id)
    log(f"501 Tournament: {len(match_ids)} matches created")

    return match_ids


async def test_301_tournament(session: aiohttp.ClientSession, token: str,
                               event_id: str, player_ids: list[str]):
    """Test a 301 tournament"""
    log("\n" + "="*50)
    log("TESTING 301 DOUBLES TOURNAMENT")
    log("="*50)

    tournament_id = await create_tournament(session, token, event_id, {
        "name": "301 Doubles",
        "game_type": "301",
        "format": "single_elimination",
        "legs_to_win": 2,
        "double_out": True
    })

    if not tournament_id:
        return []

    await register_and_checkin_players(session, token, tournament_id, player_ids, 8)
    match_ids = await start_tournament(session, token, tournament_id)
    log(f"301 Tournament: {len(match_ids)} matches created")

    return match_ids


async def test_cricket_tournament(session: aiohttp.ClientSession, token: str,
                                   event_id: str, player_ids: list[str]):
    """Test a Cricket tournament (round robin)"""
    log("\n" + "="*50)
    log("TESTING CRICKET ROUND ROBIN")
    log("="*50)

    tournament_id = await create_tournament(session, token, event_id, {
        "name": "Cricket Championship",
        "game_type": "cricket",
        "format": "round_robin",
        "legs_to_win": 1,
        "double_out": False
    })

    if not tournament_id:
        return []

    await register_and_checkin_players(session, token, tournament_id, player_ids, 4)
    match_ids = await start_tournament(session, token, tournament_id)
    log(f"Cricket Tournament: {len(match_ids)} matches created")

    return match_ids


async def test_lucky_draw_tournament(session: aiohttp.ClientSession, token: str,
                                      event_id: str, player_ids: list[str]):
    """Test Lucky Draw Doubles tournament"""
    log("\n" + "="*50)
    log("TESTING LUCKY DRAW DOUBLES")
    log("="*50)

    tournament_id = await create_tournament(session, token, event_id, {
        "name": "Lucky Draw Doubles",
        "game_type": "501",
        "format": "lucky_draw_doubles",
        "max_players": 16,
        "legs_to_win": 2,
        "double_out": True
    })

    if not tournament_id:
        return [], []

    # Need even number for teams
    num_players = min(8, len(player_ids))
    if num_players % 2 != 0:
        num_players -= 1

    await register_and_checkin_players(session, token, tournament_id, player_ids, num_players)

    # Generate lucky draw teams
    log("Generating random teams...")
    success, teams = await make_request(session, "POST",
                                         f"/tournaments/{tournament_id}/lucky-draw", token)

    if success:
        log(f"Created {len(teams)} random teams:")
        for team in teams:
            log(f"  - {team['name']}: {team.get('player1_name', 'P1')} & {team.get('player2_name', 'P2')}")
        stats["teams_generated"] += len(teams)
    else:
        log(f"Failed to generate teams: {teams}", "ERROR")
        return [], []

    # Get teams
    success, team_list = await make_request(session, "GET", f"/tournaments/{tournament_id}/teams")
    if success:
        log(f"Verified {len(team_list)} teams in tournament")

    # Note: Lucky Draw bracket generation would need additional logic
    # For now, test that teams were created correctly
    return [], teams


async def start_match_and_get_game(session: aiohttp.ClientSession, token: str,
                                    match_id: str) -> Optional[str]:
    """Start a match and return the game ID"""
    # Start the match (creates initial game)
    success, data = await make_request(session, "POST", f"/matches/{match_id}/start", token)
    if not success:
        return None

    stats["matches_started"] += 1

    # Get games for this match
    success, games = await make_request(session, "GET", f"/matches/{match_id}/games")
    if success and games:
        return games[0]["id"]

    return None


async def simulate_501_scoring(session: aiohttp.ClientSession, token: str,
                                match_id: str, game_id: str, player_ids: list[str]):
    """Simulate scoring a 501 game to completion"""
    # Track scores
    scores = {pid: 501 for pid in player_ids}
    current_player_idx = 0
    throw_count = 0

    while throw_count < MAX_THROWS_PER_GAME:
        player_id = player_ids[current_player_idx % len(player_ids)]

        # Generate a throw that makes sense for 501
        remaining = scores.get(player_id, 501)

        if remaining <= 40:
            # Try to finish - need a double
            target = remaining // 2
            throw_scores = [target]
            throw_multipliers = [2]  # Double
        elif remaining <= 100:
            # Good scoring throw
            throw_scores = [20, 20, remaining - 40 if remaining - 40 <= 20 else 20]
            throw_multipliers = [3, 3, 1]
        else:
            # Regular scoring
            throw_scores = [random.choice([20, 19, 18]), random.choice([20, 19, 18]), random.choice([20, 19, 18])]
            throw_multipliers = [random.choice([1, 2, 3]) for _ in range(3)]

        throw_data = {
            "game_id": game_id,
            "player_id": player_id,
            "throw": {
                "scores": throw_scores,
                "multipliers": throw_multipliers
            }
        }

        success, result = await make_request(session, "POST", "/scoring/submit", token, throw_data, expect_error=True)

        if success:
            stats["throws_submitted"] += 1

            # Update local score tracking
            total = sum(s * m for s, m in zip(throw_scores, throw_multipliers))
            new_score = remaining - total
            if new_score >= 0:
                scores[player_id] = new_score

            if scores[player_id] == 0:
                log(f"  Game won by player after {throw_count + 1} throws!")
                stats["games_completed"] += 1
                return True
        else:
            # Bust or invalid - score stays same
            stats["throw_errors"] += 1

        current_player_idx += 1
        throw_count += 1

    return False


async def test_full_match_scoring(session: aiohttp.ClientSession, token: str,
                                   match_id: str, dartboard_id: str, match_num: int):
    """Complete a full match with scoring"""
    log(f"\n[Match {match_num}] Starting full scoring test...")

    # Assign dartboard
    success, _ = await make_request(session, "POST",
                                    f"/dartboards/matches/{match_id}/assign-board/{dartboard_id}", token)
    if not success:
        log(f"[Match {match_num}] Could not assign board", "WARN")
        return False

    stats["board_assignments"] += 1

    # Get match with players
    success, match_data = await make_request(session, "GET", f"/matches/{match_id}")
    if not success or not match_data.get("players"):
        log(f"[Match {match_num}] No players in match", "WARN")
        await make_request(session, "POST", f"/dartboards/matches/{match_id}/release-board", token)
        return False

    player_ids = [p["player_id"] for p in match_data["players"]]
    if len(player_ids) < 2:
        log(f"[Match {match_num}] Need 2 players", "WARN")
        await make_request(session, "POST", f"/dartboards/matches/{match_id}/release-board", token)
        return False

    # Start match and get game
    game_id = await start_match_and_get_game(session, token, match_id)
    if not game_id:
        log(f"[Match {match_num}] Could not start match/game", "WARN")
        await make_request(session, "POST", f"/dartboards/matches/{match_id}/release-board", token)
        return False

    log(f"[Match {match_num}] Match started, game: {game_id[:8]}...")

    # Score some throws
    await simulate_501_scoring(session, token, match_id, game_id, player_ids)

    # Complete the match by setting winner (triggers auto board release)
    winner = player_ids[0]  # First player wins for testing
    success, _ = await make_request(session, "PATCH", f"/matches/{match_id}", token, {
        "status": "completed",
        "winner_id": winner
    })

    if success:
        stats["matches_completed"] += 1
        log(f"[Match {match_num}] Match completed with winner!")
        stats["games_completed"] += 1
        return True
    else:
        # Manual release if auto-release didn't work
        await make_request(session, "POST", f"/dartboards/matches/{match_id}/release-board", token)
        stats["boards_released"] += 1
        return False


async def test_board_rotation(session: aiohttp.ClientSession, token: str,
                               match_ids: list[str], dartboard_ids: list[str]):
    """Test that boards rotate correctly: complete match → release → assign to next"""
    log("\n" + "="*50)
    log("TESTING BOARD ROTATION")
    log("="*50)

    if len(match_ids) < 2 or len(dartboard_ids) < 1:
        log("Not enough matches/boards for rotation test", "WARN")
        return

    board_id = dartboard_ids[0]

    # Complete first match on board
    log(f"Step 1: Complete match on board {board_id[:8]}...")
    completed = await test_full_match_scoring(session, token, match_ids[0], board_id, 1)

    if not completed:
        log("First match didn't complete, skipping rotation test", "WARN")
        return

    # Verify board is available
    success, boards = await make_request(session, "GET", "/dartboards/available")
    board_available = any(b["id"] == board_id for b in boards) if success else False

    if board_available:
        log(f"Step 2: Board released and available ✓")
        stats["rotation_release_passed"] += 1
    else:
        log(f"Step 2: Board NOT available after release!", "ERROR")
        stats["rotation_failures"] += 1
        return

    # Assign same board to next match
    log(f"Step 3: Assigning board to second match...")
    success, _ = await make_request(session, "POST",
                                    f"/dartboards/matches/{match_ids[1]}/assign-board/{board_id}", token)

    if success:
        log(f"Step 4: Board rotation successful - same board assigned to next match ✓")
        stats["rotation_reassign_passed"] += 1
    else:
        log(f"Step 4: Could not assign board to next match!", "ERROR")
        stats["rotation_failures"] += 1

    # Cleanup
    await make_request(session, "POST", f"/dartboards/matches/{match_ids[1]}/release-board", token)


async def test_dartboard_locking(session: aiohttp.ClientSession, token: str,
                                  dartboard_ids: list[str], match_ids: list[str]):
    """Test that dartboard locking works correctly"""
    log("\n" + "="*50)
    log("TESTING DARTBOARD LOCKING")
    log("="*50)

    if len(dartboard_ids) < 1 or len(match_ids) < 2:
        log("Not enough dartboards or matches to test locking", "WARN")
        return

    board_id = dartboard_ids[0]
    match1_id = match_ids[0]
    match2_id = match_ids[1]

    # Assign board to first match
    success, data = await make_request(session, "POST",
                                        f"/dartboards/matches/{match1_id}/assign-board/{board_id}", token)

    if success:
        log(f"Board assigned to match 1")
        stats["board_assignments"] += 1

        # Try to assign same board to second match - should fail!
        success2, data2 = await make_request(session, "POST",
                                              f"/dartboards/matches/{match2_id}/assign-board/{board_id}",
                                              token, expect_error=True)

        if not success2:
            log("PASS: Board locking prevented duplicate assignment ✓")
            stats["lock_tests_passed"] += 1
        else:
            log("FAIL: Board was assigned to two matches!", "ERROR")
            lock_violations.append(f"Board {board_id} assigned to both matches")
            stats["lock_violations"] += 1

        # Release board
        await make_request(session, "POST", f"/dartboards/matches/{match1_id}/release-board", token)


async def concurrent_board_assignment_test(session: aiohttp.ClientSession, token: str,
                                           dartboard_ids: list[str], match_ids: list[str]):
    """Try to break board locking with concurrent assignments"""
    log("\n" + "="*50)
    log("TESTING CONCURRENT BOARD ASSIGNMENTS")
    log("="*50)

    if len(dartboard_ids) < 1 or len(match_ids) < 4:
        log("Not enough resources for concurrent test", "WARN")
        return

    board_id = dartboard_ids[0]

    # Make sure board is available first
    for mid in match_ids[:4]:
        await make_request(session, "POST", f"/dartboards/matches/{mid}/release-board", token, expect_error=True)

    # Try to assign same board to multiple matches simultaneously
    async def try_assign(match_id):
        success, data = await make_request(session, "POST",
                                           f"/dartboards/matches/{match_id}/assign-board/{board_id}",
                                           token, expect_error=True)
        return match_id, success, data

    # Fire off concurrent assignments
    log(f"Firing 4 concurrent assignment requests for board {board_id[:8]}...")
    tasks = [try_assign(mid) for mid in match_ids[:4]]
    results = await asyncio.gather(*tasks)

    successful = [r for r in results if r[1]]

    if len(successful) > 1:
        log(f"FAIL: RACE CONDITION - {len(successful)} matches got the same board!", "ERROR")
        stats["race_conditions"] += 1
        lock_violations.append(f"Race condition: {len(successful)} matches assigned board {board_id}")
    elif len(successful) == 1:
        log(f"PASS: Only 1 match won the race ✓")
        stats["concurrent_tests_passed"] += 1
    else:
        log("No assignments succeeded - board might have been busy", "WARN")

    # Cleanup
    for mid, success, _ in results:
        if success:
            await make_request(session, "POST", f"/dartboards/matches/{mid}/release-board", token)


async def hammer_api(session: aiohttp.ClientSession, token: str, duration_seconds: int = 5):
    """Hammer the API with rapid requests to test stability"""
    log(f"\nHammering API for {duration_seconds} seconds...")

    start_time = time.time()
    request_count = 0

    endpoints = [
        ("GET", "/events"),
        ("GET", "/tournaments"),
        ("GET", "/players"),
        ("GET", "/dartboards"),
        ("GET", "/dartboards/available"),
    ]

    async def rapid_request():
        nonlocal request_count
        method, endpoint = random.choice(endpoints)
        await make_request(session, method, endpoint, token)
        request_count += 1

    while time.time() - start_time < duration_seconds:
        tasks = [rapid_request() for _ in range(20)]
        await asyncio.gather(*tasks)
        stats["hammer_requests"] += 20

    elapsed = time.time() - start_time
    rps = request_count / elapsed
    log(f"API hammer complete: {request_count} requests in {elapsed:.2f}s ({rps:.0f} req/s)")
    stats["hammer_rps"] = rps


async def verify_final_state(session: aiohttp.ClientSession, token: str):
    """Verify system state after tests"""
    log("\n" + "="*50)
    log("FINAL STATE VERIFICATION")
    log("="*50)

    # Check dartboards
    success, boards = await make_request(session, "GET", "/dartboards")
    if success:
        unavailable = [b for b in boards if not b["is_available"]]
        if unavailable:
            log(f"WARNING: {len(unavailable)} boards still marked unavailable", "WARN")
            for b in unavailable:
                log(f"  - Board {b['number']}: {b['name']}", "WARN")
        else:
            log("All dartboards available ✓")
            stats["final_board_check_passed"] = 1


def print_report():
    """Print final test report"""
    print("\n" + "=" * 60)
    print("STRESS TEST REPORT")
    print("=" * 60)

    print("\n📊 STATISTICS:")
    for key, value in sorted(stats.items()):
        print(f"  {key}: {value}")

    if errors:
        print(f"\n❌ ERRORS ({len(errors)}):")
        for error in errors[:15]:
            print(f"  - {error}")
        if len(errors) > 15:
            print(f"  ... and {len(errors) - 15} more errors")

    if lock_violations:
        print(f"\n🔒 LOCK VIOLATIONS ({len(lock_violations)}):")
        for violation in lock_violations:
            print(f"  - {violation}")

    print("\n" + "=" * 60)

    # Summary
    lock_passed = stats.get("lock_tests_passed", 0)
    concurrent_passed = stats.get("concurrent_tests_passed", 0)
    rotation_passed = stats.get("rotation_release_passed", 0) + stats.get("rotation_reassign_passed", 0)
    violations = stats.get("lock_violations", 0) + stats.get("race_conditions", 0)

    print("\n📝 TEST SUMMARY:")
    print(f"  Lock tests: {'✓ PASSED' if lock_passed else '✗ FAILED'}")
    print(f"  Concurrent tests: {'✓ PASSED' if concurrent_passed else '✗ FAILED'}")
    print(f"  Board rotation: {'✓ PASSED' if rotation_passed >= 2 else '⚠ INCOMPLETE'}")
    print(f"  Games completed: {stats.get('games_completed', 0)}")
    print(f"  Matches completed: {stats.get('matches_completed', 0)}")

    if violations == 0:
        print("\n✅ ALL LOCKING TESTS PASSED")
    else:
        print(f"\n❌ LOCKING ISSUES: {violations} violations")

    print("=" * 60 + "\n")


async def main():
    """Main test runner"""
    log("=" * 60)
    log("DART TOURNAMENT STRESS TEST")
    log("=" * 60)

    connector = aiohttp.TCPConnector(limit=50)
    timeout = aiohttp.ClientTimeout(total=30)

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        # 1. Login
        token = await login(session)
        if not token:
            log("Cannot proceed without authentication", "ERROR")
            return

        # 2. Create dartboards
        dartboard_ids = await create_dartboards(session, token)

        # 3. Create players
        player_ids = await create_players(session, token)

        # 4. Create event
        event_id = await create_event(session, token)
        if not event_id:
            log("Cannot proceed without event", "ERROR")
            return

        # 5. Test different tournament types
        all_match_ids = []

        # 501 Singles
        match_ids_501 = await test_501_tournament(session, token, event_id, player_ids, dartboard_ids)
        all_match_ids.extend(match_ids_501)

        # 301 Doubles
        match_ids_301 = await test_301_tournament(session, token, event_id, player_ids)
        all_match_ids.extend(match_ids_301)

        # Cricket Round Robin
        match_ids_cricket = await test_cricket_tournament(session, token, event_id, player_ids)
        all_match_ids.extend(match_ids_cricket)

        # Lucky Draw Doubles
        _, teams = await test_lucky_draw_tournament(session, token, event_id, player_ids)

        log(f"\nTotal matches across all tournaments: {len(all_match_ids)}")

        # 6. Test dartboard locking
        await test_dartboard_locking(session, token, dartboard_ids, all_match_ids)

        # 7. Test concurrent board assignment
        await concurrent_board_assignment_test(session, token, dartboard_ids, all_match_ids)

        # 8. Test board rotation (complete match → release → assign next)
        # Use first-round matches (0-3) which have players assigned
        if len(match_ids_501) >= 2:
            await test_board_rotation(session, token, match_ids_501[:3], dartboard_ids)

        # 9. Hammer API
        await hammer_api(session, token, duration_seconds=5)

        # 10. Verify final state
        await verify_final_state(session, token)

    # Print report
    print_report()


if __name__ == "__main__":
    asyncio.run(main())
