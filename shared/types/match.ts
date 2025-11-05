export enum MatchStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export interface MatchPlayerInfo {
  player_id: string;
  position: number;
  sets_won: number;
  legs_won: number;
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
  created_at: string;
  updated_at: string;
}

export interface MatchWithPlayers extends Match {
  players: MatchPlayerInfo[];
}
