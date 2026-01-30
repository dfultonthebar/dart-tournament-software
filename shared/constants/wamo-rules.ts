import { GameType } from '../types';

export const GAME_TYPE_NAMES: Record<GameType, string> = {
  [GameType.THREE_ZERO_ONE]: "301",
  [GameType.FIVE_ZERO_ONE]: "501",
  [GameType.CRICKET]: "Cricket",
  [GameType.CRICKET_CUTTHROAT]: "Cricket Cut-throat",
  [GameType.ROUND_THE_CLOCK]: "Round the Clock",
  [GameType.KILLER]: "Killer",
  [GameType.SHANGHAI]: "Shanghai",
  [GameType.BASEBALL]: "Baseball",
};

export const CRICKET_NUMBERS = [15, 16, 17, 18, 19, 20, 25];

export const DARTBOARD_NUMBERS = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5
];

export enum DartMultiplier {
  MISS = 0,
  SINGLE = 1,
  DOUBLE = 2,
  TRIPLE = 3,
}

export const MULTIPLIER_LABELS: Record<DartMultiplier, string> = {
  [DartMultiplier.MISS]: "Miss",
  [DartMultiplier.SINGLE]: "Single",
  [DartMultiplier.DOUBLE]: "Double",
  [DartMultiplier.TRIPLE]: "Triple",
};

export const TOUCH_TARGET_SIZE = 44; // Minimum touch target size in pixels
