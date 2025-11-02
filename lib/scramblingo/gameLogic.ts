// Scramblingo Game Logic
// Letter-based bingo game with 1x6 card format

export interface ScramblingoCard {
  id: string;
  letters: string[]; // Array of 6 letters (e.g., ['J', 'o', 'H', 'n', 'B', 'o'])
  numbers: number[]; // Corresponding numbers (e.g., [10, 41, 8, 40, 2, 41])
  player_id: string;
  round_id: string;
  daubs: number; // Number of letters matched
  daubed_positions: boolean[]; // [true, false, true, false, false, false]
  completed: boolean;
  created_at: string;
}

export interface ScramblingoRound {
  id: string;
  phase: 'setup' | 'live' | 'ended';
  called_letters: string[]; // Array of called letters (e.g., ['A', 'b', 'Z'])
  called_numbers: number[]; // Corresponding numbers
  speed_ms: number;
  created_at: string;
  ended_at?: string;
  winner_alias?: string;
  winner_card_id?: string;
  game_type: 'scramblingo';
}

/**
 * Letter to number mapping:
 * A-Z: 1-26
 * a-z: 27-52
 */
export class LetterMapper {
  private static uppercaseStart = 1; // A = 1
  private static lowercaseStart = 27; // a = 27

  /**
   * Convert letter to number
   */
  public static letterToNumber(letter: string): number {
    if (letter.length !== 1) {
      throw new Error('Letter must be a single character');
    }

    const code = letter.charCodeAt(0);
    
    // Uppercase A-Z: 65-90
    if (code >= 65 && code <= 90) {
      return code - 64; // A = 1, B = 2, ..., Z = 26
    }
    
    // Lowercase a-z: 97-122
    if (code >= 97 && code <= 122) {
      return code - 70; // a = 27, b = 28, ..., z = 52
    }
    
    throw new Error(`Invalid letter: ${letter}`);
  }

  /**
   * Convert number to letter
   */
  public static numberToLetter(number: number): string {
    if (number < 1 || number > 52) {
      throw new Error(`Number must be between 1 and 52, got ${number}`);
    }

    if (number <= 26) {
      // Uppercase A-Z
      return String.fromCharCode(number + 64);
    } else {
      // Lowercase a-z
      return String.fromCharCode(number + 70);
    }
  }

  /**
   * Convert array of letters to numbers
   */
  public static lettersToNumbers(letters: string[]): number[] {
    return letters.map(letter => this.letterToNumber(letter));
  }

  /**
   * Convert array of numbers to letters
   */
  public static numbersToLetters(numbers: number[]): string[] {
    return numbers.map(number => this.numberToLetter(number));
  }

  /**
   * Get all available letters (A-Z and a-z)
   */
  public static getAllLetters(): string[] {
    const uppercase = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
    const lowercase = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));
    return [...uppercase, ...lowercase];
  }
}

export class ScramblingoGame {
  private readonly CARD_SIZE = 6; // 1x6 card format
  private readonly MAX_CARDS_PER_PLAYER = 200;
  private readonly LETTER_COUNT = 52; // A-Z + a-z

  /**
   * Generate a random card with 6 unique letters
   */
  public generateRandomCard(): string[] {
    const allLetters = LetterMapper.getAllLetters();
    const shuffled = this.shuffleArray([...allLetters]);
    return shuffled.slice(0, this.CARD_SIZE);
  }

  /**
   * Create a card from player-selected letters
   */
  public createCardFromLetters(letters: string[]): string[] {
    if (letters.length !== this.CARD_SIZE) {
      throw new Error(`Card must have exactly ${this.CARD_SIZE} letters`);
    }

    // Validate all letters are unique
    const uniqueLetters = new Set(letters);
    if (uniqueLetters.size !== letters.length) {
      throw new Error('Duplicate letters are not allowed');
    }

    // Validate all letters are valid
    letters.forEach(letter => {
      if (!LetterMapper.getAllLetters().includes(letter)) {
        throw new Error(`Invalid letter: ${letter}`);
      }
    });

    return letters;
  }

  /**
   * Create a ScramblingoCard object
   */
  public createCard(
    playerId: string,
    roundId: string,
    letters: string[]
  ): ScramblingoCard {
    const numbers = LetterMapper.lettersToNumbers(letters);

    return {
      id: crypto.randomUUID(), // Use proper UUID instead of string
      letters,
      numbers,
      player_id: playerId,
      round_id: roundId,
      daubs: 0,
      daubed_positions: new Array(this.CARD_SIZE).fill(false),
      completed: false,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Check if a called letter matches any position on a card
   */
  public checkLetterMatch(card: ScramblingoCard, calledLetter: string): boolean {
    return card.letters.includes(calledLetter);
  }

  /**
   * Daub a letter on a card (if it matches)
   */
  public daubLetter(card: ScramblingoCard, calledLetter: string): ScramblingoCard {
    const updatedCard = { ...card };
    const index = updatedCard.letters.indexOf(calledLetter);
    
    if (index !== -1 && !updatedCard.daubed_positions[index]) {
      updatedCard.daubed_positions[index] = true;
      updatedCard.daubs += 1;
      
      // Check if card is completed
      if (updatedCard.daubs === this.CARD_SIZE) {
        updatedCard.completed = true;
      }
    }

    return updatedCard;
  }

  /**
   * Calculate progress percentage for a card
   */
  public getCardProgress(card: ScramblingoCard): number {
    return (card.daubs / this.CARD_SIZE) * 100;
  }

  /**
   * Check if a player can purchase more cards
   */
  public canPurchaseCard(currentCardCount: number, timeUntilStart: number): boolean {
    // Block purchases in last 8 seconds
    if (timeUntilStart <= 8) {
      return false;
    }
    
    return currentCardCount < this.MAX_CARDS_PER_PLAYER;
  }

  /**
   * Get available letters (excluding already selected ones)
   */
  public getAvailableLetters(selectedLetters: string[]): string[] {
    const allLetters = LetterMapper.getAllLetters();
    const selectedSet = new Set(selectedLetters);
    return allLetters.filter(letter => !selectedSet.has(letter));
  }

  /**
   * Check if a card is a winner (all 6 letters daubed)
   */
  public isWinner(card: ScramblingoCard): boolean {
    return card.completed;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Generate next letter to call (using unified RNG)
   */
  public generateCalledLetter(calledLetters: string[]): string {
    const allLetters = LetterMapper.getAllLetters();
    const availableLetters = allLetters.filter(letter => !calledLetters.includes(letter));
    
    if (availableLetters.length === 0) {
      throw new Error('All letters have been called');
    }

    const randomIndex = Math.floor(Math.random() * availableLetters.length);
    return availableLetters[randomIndex];
  }
}

export const scramblingoGame = new ScramblingoGame();