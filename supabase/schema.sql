-- Basic schema for Bingo Crash config + skeleton game entities

create table if not exists public.config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Optional game tables (expand as needed)
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  phase text not null default 'setup', -- 'setup' | 'live' | 'ended' | 'prebuy' | 'countdown'
  called int[] default '{}',
  speed_ms int default 800,
  seed text,
  started_at timestamptz,
  ended_at timestamptz,
  prebuy_ends_at timestamptz,
  round_starts_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  round_id uuid references rounds(id) on delete cascade,
  numbers int[] not null,
  locked_at timestamptz,
  price_cents int not null default 0
);

-- Game tables for the bingo crash game
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade,
  player_id text not null,
  exploded boolean default false,
  paused boolean default false,
  daubs int default 0,
  wants_shield boolean default false,
  shield_used boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.players (
  id text primary key,
  round_id uuid references rounds(id) on delete cascade,
  alias text not null,
  created_at timestamptz default now()
);

-- RLS basic setup (adjust properly for prod)
alter table public.config enable row level security;
alter table public.rounds enable row level security;
alter table public.tickets enable row level security;
alter table public.cards enable row level security;
alter table public.players enable row level security;

-- Allow read to anon, write restricted (adjust for real auth later)
do $$ begin
  create policy config_read on public.config for select to anon using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy config_write on public.config for insert to service_role with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy config_update on public.config for update to service_role using (true);
exception when duplicate_object then null; end $$;

-- RLS policies for rounds
do $$ begin
  create policy rounds_read on public.rounds for select to anon using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy rounds_write on public.rounds for all to service_role using (true);
exception when duplicate_object then null; end $$;

-- RLS policies for cards
do $$ begin
  create policy cards_read on public.cards for select to anon using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy cards_write on public.cards for all to service_role using (true);
exception when duplicate_object then null; end $$;

-- RLS policies for players
do $$ begin
  create policy players_read on public.players for select to anon using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy players_write on public.players for all to service_role using (true);
exception when duplicate_object then null; end $$;
