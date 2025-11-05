export enum GameStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}

export interface Game {
  id: string;
  match_id: string;
  set_number: number;
  leg_number: number;
  status: GameStatus;
  current_player_id?: string;
  winner_id?: string;
  game_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Throw {
  id: string;
  game_id: string;
  player_id: string;
  turn_number: number;
  scores: number[];
  multipliers?: (number | null)[];
  total: number;
  remaining?: number;
  is_bust: boolean;
  created_at: string;
}

export interface ThrowCreate {
  scores: number[];
  multipliers?: (number | null)[];
}

export interface ScoreSubmission {
  game_id: string;
  player_id: string;
  throw: ThrowCreate;
}
