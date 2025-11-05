export enum WebSocketEventType {
  MATCH_STARTED = "match:started",
  MATCH_UPDATED = "match:updated",
  MATCH_COMPLETED = "match:completed",
  GAME_STARTED = "game:started",
  GAME_UPDATED = "game:updated",
  GAME_COMPLETED = "game:completed",
  SCORE_SUBMITTED = "score:submitted",
  SCORE_VALIDATED = "score:validated",
  TOURNAMENT_STARTED = "tournament:started",
  TOURNAMENT_UPDATED = "tournament:updated",
  TOURNAMENT_COMPLETED = "tournament:completed",
  PLAYER_JOINED = "player:joined",
  PLAYER_LEFT = "player:left",
  CONNECTION_ACK = "connection:ack",
  SUBSCRIPTION_ACK = "subscription:ack",
  ERROR = "error",
}

export interface WebSocketMessage<T = any> {
  type: WebSocketEventType | string;
  data?: T;
  timestamp?: string;
  error?: string;
  code?: string;
}

export interface WebSocketSubscribeMessage {
  action: "subscribe" | "unsubscribe" | "ping";
  topic?: string;
  data?: any;
  timestamp?: number;
}
