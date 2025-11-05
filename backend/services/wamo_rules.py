"""
WAMO Dart Game Rules Engine
Implements all WAMO tournament game types:
- 301/501 (with double in/out variants)
- Cricket (standard and cut-throat)
- Round the Clock
- Killer
- Shanghai
- Baseball
"""

from typing import Dict, List, Optional, Tuple, Any
from backend.models.tournament import GameType
from enum import Enum


class DartMultiplier(int, Enum):
    MISS = 0
    SINGLE = 1
    DOUBLE = 2
    TRIPLE = 3


class WAMORules:
    """Base class for WAMO game rules."""

    @staticmethod
    def is_valid_dart_score(value: int, multiplier: Optional[int]) -> bool:
        """Validate a dart score."""
        if multiplier is None or multiplier == DartMultiplier.MISS:
            return value == 0

        if value == 25:  # Bull
            return multiplier in [DartMultiplier.SINGLE, DartMultiplier.DOUBLE]

        if 1 <= value <= 20:
            return multiplier in [DartMultiplier.SINGLE, DartMultiplier.DOUBLE, DartMultiplier.TRIPLE]

        return False

    @staticmethod
    def calculate_dart_points(value: int, multiplier: Optional[int]) -> int:
        """Calculate points for a single dart."""
        if multiplier is None or multiplier == DartMultiplier.MISS:
            return 0
        return value * multiplier


