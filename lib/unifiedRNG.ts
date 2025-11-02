import { supabaseAdmin } from './supabaseAdmin';
import { tableNames } from './config';

export interface GameConfig {
  game_type: string;
  name: string;
  description: string;
  ball_count: number;
  card_size: number;
  max_cards_per_player: number;
  is_active: boolean;
}

export interface RNGResult {
  numbers: number[];
  game_type: string;
  timestamp: string;
  seed?: string;
}

export class UnifiedRNG {
  private static instance: UnifiedRNG;
  private gameConfigs: Map<string, GameConfig> = new Map();

  private constructor() {}

  public static getInstance(): UnifiedRNG {
    if (!UnifiedRNG.instance) {
      UnifiedRNG.instance = new UnifiedRNG();
    }
    return UnifiedRNG.instance;
  }

  /**
   * Initialize game configurations from database
   */
  public async initialize(): Promise<void> {
    try {
      const { data: configs, error } = await supabaseAdmin
        .from('game_configs')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Error loading game configs:', error);
        return;
      }

      this.gameConfigs.clear();
      configs?.forEach(config => {
        this.gameConfigs.set(config.game_type, config);
      });

      console.log(`🎮 Loaded ${this.gameConfigs.size} game configurations`);
    } catch (error) {
      console.error('Error initializing UnifiedRNG:', error);
    }
  }

  /**
   * Generate random numbers for a specific game type
   */
  public generateNumbers(gameType: string, count?: number): RNGResult {
    const config = this.gameConfigs.get(gameType);
    if (!config) {
      throw new Error(`Game type '${gameType}' not found`);
    }

    const ballCount = count || config.ball_count;
    const numbers = this.generateRandomNumbers(ballCount);
    
    return {
      numbers,
      game_type: gameType,
      timestamp: new Date().toISOString(),
      seed: this.generateSeed()
    };
  }

  /**
   * Generate a full bingo card for a specific game type
   */
  public generateCard(gameType: string): number[][] {
    const config = this.gameConfigs.get(gameType);
    if (!config) {
      throw new Error(`Game type '${gameType}' not found`);
    }

    const cardSize = Math.sqrt(config.card_size);
    const card: number[][] = [];
    const usedNumbers = new Set<number>();

    for (let row = 0; row < cardSize; row++) {
      const cardRow: number[] = [];
      for (let col = 0; col < cardSize; col++) {
        let number: number;
        do {
          number = Math.floor(Math.random() * config.ball_count) + 1;
        } while (usedNumbers.has(number));
        
        usedNumbers.add(number);
        cardRow.push(number);
      }
      card.push(cardRow);
    }

    return card;
  }

  /**
   * Get game configuration
   */
  public getGameConfig(gameType: string): GameConfig | undefined {
    return this.gameConfigs.get(gameType);
  }

  /**
   * Get all available game types
   */
  public getAvailableGames(): string[] {
    return Array.from(this.gameConfigs.keys());
  }

  /**
   * Check if game type is supported
   */
  public isGameSupported(gameType: string): boolean {
    return this.gameConfigs.has(gameType);
  }

  /**
   * Generate random numbers using crypto-secure random
   */
  private generateRandomNumbers(count: number): number[] {
    const numbers: number[] = [];
    const used = new Set<number>();

    while (numbers.length < count) {
      // Use crypto.getRandomValues for better randomness
      const randomBytes = new Uint32Array(1);
      crypto.getRandomValues(randomBytes);
      const number = (randomBytes[0] % count) + 1;

      if (!used.has(number)) {
        used.add(number);
        numbers.push(number);
      }
    }

    return numbers.sort((a, b) => a - b);
  }

  /**
   * Generate a seed for RNG auditing
   */
  private generateSeed(): string {
    const randomBytes = new Uint32Array(4);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes, byte => byte.toString(16).padStart(8, '0')).join('');
  }

  /**
   * Log RNG usage for auditing
   */
  public async logRNGUsage(result: RNGResult): Promise<void> {
    try {
      await supabaseAdmin
        .from('rng_audit')
        .insert({
          game_type: result.game_type,
          numbers_generated: result.numbers.length,
          seed: result.seed,
          timestamp: result.timestamp,
          numbers: result.numbers
        });
    } catch (error) {
      console.error('Error logging RNG usage:', error);
    }
  }
}

// Export singleton instance
export const unifiedRNG = UnifiedRNG.getInstance();

