"""
Tournament bracket generation and management.
"""

from typing import List, Dict, Tuple, Optional
from math import log2, ceil
from uuid import UUID
import random


class BracketService:
    """Service for generating and managing tournament brackets."""

    @staticmethod
    def generate_single_elimination(
        player_ids: List[UUID],
        seeds: Optional[Dict[UUID, int]] = None
    ) -> List[Dict]:
        """
        Generate single elimination bracket.
        Returns list of match configurations for all rounds.
        """
        num_players = len(player_ids)
        if num_players < 2:
            return []

        # Sort players by seed if provided
        if seeds:
            sorted_players = sorted(player_ids, key=lambda p: seeds.get(p, 999))
        else:
            sorted_players = list(player_ids)

        # Calculate number of rounds needed
        num_rounds = ceil(log2(num_players))
        bracket_size = 2 ** num_rounds

        # Add byes if needed - place byes at the end to give top seeds easy first round
        num_byes = bracket_size - num_players
        players_with_byes = sorted_players + [None] * num_byes

        matches = []
        match_counter = 1

        # Generate all rounds
        current_round_slots = players_with_byes

        for round_num in range(1, num_rounds + 1):
            next_round_slots = []
            matches_in_round = len(current_round_slots) // 2

            for match_idx in range(matches_in_round):
                player1 = current_round_slots[match_idx * 2]
                player2 = current_round_slots[match_idx * 2 + 1]

                # Both byes - skip (shouldn't happen with proper seeding)
                if player1 is None and player2 is None:
                    next_round_slots.append(None)
                    continue

                # One bye - player auto-advances
                if player1 is None:
                    next_round_slots.append(player2)
                    continue
                if player2 is None:
                    next_round_slots.append(player1)
                    continue

                # Both real players - create match
                # Determine round name
                if round_num == num_rounds:
                    round_name = "Final"
                elif round_num == num_rounds - 1 and num_rounds > 1:
                    round_name = "Semi-Final"
                elif round_num == num_rounds - 2 and num_rounds > 2:
                    round_name = "Quarter-Final"
                else:
                    round_name = f"Round {round_num}"

                matches.append({
                    "round": round_num,
                    "match_number": match_counter,
                    "player1_id": player1,
                    "player2_id": player2,
                    "bracket_position": f"R{round_num}M{match_idx + 1}",
                    "round_name": round_name
                })
                match_counter += 1

                # Placeholder for winner - will be filled when match completes
                next_round_slots.append(None)

            current_round_slots = next_round_slots

        return matches

    @staticmethod
    def generate_double_elimination(
        player_ids: List[UUID],
        seeds: Optional[Dict[UUID, int]] = None
    ) -> List[Dict]:
        """
        Generate double elimination bracket.
        Returns list of match configurations with winners/losers brackets.
        """
        num_players = len(player_ids)

        # Sort players by seed if provided
        if seeds:
            sorted_players = sorted(player_ids, key=lambda p: seeds.get(p, 999))
        else:
            sorted_players = list(player_ids)

        # Calculate bracket size
        num_rounds = ceil(log2(num_players))
        bracket_size = 2 ** num_rounds

        # Add byes if needed
        num_byes = bracket_size - num_players
        players_with_byes = sorted_players + [None] * num_byes

        matches = []

        # Winners bracket - round 1
        round_num = 1
        for i in range(0, len(players_with_byes), 2):
            player1 = players_with_byes[i]
            player2 = players_with_byes[i + 1]

            if player1 is None and player2 is None:
                continue

            if player1 is None or player2 is None:
                continue

            matches.append({
                "round": round_num,
                "match_number": len(matches) + 1,
                "player1_id": player1,
                "player2_id": player2,
                "bracket_position": f"W{round_num}M{i // 2 + 1}"
            })

        # Losers bracket will be generated dynamically as matches complete
        # Initial losers bracket matches can't be created until winners bracket round 1 completes

        return matches

    @staticmethod
    def generate_round_robin(player_ids: List[UUID]) -> List[Dict]:
        """
        Generate round robin bracket.
        Every player plays every other player once.
        """
        matches = []
        num_players = len(player_ids)

        # If odd number of players, add a "bye" player
        players = list(player_ids)
        if num_players % 2 == 1:
            players.append(None)  # Bye

        num_rounds = len(players) - 1
        matches_per_round = len(players) // 2

        # Round robin algorithm (circle method)
        for round_num in range(1, num_rounds + 1):
            for match_idx in range(matches_per_round):
                player1_idx = match_idx
                player2_idx = len(players) - 1 - match_idx

                player1 = players[player1_idx]
                player2 = players[player2_idx]

                # Skip bye matches
                if player1 is None or player2 is None:
                    continue

                matches.append({
                    "round": round_num,
                    "match_number": len(matches) + 1,
                    "player1_id": player1,
                    "player2_id": player2,
                    "bracket_position": f"RR{round_num}M{match_idx + 1}"
                })

            # Rotate players (keep first player fixed)
            players = [players[0]] + [players[-1]] + players[1:-1]

        return matches

    @staticmethod
    def get_next_match(
        bracket_type: str,
        completed_match: Dict,
        all_matches: List[Dict]
    ) -> Optional[Dict]:
        """
        Determine next match for winner/loser after a match completes.
        """
        if bracket_type == "single_elimination":
            # Winner advances to next round
            current_round = completed_match["round"]
            current_position = completed_match.get("bracket_position", "")

            # Find next round match
            next_round_matches = [m for m in all_matches if m["round"] == current_round + 1]

            # TODO: More sophisticated logic for positioning
            return next_round_matches[0] if next_round_matches else None

        elif bracket_type == "double_elimination":
            # Winner goes to next winners bracket match
            # Loser goes to losers bracket
            # Complex logic - would need full implementation
            pass

        return None

    @staticmethod
    def calculate_standings(
        player_ids: List[UUID],
        match_results: List[Dict]
    ) -> List[Dict]:
        """
        Calculate tournament standings based on match results.
        Used primarily for round robin.
        """
        standings = {player_id: {"wins": 0, "losses": 0, "points": 0} for player_id in player_ids}

        for match in match_results:
            if match.get("winner_id"):
                winner = match["winner_id"]
                loser = match["player1_id"] if match["player2_id"] == winner else match["player2_id"]

                standings[winner]["wins"] += 1
                standings[winner]["points"] += 3  # 3 points for win

                standings[loser]["losses"] += 1

        # Sort by points, then wins
        sorted_standings = sorted(
            [{"player_id": pid, **stats} for pid, stats in standings.items()],
            key=lambda x: (x["points"], x["wins"]),
            reverse=True
        )

        return sorted_standings

    @staticmethod
    def seed_players(
        player_ids: List[UUID],
        skill_levels: Dict[UUID, int]
    ) -> Dict[UUID, int]:
        """
        Generate tournament seeding based on skill levels.
        Returns dict of player_id -> seed number.
        """
        # Sort by skill level (descending), then randomize within same skill
        grouped_by_skill: Dict[int, List[UUID]] = {}

        for player_id in player_ids:
            skill = skill_levels.get(player_id, 0)
            if skill not in grouped_by_skill:
                grouped_by_skill[skill] = []
            grouped_by_skill[skill].append(player_id)

        # Shuffle within each skill level
        for skill in grouped_by_skill:
            random.shuffle(grouped_by_skill[skill])

        # Assign seeds
        seeds = {}
        seed_num = 1

        for skill in sorted(grouped_by_skill.keys(), reverse=True):
            for player_id in grouped_by_skill[skill]:
                seeds[player_id] = seed_num
                seed_num += 1

        return seeds
