#!/usr/bin/env python3
"""
HARDCORE STRESS TEST - Simulates a busy tournament night
- 100 players registering
- Multiple tournaments (501, 301, Cricket, Lucky Draw Doubles)
- 12 players per tournament max
- Players signing up for tournaments
- Admin marking payments
- Full scoring simulation with bracket advancement
- 10 dartboards with concurrent usage
"""

import asyncio
import aiohttp
import random
import time
from datetime import date, datetime
from collections import defaultdict
from typing import Optional, List, Dict

# Configuration
BASE_URL = "http://localhost:8000/api"
ADMIN_NAME = "Admin"
ADMIN_PIN = "1972"

# Test parameters
NUM_PLAYERS = 100
NUM_DARTBOARDS = 10
MAX_PLAYERS_PER_TOURNAMENT = 12
CONCURRENT_SCORERS = 8
MAX_THROWS_PER_GAME = 40

# Statistics
stats = defaultdict(int)
errors = []
lock_violations = []

# Shared data
players_created = []
tournaments_created = []
admin_token = None


def log(msg: str, level: str = "INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    symbols = {"INFO": "→", "WARN": "⚠", "ERROR": "✗", "SUCCESS": "✓"}
    print(f"[{timestamp}] [{symbols.get(level, '•')}] {msg}")


def random_name():
    first_names = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
                   "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
                   "Thomas", "Sarah", "Charles", "Karen", "Chris", "Nancy", "Daniel", "Lisa", "Matt",
                   "Betty", "Mark", "Margaret", "Donald", "Sandra", "Steven", "Ashley", "Paul", "Kim",
                   "Andrew", "Emily", "Joshua", "Donna", "Ken", "Michelle", "Kevin", "Dorothy", "Brian",
                   "Carol", "George", "Amanda", "Edward", "Melissa", "Ron", "Deborah", "Tim", "Stephanie",
                   "Jason", "Rebecca", "Jeff", "Sharon", "Ryan", "Laura", "Jake", "Cynthia", "Gary", "Amy"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
                  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
                  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White",
                  "Harris", "Sanchez", "Clark", "Lewis", "Robinson", "Walker", "Young", "Allen", "King"]
    return f"{random.choice(first_names)} {random.choice(last_names)} {random.randint(1, 99)}"


def random_email(name: str):
    clean_name = name.lower().replace(" ", ".").replace(".", "")[:20]
    return f"{clean_name}_{random.randint(1000, 9999)}@test.com"


def random_phone():
    return f"{random.randint(200, 999)}{random.randint(1000000, 9999999)}"


async def make_request(session: aiohttp.ClientSession, method: str, endpoint: str,
                       token: Optional[str] = None, data: Optional[dict] = None,
                       expect_error: bool = False) -> tuple[bool, dict]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"{BASE_URL}{endpoint}"

    try:
        async with session.request(method, url, headers=headers, json=data, timeout=30) as resp:
            stats[f"{method}_{resp.status}"] += 1

            if resp.status == 204:
                return True, {}

            try:
                response_data = await resp.json()
            except:
                response_data = {"raw": await resp.text()}

            if resp.status >= 400:
                if not expect_error:
                    errors.append(f"{method} {endpoint}: {resp.status} - {str(response_data)[:100]}")
                return False, response_data

            return True, response_data
    except asyncio.TimeoutError:
        stats["timeouts"] += 1
        return False, {"error": "timeout"}
    except Exception as e:
        stats["connection_errors"] += 1
        if not expect_error:
            errors.append(f"{method} {endpoint}: {str(e)[:100]}")
        return False, {"error": str(e)}


async def admin_login(session: aiohttp.ClientSession) -> Optional[str]:
    """Login as admin"""
    log("Admin logging in...")
    success, data = await make_request(session, "POST", "/auth/admin-login",
                                        data={"name": ADMIN_NAME, "pin": ADMIN_PIN})
    if success and "access_token" in data:
        log("Admin login successful", "SUCCESS")
        return data["access_token"]
    else:
        log(f"Admin login failed: {data}", "ERROR")
        return None


