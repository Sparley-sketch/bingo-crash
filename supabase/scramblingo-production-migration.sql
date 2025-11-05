-- ============================================================================
-- SCRAMBLINGO PRODUCTION MIGRATION
-- ============================================================================
-- This migration adds Scramblingo support to production database.
-- It is idempotent and safe to run multiple times.
-- Run this in Supabase SQL Editor (Production database)
-- ============================================================================

-- ============================================================================
-- STEP 1: Add game_type column to existing tables
-- ============================================================================

-- Add game_type to rounds table
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bingo_crash';

-- Add game_type to cards table  
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bingo_crash';

-- Add game_type to players table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'players') THEN
    ALTER TABLE public.players ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bingo_crash';
  END IF;
END$$;

-- Add game_type to tickets table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
    ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bingo_crash';
  END IF;
END$$;

-- Add game_type to round_scores table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'round_scores') THEN
    ALTER TABLE public.round_scores ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bingo_crash';
  END IF;
END$$;

-- Add game_type to round_players table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'round_players') THEN
    ALTER TABLE public.round_players ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bingo_crash';
  END IF;
END$$;

-- ============================================================================
-- STEP 2: Add Scramblingo-specific columns to cards table
-- ============================================================================

-- Add player_alias (for Scramblingo - uses alias instead of player_id UUID)
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS player_alias TEXT;

-- Add letters array (for Scramblingo 1x6 letter cards)
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS letters TEXT[];

-- Add numbers array (converted from letters for Scramblingo)
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS numbers INTEGER[];

-- Add daubed_positions array (boolean array for Scramblingo)
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS daubed_positions BOOLEAN[];

-- Add completed flag (true when all 6 letters are daubed)
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;

-- Add purchased flag (true when card is purchased)
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS purchased BOOLEAN DEFAULT false;

-- Add purchased_at timestamp
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ;

-- ============================================================================
-- STEP 2.5: Make player_id nullable for Scramblingo cards
-- ============================================================================
-- Scramblingo uses player_alias instead of player_id UUID
-- We need to allow NULL for player_id or set a default UUID for Scramblingo cards
DO $$
BEGIN
  -- Check if player_id column exists and has NOT NULL constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cards' 
    AND column_name = 'player_id'
    AND is_nullable = 'NO'
  ) THEN
    -- Try to get the column type
    DECLARE
      col_type TEXT;
    BEGIN
      SELECT data_type INTO col_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'cards' 
      AND column_name = 'player_id';
      
      -- If it's UUID type, set a default UUID generator
      IF col_type = 'uuid' THEN
        ALTER TABLE public.cards ALTER COLUMN player_id DROP NOT NULL;
        ALTER TABLE public.cards ALTER COLUMN player_id SET DEFAULT gen_random_uuid();
      ELSE
        -- For TEXT type, just drop NOT NULL
        ALTER TABLE public.cards ALTER COLUMN player_id DROP NOT NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If anything fails, at least try to drop NOT NULL
      BEGIN
        ALTER TABLE public.cards ALTER COLUMN player_id DROP NOT NULL;
      EXCEPTION WHEN OTHERS THEN
        -- If that also fails, log but don't stop migration
        RAISE NOTICE 'Could not modify player_id constraint: %', SQLERRM;
      END;
    END;
  END IF;
END$$;

-- ============================================================================
-- STEP 3: Add Scramblingo-specific columns to rounds table
-- ============================================================================

-- Add draw_order (pre-determined sequence of balls for Scramblingo)
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS draw_order INTEGER[];

-- Add winner_call_index (which call number wins the game, 1-based)
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS winner_call_index INTEGER;

-- Add prize_pool (calculated pot size - 65% of total bets)
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS prize_pool NUMERIC DEFAULT 0;

-- Add total_collected (total amount collected from all bets)
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS total_collected NUMERIC DEFAULT 0;

-- Add winner_daubs (for storing winner's daub count)
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS winner_daubs INTEGER;

-- ============================================================================
-- STEP 4: Update existing data with proper defaults
-- ============================================================================

-- Set game_type for existing records
UPDATE public.rounds SET game_type = 'bingo_crash' WHERE game_type IS NULL;
UPDATE public.cards SET game_type = 'bingo_crash' WHERE game_type IS NULL;

-- Set defaults for new Scramblingo columns
UPDATE public.cards SET 
  letters = COALESCE(letters, '{}'::TEXT[]),
  numbers = COALESCE(numbers, '{}'::INTEGER[]),
  daubed_positions = COALESCE(daubed_positions, '{}'::BOOLEAN[]),
  completed = COALESCE(completed, false),
  purchased = COALESCE(purchased, false)
WHERE letters IS NULL OR numbers IS NULL OR daubed_positions IS NULL OR completed IS NULL OR purchased IS NULL;

-- Update existing player records if players table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'players') THEN
    UPDATE public.players SET game_type = 'bingo_crash' WHERE game_type IS NULL;
  END IF;
END$$;

-- ============================================================================
-- STEP 5: Create indexes for better performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_rounds_game_type ON public.rounds(game_type);
CREATE INDEX IF NOT EXISTS idx_cards_game_type ON public.cards(game_type);
CREATE INDEX IF NOT EXISTS idx_cards_round_game ON public.cards(round_id, game_type);
CREATE INDEX IF NOT EXISTS idx_cards_player_alias ON public.cards(player_alias) WHERE player_alias IS NOT NULL;

-- ============================================================================
-- STEP 6: Create game_configs table for game-specific settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.game_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  ball_count INTEGER NOT NULL DEFAULT 75,
  card_size INTEGER NOT NULL DEFAULT 25,
  max_cards_per_player INTEGER NOT NULL DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default game configurations
INSERT INTO public.game_configs (game_type, name, description, ball_count, card_size, max_cards_per_player) 
VALUES 
  ('bingo_crash', 'Bingo Crash', 'Original bingo game with crash mechanics', 75, 25, 4),
  ('scramblingo', 'Scramblingo', 'Letter-based bingo game with 1x6 card format', 52, 6, 200)
ON CONFLICT (game_type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  ball_count = EXCLUDED.ball_count,
  card_size = EXCLUDED.card_size,
  max_cards_per_player = EXCLUDED.max_cards_per_player,
  updated_at = NOW();

-- ============================================================================
-- STEP 7: Enable RLS and create policies for game_configs
-- ============================================================================

ALTER TABLE public.game_configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow read access to game_configs" ON public.game_configs;
DROP POLICY IF EXISTS "Allow admin access to game_configs" ON public.game_configs;

-- Create read policy for game_configs
CREATE POLICY "Allow read access to game_configs" 
ON public.game_configs 
FOR SELECT 
USING (true);

-- Create admin policy for game_configs (if using authenticated users)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE POLICY "Allow admin access to game_configs" 
    ON public.game_configs 
    FOR ALL 
    TO authenticated 
    USING (true);
  END IF;
END$$;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration to verify)
-- ============================================================================

-- Check game_type columns exist
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'cards' AND column_name = 'game_type';

-- Check Scramblingo columns exist
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'cards' 
-- AND column_name IN ('letters', 'daubed_positions', 'completed', 'purchased', 'numbers', 'player_alias');

-- Check rounds columns exist
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'rounds' 
-- AND column_name IN ('draw_order', 'winner_call_index', 'prize_pool', 'total_collected');

-- Check game_configs table exists and has data
-- SELECT * FROM game_configs;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- ✅ All Scramblingo columns have been added
-- ✅ All indexes have been created
-- ✅ game_configs table has been created with default entries
-- ✅ Existing data has been updated with proper defaults
-- ============================================================================