class X01Rules(WAMORules):
    """Rules for 301/501 games."""

    @staticmethod
    def initialize_game(starting_score: int, double_in: bool, double_out: bool) -> Dict[str, Any]:
        """Initialize game state for x01."""
        return {
            "starting_score": starting_score,
            "double_in": double_in,
            "double_out": double_out,
            "players": {},  # player_id -> {score: int, started: bool}
        }

    @staticmethod
    def validate_throw(
        game_data: Dict[str, Any],
        player_id: str,
        scores: List[int],
        multipliers: List[Optional[int]]
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Validate and process a throw for x01 games.
        Returns: (is_valid, message, updated_game_data)
        """
        if len(scores) != len(multipliers):
            return False, "Scores and multipliers must have same length", game_data

        # Initialize player if not exists
        if player_id not in game_data["players"]:
            game_data["players"][player_id] = {
                "score": game_data["starting_score"],
                "started": not game_data["double_in"]
            }

        player_data = game_data["players"][player_id]
        current_score = player_data["score"]
        started = player_data["started"]

        total_scored = 0
        is_bust = False
        finished = False

        for i, (value, mult) in enumerate(zip(scores, multipliers)):
            if not WAMORules.is_valid_dart_score(value, mult):
                return False, f"Invalid dart score: {value} x{mult}", game_data

            points = WAMORules.calculate_dart_points(value, mult)

            # Check for double in
            if not started and game_data["double_in"]:
                if mult == DartMultiplier.DOUBLE:
                    started = True
                    total_scored += points
                # Else continue without scoring
                continue
            elif started:
                total_scored += points

        new_score = current_score - total_scored

        # Check for bust conditions
        if new_score < 0:
            is_bust = True
        elif new_score == 0:
            # Must finish on double
            if game_data["double_out"]:
                last_mult = multipliers[-1]
                if last_mult == DartMultiplier.DOUBLE:
                    finished = True
                else:
                    is_bust = True
            else:
                finished = True
        elif new_score == 1 and game_data["double_out"]:
            # Can't finish (would need double 0.5)
            is_bust = True

        if is_bust:
            # Reset to score before throw
            return True, "Bust!", game_data

        # Update player data
        game_data["players"][player_id] = {
            "score": new_score,
            "started": started
        }

        if finished:
            return True, "Winner!", game_data

        return True, f"Score: {new_score}", game_data

    @staticmethod
    def get_checkout_suggestions(score: int) -> List[str]:
        """Get suggested checkout combinations for a given score."""
        checkouts = {
            170: ["T20", "T20", "Bull"],
            167: ["T20", "T19", "Bull"],
            164: ["T20", "T18", "Bull"],
            161: ["T20", "T17", "Bull"],
            160: ["T20", "T20", "D20"],
            # Add more common checkouts as needed
        }
        return checkouts.get(score, [])


class CricketRules(WAMORules):
    """Rules for Cricket games."""

    CRICKET_NUMBERS = [15, 16, 17, 18, 19, 20, 25]  # 25 is bull

    @staticmethod
    def initialize_game(is_cutthroat: bool = False) -> Dict[str, Any]:
        """Initialize game state for Cricket."""
        return {
            "is_cutthroat": is_cutthroat,
            "players": {},  # player_id -> {marks: {15: 0, 16: 0, ...}, score: 0}
        }

    @staticmethod
    def validate_throw(
        game_data: Dict[str, Any],
        player_id: str,
        scores: List[int],
        multipliers: List[Optional[int]]
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Validate and process a throw for Cricket.
        Returns: (is_valid, message, updated_game_data)
        """
        if len(scores) != len(multipliers):
            return False, "Scores and multipliers must have same length", game_data

        # Initialize player if not exists
        if player_id not in game_data["players"]:
            game_data["players"][player_id] = {
                "marks": {n: 0 for n in CricketRules.CRICKET_NUMBERS},
                "score": 0
            }

        player_data = game_data["players"][player_id]

        for value, mult in zip(scores, multipliers):
            if value not in CricketRules.CRICKET_NUMBERS:
                continue  # Ignore non-cricket numbers

            if mult is None or mult == DartMultiplier.MISS:
                continue

            marks = mult  # 1 for single, 2 for double, 3 for triple
            current_marks = player_data["marks"][value]
            new_marks = min(current_marks + marks, 3)
            extra_marks = max(0, current_marks + marks - 3)

            player_data["marks"][value] = new_marks

            # In standard cricket, score points if you've closed a number
            # In cutthroat, give points to opponents
            if extra_marks > 0 and new_marks == 3:
                points = value * extra_marks

                if game_data["is_cutthroat"]:
                    # Add points to all other players
                    for other_id, other_data in game_data["players"].items():
                        if other_id != player_id and other_data["marks"][value] < 3:
                            other_data["score"] += points
                else:
                    # Add points to this player
                    player_data["score"] += points

        # Check for winner
        all_closed = all(marks == 3 for marks in player_data["marks"].values())

        if all_closed:
            if game_data["is_cutthroat"]:
                # In cutthroat, lowest score wins
                min_score = min(p["score"] for p in game_data["players"].values())
                if player_data["score"] == min_score:
                    return True, "Winner!", game_data
            else:
                # In standard, check if highest score (or tied for highest)
                max_score = max(p["score"] for p in game_data["players"].values())
                if player_data["score"] >= max_score:
                    return True, "Winner!", game_data

        return True, f"Score: {player_data['score']}", game_data


class RoundTheClockRules(WAMORules):
    """Rules for Round the Clock game."""

    @staticmethod
    def initialize_game() -> Dict[str, Any]:
        """Initialize game state for Round the Clock."""
        return {
            "players": {},  # player_id -> {current_target: 1}
        }

    @staticmethod
    def validate_throw(
        game_data: Dict[str, Any],
        player_id: str,
        scores: List[int],
        multipliers: List[Optional[int]]
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Validate and process a throw for Round the Clock.
        Players must hit 1-20 in order, then bull.
        """
        # Initialize player if not exists
        if player_id not in game_data["players"]:
            game_data["players"][player_id] = {"current_target": 1}

        player_data = game_data["players"][player_id]
        current_target = player_data["current_target"]

        for value, mult in zip(scores, multipliers):
            if mult is None or mult == DartMultiplier.MISS:
                continue

            # Check if hit current target
            if current_target <= 20:
                if value == current_target:
                    current_target += 1
            elif current_target == 21:
                # Need to hit bull
                if value == 25:
                    return True, "Winner!", game_data

        player_data["current_target"] = current_target
        return True, f"Next target: {current_target if current_target <= 20 else 'Bull'}", game_data


class KillerRules(WAMORules):
    """Rules for Killer game."""

    @staticmethod
    def initialize_game(players: List[str]) -> Dict[str, Any]:
        """Initialize game state for Killer."""
        return {
            "players": {
                player_id: {
                    "number": None,  # Assigned number (1-20)
                    "is_killer": False,
                    "lives": 3
                }
                for player_id in players
            },
            "phase": "selection"  # selection or battle
        }

    @staticmethod
    def validate_throw(
        game_data: Dict[str, Any],
        player_id: str,
        scores: List[int],
        multipliers: List[Optional[int]]
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Validate and process a throw for Killer.
        """
        player_data = game_data["players"][player_id]

        if game_data["phase"] == "selection":
            # Player is selecting their number
            for value, mult in zip(scores, multipliers):
                if mult is None or mult == DartMultiplier.MISS:
                    continue

                if 1 <= value <= 20:
                    # Check if number already taken
                    taken = any(p["number"] == value for p in game_data["players"].values())
                    if not taken:
                        player_data["number"] = value

                        # Check if all players have numbers
                        all_selected = all(p["number"] is not None for p in game_data["players"].values())
                        if all_selected:
                            game_data["phase"] = "battle"

                        return True, f"Number {value} selected", game_data

            return True, "Select your number (1-20)", game_data

        else:  # battle phase
            player_number = player_data["number"]

            for value, mult in zip(scores, multipliers):
                if mult != DartMultiplier.DOUBLE:
                    continue

                # Hit own number = become killer
                if value == player_number:
                    player_data["is_killer"] = True
                    return True, "You are now a Killer!", game_data

                # If killer, hitting other numbers removes lives
                if player_data["is_killer"]:
                    for other_id, other_data in game_data["players"].items():
                        if other_id != player_id and other_data["number"] == value:
                            other_data["lives"] -= 1
                            if other_data["lives"] <= 0:
                                return True, f"Player eliminated! {other_data['lives']} left", game_data
                            return True, f"Hit! {other_data['lives']} lives remaining", game_data

            alive_players = sum(1 for p in game_data["players"].values() if p["lives"] > 0)
            if alive_players == 1:
                return True, "Winner!", game_data

            return True, "Continue", game_data


class ShanghaiRules(WAMORules):
    """Rules for Shanghai game."""

    @staticmethod
    def initialize_game() -> Dict[str, Any]:
        """Initialize game state for Shanghai."""
        return {
            "current_round": 1,  # Rounds 1-20
            "players": {}  # player_id -> {score: 0, shanghai: False}
        }

    @staticmethod
    def validate_throw(
        game_data: Dict[str, Any],
        player_id: str,
        scores: List[int],
        multipliers: List[Optional[int]]
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Validate and process a throw for Shanghai.
        Each round targets numbers 1-20. Shanghai = hitting single, double, triple in same round.
        """
        # Initialize player if not exists
        if player_id not in game_data["players"]:
            game_data["players"][player_id] = {"score": 0, "shanghai": False}

        player_data = game_data["players"][player_id]
        current_target = game_data["current_round"]

        round_score = 0
        hit_types = set()

        for value, mult in zip(scores, multipliers):
            if value == current_target and mult and mult != DartMultiplier.MISS:
                points = WAMORules.calculate_dart_points(value, mult)
                round_score += points
                hit_types.add(mult)

        # Check for Shanghai (single, double, triple all hit in one round)
        if hit_types == {DartMultiplier.SINGLE, DartMultiplier.DOUBLE, DartMultiplier.TRIPLE}:
            player_data["shanghai"] = True
            return True, "SHANGHAI! Instant Win!", game_data

        player_data["score"] += round_score
        return True, f"Round score: {round_score}, Total: {player_data['score']}", game_data


class BaseballRules(WAMORules):
    """Rules for Baseball game."""

    @staticmethod
    def initialize_game() -> Dict[str, Any]:
        """Initialize game state for Baseball."""
        return {
            "inning": 1,  # Innings 1-9
            "players": {}  # player_id -> {score: 0, innings: {1: 0, 2: 0, ...}}
        }

    @staticmethod
    def validate_throw(
        game_data: Dict[str, Any],
        player_id: str,
        scores: List[int],
        multipliers: List[Optional[int]]
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Validate and process a throw for Baseball.
        9 innings, targeting numbers 1-9. Only hits on target number score.
        """
        # Initialize player if not exists
        if player_id not in game_data["players"]:
            game_data["players"][player_id] = {
                "score": 0,
                "innings": {i: 0 for i in range(1, 10)}
            }

        player_data = game_data["players"][player_id]
        current_inning = game_data["inning"]

        inning_score = 0

        for value, mult in zip(scores, multipliers):
            if value == current_inning and mult and mult != DartMultiplier.MISS:
                points = WAMORules.calculate_dart_points(value, mult)
                inning_score += points

        player_data["innings"][current_inning] = inning_score
        player_data["score"] += inning_score

        return True, f"Inning {current_inning} score: {inning_score}, Total: {player_data['score']}", game_data


class WAMOGameEngine:
    """Main game engine for WAMO tournaments."""

    @staticmethod
    def create_game(game_type: GameType, **kwargs) -> Dict[str, Any]:
        """Create initial game state based on game type."""
        if game_type in [GameType.THREE_ZERO_ONE, GameType.FIVE_ZERO_ONE]:
            starting_score = 301 if game_type == GameType.THREE_ZERO_ONE else 501
            return X01Rules.initialize_game(
                starting_score=kwargs.get("starting_score", starting_score),
                double_in=kwargs.get("double_in", False),
                double_out=kwargs.get("double_out", True)
            )
        elif game_type == GameType.CRICKET:
            return CricketRules.initialize_game(is_cutthroat=False)
        elif game_type == GameType.CRICKET_CUTTHROAT:
            return CricketRules.initialize_game(is_cutthroat=True)
        elif game_type == GameType.ROUND_THE_CLOCK:
            return RoundTheClockRules.initialize_game()
        elif game_type == GameType.KILLER:
            return KillerRules.initialize_game(kwargs.get("players", []))
        elif game_type == GameType.SHANGHAI:
            return ShanghaiRules.initialize_game()
        elif game_type == GameType.BASEBALL:
            return BaseballRules.initialize_game()
        else:
            raise ValueError(f"Unknown game type: {game_type}")

    @staticmethod
    def process_throw(
        game_type: GameType,
        game_data: Dict[str, Any],
        player_id: str,
        scores: List[int],
        multipliers: List[Optional[int]]
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """Process a throw for any game type."""
        if game_type in [GameType.THREE_ZERO_ONE, GameType.FIVE_ZERO_ONE]:
            return X01Rules.validate_throw(game_data, player_id, scores, multipliers)
        elif game_type in [GameType.CRICKET, GameType.CRICKET_CUTTHROAT]:
            return CricketRules.validate_throw(game_data, player_id, scores, multipliers)
        elif game_type == GameType.ROUND_THE_CLOCK:
            return RoundTheClockRules.validate_throw(game_data, player_id, scores, multipliers)
        elif game_type == GameType.KILLER:
            return KillerRules.validate_throw(game_data, player_id, scores, multipliers)
        elif game_type == GameType.SHANGHAI:
            return ShanghaiRules.validate_throw(game_data, player_id, scores, multipliers)
        elif game_type == GameType.BASEBALL:
            return BaseballRules.validate_throw(game_data, player_id, scores, multipliers)
        else:
            raise ValueError(f"Unknown game type: {game_type}")
