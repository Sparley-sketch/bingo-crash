-- Development Database Schema
-- This schema is for development environment only
-- DO NOT use production data or keys

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Development-specific configuration table
CREATE TABLE IF NOT EXISTS config_dev (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Development-specific rounds table
CREATE TABLE IF NOT EXISTS rounds_dev (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phase TEXT NOT NULL CHECK (phase IN ('setup', 'live', 'ended')) DEFAULT 'setup',
  speed_ms INTEGER NOT NULL DEFAULT 800,
  total_balls INTEGER NOT NULL DEFAULT 25,
  called_balls INTEGER[] DEFAULT '{}',
  last_called INTEGER,
  winner_alias TEXT,
  winner_daubs INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Development-specific players table
CREATE TABLE IF NOT EXISTS players_dev (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alias TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Development-specific cards table
CREATE TABLE IF NOT EXISTS cards_dev (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES players_dev(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES rounds_dev(id) ON DELETE CASCADE,
  numbers INTEGER[] NOT NULL,
  daubs INTEGER DEFAULT 0,
  exploded BOOLEAN DEFAULT FALSE,
  paused BOOLEAN DEFAULT FALSE,
  shield_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Development-specific users table (for admin)
CREATE TABLE IF NOT EXISTS users_dev (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert development configuration
INSERT INTO config_dev (key, value) VALUES 
  ('speed_ms', '800'),
  ('total_balls', '25'),
  ('bombs_per_card', '3')
ON CONFLICT (key) DO NOTHING;

-- Create indexes for development
CREATE INDEX IF NOT EXISTS idx_rounds_dev_phase ON rounds_dev(phase);
CREATE INDEX IF NOT EXISTS idx_cards_dev_player_id ON cards_dev(player_id);
CREATE INDEX IF NOT EXISTS idx_cards_dev_round_id ON cards_dev(round_id);
CREATE INDEX IF NOT EXISTS idx_players_dev_alias ON players_dev(alias);

-- Enable RLS for development tables
ALTER TABLE config_dev ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds_dev ENABLE ROW LEVEL SECURITY;
ALTER TABLE players_dev ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards_dev ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_dev ENABLE ROW LEVEL SECURITY;

-- Development RLS policies (more permissive for testing)
CREATE POLICY "Allow all operations on config_dev" ON config_dev FOR ALL USING (true);
CREATE POLICY "Allow all operations on rounds_dev" ON rounds_dev FOR ALL USING (true);
CREATE POLICY "Allow all operations on players_dev" ON players_dev FOR ALL USING (true);
CREATE POLICY "Allow all operations on cards_dev" ON cards_dev FOR ALL USING (true);
CREATE POLICY "Allow all operations on users_dev" ON users_dev FOR ALL USING (true);
