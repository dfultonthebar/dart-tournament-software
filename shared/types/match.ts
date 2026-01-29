export enum MatchStatus {
  PENDING = "pending",
  WAITING_FOR_PLAYERS = "waiting_for_players",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  DISPUTED = "disputed",
  CANCELLED = "cancelled",
}

export interface MatchPlayerInfo {
  player_id: string;
  position: number;
  sets_won: number;
  legs_won: number;
  team_id?: string;
  team_position?: number;
  arrived_at_board?: string | null;
  reported_win?: boolean | null;
}

export interface Match {
  id: string;
  tournament_id: string;
  round_number: number;
  match_number: number;
  bracket_position?: string;
  status: MatchStatus;
  started_at?: string;
  completed_at?: string;
  winner_id?: string;
  winner_team_id?: string;
  dartboard_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchWithPlayers extends Match {
  players: MatchPlayerInfo[];
}
