-- Dev standardization for Scramblingo support (idempotent & safe to re-run)
-- - Aligns rounds_dev/cards_dev with multi-game fields
-- - Adds Scramblingo columns
-- - Relaxes Bingo Crash–specific NOT NULLs in dev
-- - Adds helpful indexes

-- 1) rounds_dev: ensure game_type support
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rounds_dev'
  ) THEN
    BEGIN
      ALTER TABLE public.rounds_dev ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bingo_crash';
    EXCEPTION WHEN duplicate_column THEN NULL; END;

    UPDATE public.rounds_dev
    SET game_type = COALESCE(game_type, 'bingo_crash')
    WHERE game_type IS NULL;

    CREATE INDEX IF NOT EXISTS idx_rounds_dev_game_type ON public.rounds_dev(game_type);
  END IF;
END$$;

-- 2) cards_dev: add Scramblingo columns and relax legacy NOT NULLs
DO $$
DECLARE
  grid_data_type text;
  grid_udt_name  text;
  fk_name text;
  col_is_uuid boolean;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cards_dev'
  ) THEN
    -- Add Scramblingo columns (safe if already exist)
    BEGIN
      ALTER TABLE public.cards_dev ADD COLUMN IF NOT EXISTS player_alias TEXT;
      ALTER TABLE public.cards_dev ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'bingo_crash';
      ALTER TABLE public.cards_dev ADD COLUMN IF NOT EXISTS letters TEXT[];
      ALTER TABLE public.cards_dev ADD COLUMN IF NOT EXISTS numbers INTEGER[];
      ALTER TABLE public.cards_dev ADD COLUMN IF NOT EXISTS daubed_positions BOOLEAN[];
      ALTER TABLE public.cards_dev ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;
      ALTER TABLE public.cards_dev ADD COLUMN IF NOT EXISTS purchased BOOLEAN DEFAULT false;
      ALTER TABLE public.cards_dev ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ;
    EXCEPTION WHEN duplicate_column THEN NULL; END;

    -- Backfill defaults
    UPDATE public.cards_dev SET
      player_alias     = COALESCE(player_alias, player_id::TEXT),
      game_type        = COALESCE(game_type, 'bingo_crash'),
      letters          = COALESCE(letters, '{}'::TEXT[]),
      numbers          = COALESCE(numbers, '{}'::INTEGER[]),
      daubed_positions = COALESCE(daubed_positions, '{}'::BOOLEAN[]),
      completed        = COALESCE(completed, false),
      purchased        = COALESCE(purchased, false)
    WHERE player_alias IS NULL
       OR game_type IS NULL
       OR letters IS NULL
       OR numbers IS NULL
       OR daubed_positions IS NULL
       OR completed IS NULL
       OR purchased IS NULL;

    -- Relax Bingo Crash–specific fields in dev
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cards_dev' AND column_name='name') THEN
      ALTER TABLE public.cards_dev ALTER COLUMN name DROP NOT NULL;
      ALTER TABLE public.cards_dev ALTER COLUMN name SET DEFAULT 'Scramblingo Card';
      UPDATE public.cards_dev SET name = COALESCE(name, 'Scramblingo Card') WHERE name IS NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cards_dev' AND column_name='grid') THEN
      SELECT data_type, udt_name INTO grid_data_type, grid_udt_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='cards_dev' AND column_name='grid';

      ALTER TABLE public.cards_dev ALTER COLUMN grid DROP NOT NULL;

      IF grid_data_type = 'ARRAY' AND grid_udt_name = '_int4' THEN
        ALTER TABLE public.cards_dev ALTER COLUMN grid SET DEFAULT '{}'::integer[];
        UPDATE public.cards_dev SET grid = COALESCE(grid, '{}'::integer[]) WHERE grid IS NULL;
      ELSIF grid_data_type = 'ARRAY' AND grid_udt_name = '_text' THEN
        ALTER TABLE public.cards_dev ALTER COLUMN grid SET DEFAULT '{}'::text[];
        UPDATE public.cards_dev SET grid = COALESCE(grid, '{}'::text[]) WHERE grid IS NULL;
      ELSIF grid_data_type = 'jsonb' THEN
        ALTER TABLE public.cards_dev ALTER COLUMN grid SET DEFAULT '{}'::jsonb;
        UPDATE public.cards_dev SET grid = COALESCE(grid, '{}'::jsonb) WHERE grid IS NULL;
      ELSIF grid_data_type = 'json' THEN
        ALTER TABLE public.cards_dev ALTER COLUMN grid SET DEFAULT '{}'::json;
        UPDATE public.cards_dev SET grid = COALESCE(grid, '{}'::json) WHERE grid IS NULL;
      END IF;
    END IF;

    -- Relax exploded/paused/wants_shield/shield_used
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cards_dev' AND column_name='exploded') THEN
      ALTER TABLE public.cards_dev ALTER COLUMN exploded DROP NOT NULL;
      ALTER TABLE public.cards_dev ALTER COLUMN exploded SET DEFAULT false;
      UPDATE public.cards_dev SET exploded = COALESCE(exploded, false) WHERE exploded IS NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cards_dev' AND column_name='paused') THEN
      ALTER TABLE public.cards_dev ALTER COLUMN paused DROP NOT NULL;
      ALTER TABLE public.cards_dev ALTER COLUMN paused SET DEFAULT false;
      UPDATE public.cards_dev SET paused = COALESCE(paused, false) WHERE paused IS NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cards_dev' AND column_name='wants_shield') THEN
      ALTER TABLE public.cards_dev ALTER COLUMN wants_shield DROP NOT NULL;
      ALTER TABLE public.cards_dev ALTER COLUMN wants_shield SET DEFAULT false;
      UPDATE public.cards_dev SET wants_shield = COALESCE(wants_shield, false) WHERE wants_shield IS NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cards_dev' AND column_name='shield_used') THEN
      ALTER TABLE public.cards_dev ALTER COLUMN shield_used DROP NOT NULL;
      ALTER TABLE public.cards_dev ALTER COLUMN shield_used SET DEFAULT false;
      UPDATE public.cards_dev SET shield_used = COALESCE(shield_used, false) WHERE shield_used IS NULL;
    END IF;

    -- Make player_id non-blocking in dev; drop FK if any; set UUID default if UUID type
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cards_dev' AND column_name='player_id') THEN
      -- Drop FK if present
      SELECT tc.constraint_name INTO fk_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'cards_dev'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'player_id'
      LIMIT 1;

      IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.cards_dev DROP CONSTRAINT %I;', fk_name);
      END IF;

      ALTER TABLE public.cards_dev ALTER COLUMN player_id DROP NOT NULL;

      SELECT (data_type = 'uuid') INTO col_is_uuid
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'cards_dev' AND column_name = 'player_id';

      IF col_is_uuid THEN
        ALTER TABLE public.cards_dev ALTER COLUMN player_id SET DEFAULT gen_random_uuid();
      END IF;
    END IF;

    -- Helpful index
    CREATE INDEX IF NOT EXISTS idx_cards_dev_round_game ON public.cards_dev(round_id, game_type);
  END IF;
END$$;



