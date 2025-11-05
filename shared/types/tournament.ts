export enum TournamentFormat {
  SINGLE_ELIMINATION = "single_elimination",
  DOUBLE_ELIMINATION = "double_elimination",
  ROUND_ROBIN = "round_robin",
}

export enum TournamentStatus {
  DRAFT = "draft",
  REGISTRATION = "registration",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum GameType {
  THREE_ZERO_ONE = "301",
  FIVE_ZERO_ONE = "501",
  CRICKET = "cricket",
  CRICKET_CUTTHROAT = "cricket_cutthroat",
  ROUND_THE_CLOCK = "round_the_clock",
  KILLER = "killer",
  SHANGHAI = "shanghai",
  BASEBALL = "baseball",
}

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  game_type: GameType;
  format: TournamentFormat;
  status: TournamentStatus;
  max_players?: number;
  start_time?: string;
  end_time?: string;
  starting_score?: number;
  legs_to_win: number;
  sets_to_win: number;
  double_in: boolean;
  double_out: boolean;
  created_at: string;
  updated_at: string;
}

export interface TournamentCreate {
  name: string;
  description?: string;
  game_type: GameType;
  format: TournamentFormat;
  max_players?: number;
  start_time?: string;
  starting_score?: number;
  legs_to_win?: number;
  sets_to_win?: number;
  double_in?: boolean;
  double_out?: boolean;
}

export interface TournamentEntry {
  id: string;
  tournament_id: string;
  player_id: string;
  seed?: number;
  checked_in?: string;
  created_at: string;
}
