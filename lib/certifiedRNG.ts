/**
 * Certified RNG Integration Layer
 * 
 * This module integrates the certified RNG system with the existing game logic.
 * It replaces any non-certified random number generation with certified CSPRNG.
 */

import { 
  commitToSeed, 
  revealSeed, 
  generateDrawOrder, 
  verifyCommitReveal,
  generateSecureRandom,
  generateSecureRandomArray
} from './rng';
import { 
  storeRNGCommit, 
  storeRNGReveal, 
  storeGameRoundRNG,
  getRNGCommit,
  getRNGReveal,
  markRoundAsVerified
} from './rngDatabase';

export interface CertifiedRoundData {
  roundId: string;
  commitHash: string;
  operatorSeed: string;
  drawOrder: number[];
  verified: boolean;
}

/**
 * Initialize a new certified game round
 * Creates commit for commit-reveal scheme
 */
export async function initializeCertifiedRound(roundId: string): Promise<string> {
  try {
    console.log(`[CERTIFIED-RNG] Initializing certified round: ${roundId}`);
    
    // Commit to seed (commit-reveal scheme)
    const commitHash = commitToSeed(roundId);
    
    // Store commit in database
    await storeRNGCommit(roundId, commitHash, Date.now(), '1.0.0');
    
    console.log(`[CERTIFIED-RNG] Round ${roundId} initialized with commit: ${commitHash}`);
    
    return commitHash;
  } catch (error) {
    console.error(`[CERTIFIED-RNG] Error initializing round ${roundId}:`, error);
    throw error;
  }
}

/**
 * Generate the certified draw order for a round
 * This creates the actual game outcome using certified RNG
 */
export async function generateCertifiedDrawOrder(roundId: string, ballCount: number = 75): Promise<number[]> {
  try {
    console.log(`[CERTIFIED-RNG] Generating draw order for round: ${roundId}`);
    
    // Verify we have a commit for this round
    const commit = await getRNGCommit(roundId);
    if (!commit) {
      throw new Error(`No commit found for round ${roundId}`);
    }
    
    // Generate draw order using certified RNG
    const drawOrder = generateDrawOrder(roundId, ballCount);
    
    // Reveal the seed for verification
    const operatorSeed = revealSeed(roundId);
    if (!operatorSeed) {
      throw new Error(`Failed to reveal seed for round ${roundId}`);
    }
    
    // Store reveal in database
    await storeRNGReveal(roundId, operatorSeed, Date.now());
    
    // Store complete round data
    await storeGameRoundRNG(
      roundId,
      commit.commit_hash,
      operatorSeed,
      drawOrder,
      Date.now(),
      Date.now()
    );
    
    // Verify the commit-reveal integrity
    const isValid = verifyCommitReveal(roundId, operatorSeed, commit.commit_hash);
    if (!isValid) {
      throw new Error(`Commit-reveal verification failed for round ${roundId}`);
    }
    
    // Mark as verified
    await markRoundAsVerified(roundId);
    
    console.log(`[CERTIFIED-RNG] Draw order generated for round ${roundId}: ${drawOrder.length} balls`);
    
    return drawOrder;
  } catch (error) {
    console.error(`[CERTIFIED-RNG] Error generating draw order for round ${roundId}:`, error);
    throw error;
  }
}

/**
 * Get certified round data for verification
 */
export async function getCertifiedRoundData(roundId: string): Promise<CertifiedRoundData | null> {
  try {
    const commit = await getRNGCommit(roundId);
    const reveal = await getRNGReveal(roundId);
    
    if (!commit || !reveal) {
      return null;
    }
    
    // Get round data from database
    const { supabaseAdmin } = await import('./supabaseAdmin');
    const { data: roundData } = await supabaseAdmin
      .from('game_rounds_rng')
      .select('*')
      .eq('round_id', roundId)
      .single();
    
    if (!roundData) {
      return null;
    }
    
    return {
      roundId,
      commitHash: commit.commit_hash,
      operatorSeed: reveal.operator_seed,
      drawOrder: roundData.draw_order,
      verified: roundData.verified
    };
  } catch (error) {
    console.error(`[CERTIFIED-RNG] Error getting certified round data for ${roundId}:`, error);
    return null;
  }
}