async def create_dartboards(session: aiohttp.ClientSession, token: str) -> List[str]:
    """Create dartboards"""
    log(f"Creating {NUM_DARTBOARDS} dartboards...")
    dartboard_ids = []

    for i in range(1, NUM_DARTBOARDS + 1):
        success, data = await make_request(session, "POST", "/dartboards", token,
                                           {"number": i, "name": f"Board {i}"})
        if success:
            dartboard_ids.append(data["id"])
            stats["dartboards_created"] += 1
        else:
            # Try to get existing
            success, boards = await make_request(session, "GET", "/dartboards")
            if success:
                for board in boards:
                    if board["number"] == i and board["id"] not in dartboard_ids:
                        dartboard_ids.append(board["id"])
                        break

    log(f"Dartboards ready: {len(dartboard_ids)}", "SUCCESS")
    return dartboard_ids


async def register_player(session: aiohttp.ClientSession, player_num: int) -> Optional[Dict]:
    """Register a single player"""
    name = random_name()
    email = random_email(name)
    phone = random_phone()
    pin = f"{random.randint(1000, 9999)}"

    success, data = await make_request(session, "POST", "/auth/player-register", data={
        "name": name,
        "email": email,
        "phone": phone,
        "pin": pin,
        "marketing_opt_in": random.choice([True, False])
    })

    if success:
        stats["players_registered"] += 1
        return {"id": data["id"], "name": name, "pin": pin, "email": email}
    return None


async def register_all_players(session: aiohttp.ClientSession) -> List[Dict]:
    """Register 100 players concurrently"""
    log(f"Registering {NUM_PLAYERS} players (simulating mobile sign-ups)...")

    # Register in batches of 20 to simulate realistic load
    all_players = []
    batch_size = 20

    for batch_start in range(0, NUM_PLAYERS, batch_size):
        batch_end = min(batch_start + batch_size, NUM_PLAYERS)
        tasks = [register_player(session, i) for i in range(batch_start, batch_end)]
        results = await asyncio.gather(*tasks)

        for player in results:
            if player:
                all_players.append(player)

        log(f"  Registered {len(all_players)}/{NUM_PLAYERS} players...")
        await asyncio.sleep(0.1)  # Small delay between batches

    log(f"Players registered: {len(all_players)}", "SUCCESS")
    return all_players


async def create_event(session: aiohttp.ClientSession, token: str) -> Optional[str]:
    """Create tournament event"""
    log("Creating tournament event...")
    event_data = {
        "name": f"Friday Night Darts - Stress Test",
        "start_date": str(date.today()),
        "end_date": str(date.today()),
        "location": "The Bar - Main Hall",
        "sport_type": "darts"
    }

    success, data = await make_request(session, "POST", "/events", token, event_data)
    if success:
        stats["events_created"] += 1
        log(f"Event created: {data['name']}", "SUCCESS")
        return data["id"]
    return None


async def create_tournaments(session: aiohttp.ClientSession, token: str, event_id: str) -> List[Dict]:
    """Create multiple tournaments"""
    log("Creating tournaments...")

    tournament_configs = [
        {"name": "501 Singles Championship", "game_type": "501", "format": "single_elimination",
         "legs_to_win": 2, "double_out": True},
        {"name": "301 Quick Fire", "game_type": "301", "format": "single_elimination",
         "legs_to_win": 1, "double_out": True},
        {"name": "Cricket Masters", "game_type": "cricket", "format": "single_elimination",
         "legs_to_win": 2, "double_out": False},
        {"name": "Round Robin Warm-Up", "game_type": "501", "format": "round_robin",
         "legs_to_win": 1, "double_out": True},
        {"name": "Lucky Draw Doubles", "game_type": "501", "format": "lucky_draw_doubles",
         "legs_to_win": 2, "double_out": True},
        {"name": "501 Knockout", "game_type": "501", "format": "single_elimination",
         "legs_to_win": 3, "double_out": True},
    ]

    tournaments = []
    for config in tournament_configs:
        tournament_data = {
            "event_id": event_id,
            "name": config["name"],
            "game_type": config["game_type"],
            "format": config["format"],
            "max_players": MAX_PLAYERS_PER_TOURNAMENT,
            "legs_to_win": config["legs_to_win"],
            "sets_to_win": 1,
            "double_in": False,
            "double_out": config["double_out"],
            "master_out": False
        }

        if config["game_type"] in ["501", "301"]:
            tournament_data["starting_score"] = int(config["game_type"])

        success, data = await make_request(session, "POST", "/tournaments", token, tournament_data)
        if success:
            tournaments.append({**data, "config": config})
            stats["tournaments_created"] += 1
            log(f"  Created: {config['name']}")

    # Open registration for all tournaments
    for t in tournaments:
        await make_request(session, "PATCH", f"/tournaments/{t['id']}", token, {"status": "registration"})

    log(f"Tournaments created: {len(tournaments)}", "SUCCESS")
    return tournaments


