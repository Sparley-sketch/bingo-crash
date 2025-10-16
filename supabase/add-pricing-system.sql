-- Add pricing and wallet system to production database
-- Run this script to add the necessary columns

-- Add wallet balance to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(10, 2) DEFAULT 1000.00;

-- Add prize pool and collection tracking to rounds table
ALTER TABLE rounds 
ADD COLUMN IF NOT EXISTS prize_pool DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_collected DECIMAL(10, 2) DEFAULT 0.00;

-- Add cost tracking to cards table
ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS card_cost DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS shield_cost DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS wants_shield BOOLEAN DEFAULT FALSE;

-- Insert pricing configuration
INSERT INTO config (key, value) VALUES 
  ('card_price', '10'),
  ('shield_price_percent', '50')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Create index for wallet queries
CREATE INDEX IF NOT EXISTS idx_players_wallet ON players(wallet_balance);

-- Comments for documentation
COMMENT ON COLUMN players.wallet_balance IS 'Player wallet balance in coins';
COMMENT ON COLUMN rounds.prize_pool IS 'Prize pool for the current round (65% of total collected)';
COMMENT ON COLUMN rounds.total_collected IS 'Total amount collected from card purchases';
COMMENT ON COLUMN cards.card_cost IS 'Cost of the card at purchase time';
COMMENT ON COLUMN cards.shield_cost IS 'Cost of the shield at purchase time';
COMMENT ON COLUMN cards.wants_shield IS 'Whether the player wants a shield for this card';
