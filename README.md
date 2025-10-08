# Bingo Crash — Vercel Starter

A minimal Next.js (App Router) scaffold to deploy your **Bingo Crash** game on **Vercel**
with a playable `/play` route and a simple `/admin` config panel backed by **Supabase**.

## What you get
- Next.js 14 (App Router)
- `/play` — drop in your Bingo Crash front-end (paste into `components/Game.tsx`)
- `/admin` — edit key/value config stored in Supabase (temporary `ADMIN_SECRET` guard)
- `/api/config` — GET/PUT config entries
- Supabase client/server helpers
- SQL schema for tables (see `supabase/schema.sql`)

## Quick start
1. Clone the repo, then:
   ```bash
   cp .env.example .env.local
   npm i
   npm run dev
   ```

2. Create a **Supabase** project at https://supabase.com/
   - In the project settings, copy your `URL` and `anon key` into `.env.local`:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy the **service role key** into `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`.

3. In Supabase SQL editor, run `supabase/schema.sql` from this repo to create the tables.

4. Paste your game UI code into `components/Game.tsx` (replace the placeholder).

5. Protect `/admin` by changing `ADMIN_SECRET` in `.env.local` (later replace with Supabase Auth).

6. **Push to GitHub**, then in **Vercel** → “New Project” → import the repo.
   - Add the environment variables in Vercel project settings (same keys as `.env.local`).
   - Deploy. Your app will be live. `/play` for the game, `/admin` for config.

## API
- `GET /api/config` → `{ items: Array<{ key, value }> }`
- `PUT /api/config` with body `{ key: string, value: any }` → upserts a key
  - Requires `x-admin-secret: <ADMIN_SECRET>` header (temporary guard).

## Replace the temp guard with Supabase Auth (recommended)
- Add user sign-in (magic link / OAuth) and check `role = 'admin'` via RLS or JWT claims.
- Then remove `ADMIN_SECRET` checks from API and `/admin` page.

## License
MIT