async def player_login(session: aiohttp.ClientSession, player: Dict) -> Optional[str]:
    """Login as a player"""
    success, data = await make_request(session, "POST", "/auth/pin-login",
                                        data={"name": player["name"], "pin": player["pin"]})
    if success and "access_token" in data:
        return data["access_token"]
    return None


async def players_signup_for_tournaments(session: aiohttp.ClientSession, players: List[Dict],
                                          tournaments: List[Dict]):
    """Have players sign up for tournaments"""
    log("Players signing up for tournaments...")

    signup_count = 0

    for player in players:
        # Each player signs up for 1-3 random tournaments
        num_signups = random.randint(1, 3)
        selected_tournaments = random.sample(tournaments, min(num_signups, len(tournaments)))

        # Login as player
        token = await player_login(session, player)
        if not token:
            continue

        for tournament in selected_tournaments:
            success, data = await make_request(session, "POST",
                                               f"/tournaments/{tournament['id']}/entries",
                                               token, expect_error=True)
            if success:
                signup_count += 1
                stats["tournament_signups"] += 1

        # Small delay to simulate real user behavior
        if random.random() < 0.1:
            await asyncio.sleep(0.05)

    log(f"Tournament sign-ups: {signup_count}", "SUCCESS")


async def admin_process_payments(session: aiohttp.ClientSession, token: str,
                                  tournaments: List[Dict]):
    """Admin marks players as paid and checks them in"""
    log("Admin processing payments and check-ins...")

    for tournament in tournaments:
        success, entries = await make_request(session, "GET",
                                              f"/tournaments/{tournament['id']}/entries", token)
        if not success:
            continue

        for entry in entries:
            # Mark as paid
            await make_request(session, "PATCH",
                              f"/tournaments/{tournament['id']}/entries/{entry['id']}",
                              token, {"paid": True})
            stats["payments_processed"] += 1

            # Check in
            await make_request(session, "POST",
                              f"/tournaments/{tournament['id']}/entries/{entry['id']}/check-in",
                              token)
            stats["check_ins"] += 1

    log(f"Payments processed: {stats['payments_processed']}", "SUCCESS")


async def generate_lucky_draw_teams(session: aiohttp.ClientSession, token: str,
                                     tournaments: List[Dict]):
    """Generate teams for Lucky Draw tournaments"""
    log("Generating Lucky Draw teams...")

    for tournament in tournaments:
        if tournament.get("config", {}).get("format") == "lucky_draw_doubles":
            success, teams = await make_request(session, "POST",
                                                f"/tournaments/{tournament['id']}/lucky-draw", token)
            if success and teams:
                stats["teams_generated"] += len(teams)
                log(f"  Generated {len(teams)} teams for {tournament['name']}")


