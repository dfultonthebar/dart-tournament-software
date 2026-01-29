export interface Player {
  id: string;
  name: string;
  email: string;
  phone?: string;
  skill_level: number;
  is_active: boolean;
  qr_code?: string;
  gender?: 'M' | 'F';
  created_at: string;
  updated_at: string;
}

export interface PlayerCreate {
  name: string;
  email: string;
  password: string;
  phone?: string;
  skill_level?: number;
  gender?: 'M' | 'F';
}

export interface PlayerUpdate {
  name?: string;
  email?: string;
  phone?: string;
  skill_level?: number;
  is_active?: boolean;
  gender?: 'M' | 'F';
}

export interface PlayerLogin {
  email: string;
  password: string;
}

export interface PlayerStats {
  average: number;
  total_darts: number;
  highest_score: number;
  doubles_hit: number;
  triples_hit: number;
  total_score: number;
}
