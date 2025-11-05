"""
Scoring validation and calculation services.
"""

from typing import List, Optional, Tuple, Dict, Any
from backend.services.wamo_rules import WAMOGameEngine, X01Rules
from backend.models.tournament import GameType


class ScoringService:
    """Service for validating and calculating scores."""

    @staticmethod
    def validate_throw(
        game_type: GameType,
        game_data: Dict[str, Any],
        player_id: str,
        scores: List[int],
        multipliers: List[Optional[int]]
    ) -> Tuple[bool, str, Dict[str, Any], bool]:
        """
        Validate a throw and return updated game data.
        Returns: (is_valid, message, updated_game_data, is_winner)
        """
        is_valid, message, updated_data = WAMOGameEngine.process_throw(
            game_type, game_data, player_id, scores, multipliers
        )

        is_winner = "Winner" in message or "SHANGHAI" in message

        return is_valid, message, updated_data, is_winner

    @staticmethod
    def calculate_throw_total(scores: List[int], multipliers: List[Optional[int]]) -> int:
        """Calculate total points from a throw."""
        total = 0
        for score, mult in zip(scores, multipliers):
            if mult is not None and mult > 0:
                total += score * mult
        return total

    @staticmethod
    def get_checkout_hints(game_type: GameType, remaining_score: int) -> List[str]:
        """Get checkout suggestions for x01 games."""
        if game_type in [GameType.THREE_ZERO_ONE, GameType.FIVE_ZERO_ONE]:
            return X01Rules.get_checkout_suggestions(remaining_score)
        return []

    @staticmethod
    def calculate_player_average(throws: List[Dict[str, Any]], game_type: GameType) -> float:
        """Calculate player's average score per dart."""
        if not throws:
            return 0.0

        if game_type in [GameType.THREE_ZERO_ONE, GameType.FIVE_ZERO_ONE]:
            total_score = sum(t.get("total", 0) for t in throws if not t.get("is_bust", False))
            total_darts = sum(len(t.get("scores", [])) for t in throws)

            if total_darts == 0:
                return 0.0

            return round(total_score / total_darts, 2)

        return 0.0

    @staticmethod
    def calculate_player_stats(throws: List[Dict[str, Any]], game_type: GameType) -> Dict[str, Any]:
        """Calculate comprehensive player statistics."""
        if not throws:
            return {
                "average": 0.0,
                "total_darts": 0,
                "highest_score": 0,
                "doubles_hit": 0,
                "triples_hit": 0,
                "total_score": 0
            }

        total_darts = 0
        total_score = 0
        highest_score = 0
        doubles_hit = 0
        triples_hit = 0

        for throw in throws:
            scores = throw.get("scores", [])
            multipliers = throw.get("multipliers", [])

            total_darts += len(scores)

            if not throw.get("is_bust", False):
                throw_total = throw.get("total", 0)
                total_score += throw_total
                highest_score = max(highest_score, throw_total)

            for mult in multipliers:
                if mult == 2:
                    doubles_hit += 1
                elif mult == 3:
                    triples_hit += 1

        average = round(total_score / total_darts, 2) if total_darts > 0 else 0.0

        return {
            "average": average,
            "total_darts": total_darts,
            "highest_score": highest_score,
            "doubles_hit": doubles_hit,
            "triples_hit": triples_hit,
            "total_score": total_score
        }

    @staticmethod
    def is_valid_finish(remaining: int, last_dart_value: int, last_dart_mult: Optional[int], double_out: bool) -> bool:
        """Check if a finish is valid for x01 games."""
        if remaining != last_dart_value * (last_dart_mult or 0):
            return False

        if double_out:
            return last_dart_mult == 2

        return True