async def start_tournaments(session: aiohttp.ClientSession, token: str,
                            tournaments: List[Dict]) -> Dict[str, List[str]]:
    """Start all tournaments and get matches"""
    log("Starting tournaments and generating brackets...")

    tournament_matches = {}

    for tournament in tournaments:
        # Skip lucky draw for now (bracket generation not fully implemented)
        if tournament.get("config", {}).get("format") == "lucky_draw_doubles":
            continue

        success, data = await make_request(session, "POST",
                                           f"/tournaments/{tournament['id']}/generate-bracket", token)
        if success:
            stats["tournaments_started"] += 1

            # Get matches
            success, matches = await make_request(session, "GET",
                                                  f"/matches?tournament_id={tournament['id']}")
            if success:
                match_ids = [m["id"] for m in matches]
                tournament_matches[tournament["id"]] = match_ids
                stats["matches_created"] += len(match_ids)
                log(f"  Started: {tournament['name']} - {len(match_ids)} matches")
        else:
            log(f"  Could not start {tournament['name']}: {data.get('detail', 'unknown')}", "WARN")

    log(f"Tournaments started: {stats['tournaments_started']}", "SUCCESS")
    return tournament_matches


async def start_match_and_get_game(session: aiohttp.ClientSession, token: str,
                                    match_id: str) -> tuple[Optional[str], List[str]]:
    """Start a match and get game ID and player IDs"""
    # Get match info first
    success, match_data = await make_request(session, "GET", f"/matches/{match_id}")
    if not success or not match_data.get("players") or len(match_data["players"]) < 2:
        return None, []

    player_ids = [p["player_id"] for p in match_data["players"]]

    # Start match
    success, _ = await make_request(session, "POST", f"/matches/{match_id}/start", token)
    if not success:
        return None, []

    stats["matches_started"] += 1

    # Get games
    success, games = await make_request(session, "GET", f"/matches/{match_id}/games")
    if success and games:
        return games[0]["id"], player_ids

    return None, player_ids


async def simulate_scoring(session: aiohttp.ClientSession, token: str,
                           game_id: str, player_ids: List[str], match_id: str) -> bool:
    """Simulate scoring a game"""
    current_player_idx = 0

    for throw_num in range(MAX_THROWS_PER_GAME):
        player_id = player_ids[current_player_idx % len(player_ids)]

        # Generate random throw
        scores = [random.choice([20, 19, 18, 17, 16, 15, 25]) for _ in range(3)]
        multipliers = [random.choice([1, 1, 2, 3]) for _ in range(3)]

        throw_data = {
            "game_id": game_id,
            "player_id": player_id,
            "throw": {"scores": scores, "multipliers": multipliers}
        }

        success, result = await make_request(session, "POST", "/scoring/submit",
                                             token, throw_data, expect_error=True)
        if success:
            stats["throws_submitted"] += 1
        else:
            stats["throw_errors"] += 1

        current_player_idx += 1

    return True


async def score_match(session: aiohttp.ClientSession, token: str,
                      match_id: str, dartboard_id: str, scorer_id: int) -> bool:
    """Score a complete match"""
    # Assign dartboard
    success, _ = await make_request(session, "POST",
                                    f"/dartboards/matches/{match_id}/assign-board/{dartboard_id}",
                                    token, expect_error=True)
    if not success:
        return False

    stats["board_assignments"] += 1

    # Start match and get game
    game_id, player_ids = await start_match_and_get_game(session, token, match_id)
    if not game_id or len(player_ids) < 2:
        await make_request(session, "POST", f"/dartboards/matches/{match_id}/release-board", token)
        return False

    # Simulate scoring
    await simulate_scoring(session, token, game_id, player_ids, match_id)

    # Complete match with random winner
    winner_id = random.choice(player_ids)
    success, _ = await make_request(session, "PATCH", f"/matches/{match_id}", token, {
        "status": "completed",
        "winner_id": winner_id
    })

    if success:
        stats["matches_completed"] += 1

    # Board should auto-release, but ensure it
    await make_request(session, "POST", f"/dartboards/matches/{match_id}/release-board",
                      token, expect_error=True)

    return success


