-- Add prize_awarded column to rounds table to prevent duplicate prize crediting
-- This prevents the bug where winners get credited multiple times

-- For production (main tables)
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS prize_awarded BOOLEAN DEFAULT FALSE;
ALTER TABLE rounds_dev ADD COLUMN IF NOT EXISTS prize_awarded BOOLEAN DEFAULT FALSE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_rounds_prize_awarded ON rounds(prize_awarded);
CREATE INDEX IF NOT EXISTS idx_rounds_dev_prize_awarded ON rounds_dev(prize_awarded);

-- Update existing rounds to have prize_awarded = false (they haven't been awarded yet)
UPDATE rounds SET prize_awarded = FALSE WHERE prize_awarded IS NULL;
UPDATE rounds_dev SET prize_awarded = FALSE WHERE prize_awarded IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN rounds.prize_awarded IS 'Prevents duplicate prize crediting to winners';
COMMENT ON COLUMN rounds_dev.prize_awarded IS 'Prevents duplicate prize crediting to winners';




