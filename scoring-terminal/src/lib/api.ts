import axios, { AxiosInstance } from 'axios';
import { API_BASE_URL } from '@shared/constants';
import {
  Player,
  Tournament,
  Match,
  MatchWithPlayers,
  Game,
  Throw,
  ScoreSubmission,
  LoginRequest,
  Token,
} from '@shared/types';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for auth
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Load token from localStorage if available
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        this.token = storedToken;
      }
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  // Auth
  async login(credentials: LoginRequest): Promise<Token> {
    const response = await this.client.post<Token>('/auth/login', credentials);
    this.setToken(response.data.access_token);
    return response.data;
  }

  async getCurrentPlayer(): Promise<Player> {
    const response = await this.client.get<Player>('/auth/me');
    return response.data;
  }

  // Players
  async getPlayers(): Promise<Player[]> {
    const response = await this.client.get<Player[]>('/players');
    return response.data;
  }

  async getPlayer(id: string): Promise<Player> {
    const response = await this.client.get<Player>(`/players/${id}`);
    return response.data;
  }

  // Tournaments
  async getTournaments(): Promise<Tournament[]> {
    const response = await this.client.get<Tournament[]>('/tournaments');
    return response.data;
  }

  async getTournament(id: string): Promise<Tournament> {
    const response = await this.client.get<Tournament>(`/tournaments/${id}`);
    return response.data;
  }

  // Matches
  async getMatches(tournamentId?: string): Promise<MatchWithPlayers[]> {
    const params = tournamentId ? { tournament_id: tournamentId } : {};
    const response = await this.client.get<MatchWithPlayers[]>('/matches', { params });
    return response.data;
  }

  async getMatch(id: string): Promise<MatchWithPlayers> {
    const response = await this.client.get<MatchWithPlayers>(`/matches/${id}`);
    return response.data;
  }

  async startMatch(id: string): Promise<Match> {
    const response = await this.client.post<Match>(`/matches/${id}/start`);
    return response.data;
  }

  async getMatchGames(matchId: string): Promise<Game[]> {
    const response = await this.client.get<Game[]>(`/matches/${matchId}/games`);
    return response.data;
  }

  // Scoring
  async submitScore(submission: ScoreSubmission): Promise<Throw> {
    const response = await this.client.post<Throw>('/scoring/submit', submission);
    return response.data;
  }

  async getGameThrows(gameId: string): Promise<Throw[]> {
    const response = await this.client.get<Throw[]>(`/scoring/game/${gameId}/throws`);
    return response.data;
  }

  async getGameState(gameId: string): Promise<Game> {
    const response = await this.client.get<Game>(`/scoring/game/${gameId}`);
    return response.data;
  }

  async getPlayerStats(playerId: string, gameId?: string): Promise<any> {
    const params = gameId ? { game_id: gameId } : {};
    const response = await this.client.get(`/scoring/player/${playerId}/stats`, { params });
    return response.data;
  }
}

export const api = new ApiClient();
