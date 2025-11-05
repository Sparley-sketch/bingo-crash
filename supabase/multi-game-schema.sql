-- Phase 1: Database Schema Updates for Multi-Game Support
-- Add game_type column to existing tables

-- Add game_type to rounds table
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bingo_crash';

-- Add game_type to cards table  
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bingo_crash';

-- Add Scramblingo-specific columns to cards table
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS letters TEXT[]; -- Array of letters for Scramblingo
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS daubed_positions BOOLEAN[]; -- Array of daubed positions
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS purchased BOOLEAN DEFAULT false;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ;

-- Add game_type to players table
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bingo_crash';

-- Add game_type to tickets table
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bingo_crash';

-- Add game_type to round_scores table
ALTER TABLE public.round_scores ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bingo_crash';

-- Add game_type to round_players table
ALTER TABLE public.round_players ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bingo_crash';

-- Update existing data to have proper game_type
UPDATE public.rounds SET game_type = 'bingo_crash' WHERE game_type IS NULL;
UPDATE public.cards SET game_type = 'bingo_crash' WHERE game_type IS NULL;
UPDATE public.players SET game_type = 'bingo_crash' WHERE game_type IS NULL;
UPDATE public.tickets SET game_type = 'bingo_crash' WHERE game_type IS NULL;
UPDATE public.round_scores SET game_type = 'bingo_crash' WHERE game_type IS NULL;
UPDATE public.round_players SET game_type = 'bingo_crash' WHERE game_type IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rounds_game_type ON public.rounds(game_type);
CREATE INDEX IF NOT EXISTS idx_cards_game_type ON public.cards(game_type);
CREATE INDEX IF NOT EXISTS idx_players_game_type ON public.players(game_type);
CREATE INDEX IF NOT EXISTS idx_tickets_game_type ON public.tickets(game_type);
CREATE INDEX IF NOT EXISTS idx_round_scores_game_type ON public.round_scores(game_type);
CREATE INDEX IF NOT EXISTS idx_round_players_game_type ON public.round_players(game_type);

-- Add game configuration table for different game settings
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
  max_cards_per_player = EXCLUDED.max_cards_per_player;

-- Enable RLS on new table
ALTER TABLE public.game_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for game_configs
CREATE POLICY "Allow read access to game_configs" 
ON public.game_configs 
FOR SELECT 
USING (true);

CREATE POLICY "Allow admin access to game_configs" 
ON public.game_configs 
FOR ALL 
TO authenticated 
USING (true);