async def run_concurrent_scoring(session: aiohttp.ClientSession, token: str,
                                  tournament_matches: Dict[str, List[str]],
                                  dartboard_ids: List[str]):
    """Run concurrent scoring sessions across all tournaments"""
    log(f"Starting concurrent scoring with {CONCURRENT_SCORERS} scorers...")

    # Flatten all first-round matches
    all_matches = []
    for tournament_id, match_ids in tournament_matches.items():
        # Get matches to find first round (lowest round number)
        success, matches = await make_request(session, "GET", f"/matches?tournament_id={tournament_id}")
        if success:
            # Get first round matches that have players
            first_round = min(m["round_number"] for m in matches)
            first_round_matches = [m["id"] for m in matches
                                   if m["round_number"] == first_round and m.get("players")]
            all_matches.extend(first_round_matches)

    log(f"  Found {len(all_matches)} first-round matches to score")

    # Score matches in parallel batches
    match_idx = 0
    while match_idx < len(all_matches):
        batch = all_matches[match_idx:match_idx + CONCURRENT_SCORERS]
        tasks = []

        for i, match_id in enumerate(batch):
            board_id = dartboard_ids[i % len(dartboard_ids)]
            tasks.append(score_match(session, token, match_id, board_id, i + 1))

        await asyncio.gather(*tasks)
        match_idx += CONCURRENT_SCORERS

        log(f"  Scored {min(match_idx, len(all_matches))}/{len(all_matches)} matches...")

    log(f"Scoring complete: {stats['matches_completed']} matches", "SUCCESS")


async def test_concurrent_board_locking(session: aiohttp.ClientSession, token: str,
                                         match_ids: List[str], dartboard_ids: List[str]):
    """Test that board locking prevents race conditions"""
    log("Testing concurrent board locking...")

    if len(dartboard_ids) < 1 or len(match_ids) < 5:
        log("Not enough resources for lock test", "WARN")
        return

    board_id = dartboard_ids[0]

    # Release board first
    for mid in match_ids[:5]:
        await make_request(session, "POST", f"/dartboards/matches/{mid}/release-board",
                          token, expect_error=True)

    # Try concurrent assignments
    async def try_assign(match_id):
        success, _ = await make_request(session, "POST",
                                        f"/dartboards/matches/{match_id}/assign-board/{board_id}",
                                        token, expect_error=True)
        return match_id, success

    tasks = [try_assign(mid) for mid in match_ids[:5]]
    results = await asyncio.gather(*tasks)

    successful = [r for r in results if r[1]]

    if len(successful) > 1:
        log(f"RACE CONDITION: {len(successful)} matches got same board!", "ERROR")
        stats["race_conditions"] += 1
        lock_violations.append(f"Race: {len(successful)} matches got board {board_id[:8]}")
    elif len(successful) == 1:
        log("Board locking passed - only 1 winner", "SUCCESS")
        stats["lock_tests_passed"] += 1

    # Cleanup
    for mid, success in results:
        if success:
            await make_request(session, "POST", f"/dartboards/matches/{mid}/release-board", token)


async def hammer_api(session: aiohttp.ClientSession, token: str, duration: int = 10):
    """Hammer the API with concurrent requests"""
    log(f"Hammering API for {duration} seconds...")

    start = time.time()
    request_count = 0

    endpoints = [
        ("GET", "/events"),
        ("GET", "/tournaments"),
        ("GET", "/players?limit=50"),
        ("GET", "/dartboards"),
        ("GET", "/dartboards/available"),
    ]

    async def rapid_request():
        nonlocal request_count
        method, endpoint = random.choice(endpoints)
        await make_request(session, method, endpoint, token)
        request_count += 1

    while time.time() - start < duration:
        tasks = [rapid_request() for _ in range(30)]
        await asyncio.gather(*tasks)
        stats["hammer_requests"] += 30

    elapsed = time.time() - start
    rps = request_count / elapsed
    log(f"API hammer: {request_count} requests in {elapsed:.1f}s ({rps:.0f} req/s)", "SUCCESS")
    stats["hammer_rps"] = rps


