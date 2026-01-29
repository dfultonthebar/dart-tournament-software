export enum EventStatus {
  DRAFT = "draft",
  REGISTRATION = "registration",
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum SportType {
  DARTS = "darts",
  VOLLEYBALL = "volleyball",
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  location?: string;
  start_date: string;
  end_date: string;
  status: EventStatus;
  sport_type: SportType;
  max_participants?: number;
  created_at: string;
  updated_at: string;
}

export interface EventCreate {
  name: string;
  description?: string;
  location?: string;
  start_date: string;
  end_date: string;
  sport_type?: SportType;
  max_participants?: number;
}

export interface EventUpdate {
  name?: string;
  description?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  status?: EventStatus;
  sport_type?: SportType;
  max_participants?: number;
}

export interface EventEntry {
  id: string;
  event_id: string;
  player_id: string;
  checked_in?: string;
  paid: boolean;
  notes?: string;
  created_at: string;
}

export interface EventEntryUpdate {
  paid?: boolean;
  notes?: string;
}
