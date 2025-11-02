// Game Type Constants
export const GAME_TYPES = {
  BINGO_CRASH: 'bingo_crash',
  SCRAMBLINGO: 'scramblingo'
} as const;

export type GameType = typeof GAME_TYPES[keyof typeof GAME_TYPES];

// Game Names
export const GAME_NAMES = {
  [GAME_TYPES.BINGO_CRASH]: 'Bingo Crash',
  [GAME_TYPES.SCRAMBLINGO]: 'Scramblingo'
} as const;

// Game Descriptions
export const GAME_DESCRIPTIONS = {
  [GAME_TYPES.BINGO_CRASH]: 'Original bingo game with crash mechanics',
  [GAME_TYPES.SCRAMBLINGO]: 'New bingo game with scrambling mechanics'
} as const;

// Default Game Configurations
export const DEFAULT_GAME_CONFIGS = {
  [GAME_TYPES.BINGO_CRASH]: {
    ball_count: 75,
    card_size: 25,
    max_cards_per_player: 4,
    card_dimensions: { rows: 5, cols: 5 }
  },
  [GAME_TYPES.SCRAMBLINGO]: {
    ball_count: 90,
    card_size: 25,
    max_cards_per_player: 6,
    card_dimensions: { rows: 5, cols: 5 }
  }
} as const;

// API Routes
export const API_ROUTES = {
  GAME_STATUS: '/api/game/status',
  ROUND_START: '/api/round/start',
  ROUND_END: '/api/round/end',
  SCHEDULER_CONTROL: '/api/scheduler/control',
  SCHEDULER_STATUS: '/api/scheduler/status'
} as const;

// Database Table Names (with game type support)
export const getTableNames = (gameType: GameType) => ({
  rounds: gameType === GAME_TYPES.BINGO_CRASH ? 'rounds' : `${gameType}_rounds`,
  cards: gameType === GAME_TYPES.BINGO_CRASH ? 'cards' : `${gameType}_cards`,
  players: gameType === GAME_TYPES.BINGO_CRASH ? 'players' : `${gameType}_players`,
  tickets: gameType === GAME_TYPES.BINGO_CRASH ? 'tickets' : `${gameType}_tickets`,
  round_scores: gameType === GAME_TYPES.BINGO_CRASH ? 'round_scores' : `${gameType}_round_scores`,
  round_players: gameType === GAME_TYPES.BINGO_CRASH ? 'round_players' : `${gameType}_round_players`
});

// Scheduler Configuration Keys
export const SCHEDULER_KEYS = {
  CURRENT_GAME: 'current_game',
  GAME_ROTATION: 'game_rotation',
  ROTATION_INTERVAL: 'rotation_interval'
} as const;

// Validation Schemas
export const GAME_TYPE_VALIDATION = {
  type: 'string',
  enum: Object.values(GAME_TYPES),
  required: true
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  INVALID_GAME_TYPE: 'Invalid game type provided',
  GAME_NOT_FOUND: 'Game type not found',
  UNSUPPORTED_GAME: 'Game type not supported',
  RNG_ERROR: 'Random number generation failed',
  CONFIG_ERROR: 'Game configuration error'
} as const;