async def verify_final_state(session: aiohttp.ClientSession, token: str):
    """Verify system state after test"""
    log("Verifying final state...")

    success, boards = await make_request(session, "GET", "/dartboards", token)
    if success:
        unavailable = [b for b in boards if not b["is_available"]]
        if unavailable:
            log(f"WARNING: {len(unavailable)} boards still in use", "WARN")
        else:
            log("All dartboards available", "SUCCESS")
            stats["final_board_check_passed"] = 1

    success, players = await make_request(session, "GET", "/players?limit=200", token)
    if success:
        log(f"Total players in system: {len(players)}", "SUCCESS")


def print_report():
    """Print final report"""
    print("\n" + "=" * 70)
    print("HARDCORE STRESS TEST REPORT")
    print("=" * 70)

    print("\n📊 STATISTICS:")
    for key, value in sorted(stats.items()):
        print(f"  {key}: {value}")

    if errors:
        print(f"\n❌ ERRORS ({len(errors)}):")
        for error in errors[:20]:
            print(f"  - {error[:100]}")
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more")

    if lock_violations:
        print(f"\n🔒 LOCK VIOLATIONS ({len(lock_violations)}):")
        for v in lock_violations:
            print(f"  - {v}")

    print("\n" + "=" * 70)
    print("📝 SUMMARY:")
    print(f"  Players registered: {stats.get('players_registered', 0)}")
    print(f"  Tournaments created: {stats.get('tournaments_created', 0)}")
    print(f"  Tournament sign-ups: {stats.get('tournament_signups', 0)}")
    print(f"  Matches created: {stats.get('matches_created', 0)}")
    print(f"  Matches completed: {stats.get('matches_completed', 0)}")
    print(f"  Throws submitted: {stats.get('throws_submitted', 0)}")
    print(f"  API throughput: {stats.get('hammer_rps', 0):.0f} req/s")

    violations = stats.get("race_conditions", 0)
    if violations == 0:
        print("\n✅ ALL LOCKING TESTS PASSED - NO RACE CONDITIONS")
    else:
        print(f"\n❌ {violations} RACE CONDITIONS DETECTED")

    print("=" * 70 + "\n")


async def main():
    print("\n" + "=" * 70)
    print("🎯 HARDCORE STRESS TEST - Tournament Night Simulation")
    print("=" * 70)
    print(f"  Players: {NUM_PLAYERS}")
    print(f"  Dartboards: {NUM_DARTBOARDS}")
    print(f"  Max players per tournament: {MAX_PLAYERS_PER_TOURNAMENT}")
    print(f"  Concurrent scorers: {CONCURRENT_SCORERS}")
    print("=" * 70 + "\n")

    connector = aiohttp.TCPConnector(limit=100)
    timeout = aiohttp.ClientTimeout(total=60)

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        # 1. Admin login
        global admin_token
        admin_token = await admin_login(session)
        if not admin_token:
            log("Cannot proceed without admin", "ERROR")
            return

        # 2. Create dartboards
        dartboard_ids = await create_dartboards(session, admin_token)

        # 3. Register players (simulating mobile sign-ups)
        players = await register_all_players(session)

        # 4. Create event
        event_id = await create_event(session, admin_token)
        if not event_id:
            log("Cannot proceed without event", "ERROR")
            return

        # 5. Create tournaments
        tournaments = await create_tournaments(session, admin_token, event_id)

        # 6. Players sign up for tournaments
        await players_signup_for_tournaments(session, players, tournaments)

        # 7. Admin processes payments and check-ins
        await admin_process_payments(session, admin_token, tournaments)

        # 8. Generate Lucky Draw teams
        await generate_lucky_draw_teams(session, admin_token, tournaments)

        # 9. Start tournaments
        tournament_matches = await start_tournaments(session, admin_token, tournaments)

        # 10. Test board locking
        all_match_ids = [m for matches in tournament_matches.values() for m in matches]
        await test_concurrent_board_locking(session, admin_token, all_match_ids, dartboard_ids)

        # 11. Run concurrent scoring
        await run_concurrent_scoring(session, admin_token, tournament_matches, dartboard_ids)

        # 12. Hammer the API
        await hammer_api(session, admin_token, duration=10)

        # 13. Verify final state
        await verify_final_state(session, admin_token)

    print_report()


if __name__ == "__main__":
    asyncio.run(main())
