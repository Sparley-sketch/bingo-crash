-- Add prize_awarded column to rounds table to prevent duplicate prize crediting
-- PRODUCTION VERSION - only updates main rounds table

-- Add column to rounds table
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS prize_awarded BOOLEAN DEFAULT FALSE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_rounds_prize_awarded ON rounds(prize_awarded);

-- Update existing rounds to have prize_awarded = false
UPDATE rounds SET prize_awarded = FALSE WHERE prize_awarded IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN rounds.prize_awarded IS 'Prevents duplicate prize crediting to winners';




