-- Create global players table that persists across rounds
-- This allows wallet balances to carry over between games

-- Create global players table (not tied to specific rounds)
CREATE TABLE IF NOT EXISTS global_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alias TEXT UNIQUE NOT NULL,
  wallet_balance DECIMAL(10, 2) DEFAULT 1000.00,
  total_games_played INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast alias lookups
CREATE INDEX IF NOT EXISTS idx_global_players_alias ON global_players(alias);
CREATE INDEX IF NOT EXISTS idx_global_players_wallet ON global_players(wallet_balance);

-- Enable RLS
ALTER TABLE global_players ENABLE ROW LEVEL SECURITY;

-- Allow all operations (for production)
CREATE POLICY "Allow all operations on global_players" ON global_players FOR ALL USING (true);

-- Comments for documentation
COMMENT ON TABLE global_players IS 'Global player records that persist across all rounds';
COMMENT ON COLUMN global_players.wallet_balance IS 'Player wallet balance in coins - persists across rounds';
COMMENT ON COLUMN global_players.total_games_played IS 'Total number of games this player has participated in';
COMMENT ON COLUMN global_players.total_wins IS 'Total number of games this player has won';