/**
 * Verify a certified round's integrity
 */
export async function verifyCertifiedRound(roundId: string): Promise<boolean> {
  try {
    const roundData = await getCertifiedRoundData(roundId);
    if (!roundData) {
      return false;
    }
    
    // Verify commit-reveal scheme
    const isValidCommit = verifyCommitReveal(roundId, roundData.operatorSeed, roundData.commitHash);
    
    // Verify we have proper audit trail
    const { getRoundAuditTrail } = await import('./rngDatabase');
    const auditTrail = await getRoundAuditTrail(roundId);
    
    const hasAuditTrail = auditTrail.length > 0;
    
    const isVerified = isValidCommit && hasAuditTrail && roundData.verified;
    
    console.log(`[CERTIFIED-RNG] Round ${roundId} verification:`, {
      isValidCommit,
      hasAuditTrail,
      verified: roundData.verified,
      overallVerified: isVerified
    });
    
    return isVerified;
  } catch (error) {
    console.error(`[CERTIFIED-RNG] Error verifying round ${roundId}:`, error);
    return false;
  }
}

/**
 * Generate certified random numbers for any game operation
 * Use this instead of Math.random() anywhere in the game
 */
export function getCertifiedRandom(min: number = 0, max: number = 1): number {
  if (min === 0 && max === 1) {
    // Return float between 0 and 1 (like Math.random())
    return generateSecureRandom(0, 1000000) / 1000000;
  } else {
    // Return integer in range
    return generateSecureRandom(min, max);
  }
}

/**
 * Generate array of certified random numbers
 */
export function getCertifiedRandomArray(length: number, min: number, max: number): number[] {
  return generateSecureRandomArray(length, min, max);
}

/**
 * Generate certified random boolean
 */
export function getCertifiedRandomBoolean(): boolean {
  return generateSecureRandom(0, 1) === 1;
}

/**
 * Generate certified random choice from array
 */
export function getCertifiedRandomChoice<T>(array: T[]): T {
  if (array.length === 0) {
    throw new Error('Cannot choose from empty array');
  }
  const index = generateSecureRandom(0, array.length - 1);
  return array[index];
}

/**
 * Shuffle array using certified RNG
 */
export function getCertifiedShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  
  // Fisher-Yates shuffle using certified RNG
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = generateSecureRandom(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

/**
 * Initialize RNG system for certification
 * Call this once when the application starts
 */
export async function initializeCertifiedRNG(): Promise<void> {
  try {
    console.log('[CERTIFIED-RNG] Initializing certified RNG system...');
    
    // Log system information
    const { getRNGSystemInfo } = await import('./rng');
    const systemInfo = getRNGSystemInfo();
    
    console.log('[CERTIFIED-RNG] System information:', systemInfo);
    
    // Run initial integrity check
    const { validateRNGIntegrity } = await import('./rng');
    const integrityCheck = validateRNGIntegrity();
    
    if (!integrityCheck.valid) {
      console.error('[CERTIFIED-RNG] Integrity check failed:', integrityCheck.errors);
      throw new Error('RNG system integrity check failed');
    }
    
    console.log('[CERTIFIED-RNG] Certified RNG system initialized successfully');
    
  } catch (error) {
    console.error('[CERTIFIED-RNG] Error initializing certified RNG system:', error);
    throw error;
  }
}

/**
 * Replace Math.random() calls in existing code
 * This is a drop-in replacement for Math.random()
 */
export const certifiedMath = {
  random: () => getCertifiedRandom(),
  randomInt: (min: number, max: number) => getCertifiedRandom(Math.ceil(min), Math.floor(max)),
  randomChoice: <T>(array: T[]) => getCertifiedRandomChoice(array),
  shuffle: <T>(array: T[]) => getCertifiedShuffle(array)
};

// Export constants for certification
export const CERTIFIED_RNG_VERSION = '1.0.0';
export const CERTIFIED_RNG_LIBRARY = 'Node.js crypto.randomInt';
export const CERTIFIED_RNG_ENTROPY_SOURCE = 'OS';
