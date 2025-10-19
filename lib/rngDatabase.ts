/**
 * RNG Database Integration
 * 
 * Handles all database operations for RNG audit trail and certification compliance.
 * Uses Supabase for secure, immutable storage of RNG operations.
 */

import { supabaseAdmin } from './supabaseAdmin';

export interface RNGCommitDB {
  id: string;
  round_id: string;
  commit_hash: string;
  commit_timestamp: number;
  rng_version: string;
  created_at: string;
}

export interface RNGRevealDB {
  id: string;
  round_id: string;
  operator_seed: string;
  reveal_timestamp: number;
  was_verified: boolean;
  created_at: string;
}

export interface RNGAuditLogDB {
  id: string;
  round_id: string | null;
  operation: 'commit' | 'reveal' | 'generate' | 'verify';
  log_timestamp: number;
  rng_version: string;
  details: any;
  hash: string;
  created_at: string;
}

export interface GameRoundRNGDB {
  id: string;
  round_id: string;
  commit_hash: string;
  operator_seed: string;
  draw_order: number[];
  generated_at: number;
  revealed_at: number | null;
  verified: boolean;
  created_at: string;
}

/**
 * Store RNG commit in database
 */
export async function storeRNGCommit(roundId: string, commitHash: string, timestamp: number, rngVersion: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('rng_commits')
      .insert({
        round_id: roundId,
        commit_hash: commitHash,
        commit_timestamp: timestamp,
        rng_version: rngVersion
      });

    if (error) {
      console.error('Error storing RNG commit:', error);
      throw new Error(`Failed to store RNG commit: ${error.message}`);
    }
  } catch (error) {
    console.error('Database error storing RNG commit:', error);
    throw error;
  }
}

/**
 * Store RNG reveal in database
 */
export async function storeRNGReveal(roundId: string, operatorSeed: string, revealTimestamp: number): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('rng_reveals')
      .insert({
        round_id: roundId,
        operator_seed: operatorSeed,
        reveal_timestamp: revealTimestamp,
        was_verified: false
      });

    if (error) {
      console.error('Error storing RNG reveal:', error);
      throw new Error(`Failed to store RNG reveal: ${error.message}`);
    }
  } catch (error) {
    console.error('Database error storing RNG reveal:', error);
    throw error;
  }
}

/**
 * Store RNG audit log in database
 */
export async function storeRNGAuditLog(
  id: string,
  roundId: string | null,
  operation: 'commit' | 'reveal' | 'generate' | 'verify',
  timestamp: number,
  rngVersion: string,
  details: any,
  hash: string
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('rng_audit_logs')
      .insert({
        id: id,
        round_id: roundId,
        operation: operation,
        log_timestamp: timestamp,
        rng_version: rngVersion,
        details: details,
        hash: hash
      });

    if (error) {
      console.error('Error storing RNG audit log:', error);
      throw new Error(`Failed to store RNG audit log: ${error.message}`);
    }
  } catch (error) {
    console.error('Database error storing RNG audit log:', error);
    throw error;
  }
}

/**
 * Store complete game round with RNG data
 */
export async function storeGameRoundRNG(
  roundId: string,
  commitHash: string,
  operatorSeed: string,
  drawOrder: number[],
  generatedAt: number,
  revealedAt?: number
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('game_rounds_rng')
      .insert({
        round_id: roundId,
        commit_hash: commitHash,
        operator_seed: operatorSeed,
        draw_order: drawOrder,
        generated_at: generatedAt,
        revealed_at: revealedAt || null,
        verified: false
      });

    if (error) {
      console.error('Error storing game round RNG:', error);
      throw new Error(`Failed to store game round RNG: ${error.message}`);
    }
  } catch (error) {
    console.error('Database error storing game round RNG:', error);
    throw error;
  }
}

/**
 * Get RNG commit by round ID
 */
export async function getRNGCommit(roundId: string): Promise<RNGCommitDB | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('rng_commits')
      .select('*')
      .eq('round_id', roundId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching RNG commit:', error);
      throw new Error(`Failed to fetch RNG commit: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Database error fetching RNG commit:', error);
    throw error;
  }
}

/**
 * Get RNG reveal by round ID
 */
export async function getRNGReveal(roundId: string): Promise<RNGRevealDB | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('rng_reveals')
      .select('*')
      .eq('round_id', roundId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching RNG reveal:', error);
      throw new Error(`Failed to fetch RNG reveal: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Database error fetching RNG reveal:', error);
    throw error;
  }
}

/**
 * Get audit trail for a specific round
 */
export async function getRoundAuditTrail(roundId: string): Promise<RNGAuditLogDB[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('rng_audit_logs')
      .select('*')
      .eq('round_id', roundId)
      .order('log_timestamp');

    if (error) {
      console.error('Error fetching round audit trail:', error);
      throw new Error(`Failed to fetch round audit trail: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Database error fetching round audit trail:', error);
    throw error;
  }
}

/**
 * Get complete game round with RNG data
 */
export async function getGameRoundRNG(roundId: string): Promise<GameRoundRNGDB | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('game_rounds_rng')
      .select('*')
      .eq('round_id', roundId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching game round RNG:', error);
      throw new Error(`Failed to fetch game round RNG: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Database error fetching game round RNG:', error);
    throw error;
  }
}

/**
 * Mark a round as verified
 */
export async function markRoundAsVerified(roundId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('game_rounds_rng')
      .update({ verified: true })
      .eq('round_id', roundId);

    if (error) {
      console.error('Error marking round as verified:', error);
      throw new Error(`Failed to mark round as verified: ${error.message}`);
    }
  } catch (error) {
    console.error('Database error marking round as verified:', error);
    throw error;
  }
}

/**
 * Get RNG system statistics
 */
export async function getRNGSystemStats(): Promise<any> {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('get_rng_system_stats');

    if (error) {
      console.error('Error fetching RNG system stats:', error);
      throw new Error(`Failed to fetch RNG system stats: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Database error fetching RNG system stats:', error);
    throw error;
  }
}

/**
 * Verify RNG round integrity
 */
export async function verifyRNGRoundIntegrity(roundId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('verify_rng_round_integrity', { p_round_id: roundId });

    if (error) {
      console.error('Error verifying RNG round integrity:', error);
      throw new Error(`Failed to verify RNG round integrity: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Database error verifying RNG round integrity:', error);
    throw error;
  }
}

/**
 * Store statistical test results
 */
export async function storeStatisticalTestResult(
  testName: string,
  testVersion: string,
  testType: string,
  sampleSize: number,
  results: any,
  passed: boolean,
  timestamp: number
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('rng_statistical_tests')
      .insert({
        test_name: testName,
        test_version: testVersion,
        test_type: testType,
        sample_size: sampleSize,
        results: results,
        passed: passed,
        test_timestamp: timestamp
      });

    if (error) {
      console.error('Error storing statistical test result:', error);
      throw new Error(`Failed to store statistical test result: ${error.message}`);
    }
  } catch (error) {
    console.error('Database error storing statistical test result:', error);
    throw error;
  }
}

/**
 * Store integrity check result
 */
export async function storeIntegrityCheckResult(
  checkType: string,
  valid: boolean,
  errors: string[],
  timestamp: number
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('rng_integrity_checks')
      .insert({
        check_type: checkType,
        valid: valid,
        errors: errors,
        check_timestamp: timestamp
      });

    if (error) {
      console.error('Error storing integrity check result:', error);
      throw new Error(`Failed to store integrity check result: ${error.message}`);
    }
  } catch (error) {
    console.error('Database error storing integrity check result:', error);
    throw error;
  }
}
