-- Basic schema for Bingo Crash config + skeleton game entities

create table if not exists public.config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Optional game tables (expand as needed)
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending', -- 'pending' | 'active' | 'ended'
  seed text,
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  round_id uuid references rounds(id) on delete cascade,
  numbers int[] not null,
  locked_at timestamptz,
  price_cents int not null default 0
);

-- RLS basic setup (adjust properly for prod)
alter table public.config enable row level security;
alter table public.rounds enable row level security;
alter table public.tickets enable row level security;

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
