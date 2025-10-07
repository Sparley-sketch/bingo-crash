# Development Environment Setup

## 1. Database Setup

### Create a separate Supabase project for development:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project called "bingo-crash-dev"
3. Copy the project URL and API keys

### Apply the development schema:
```sql
-- Run the contents of supabase/schema-dev.sql in your development Supabase project
```

## 2. Environment Variables

Update `.env.local` with your development credentials:

```env
NEXT_PUBLIC_SUPABASE_URL_DEV=your_dev_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV=your_dev_anon_key
SUPABASE_SERVICE_ROLE_KEY_DEV=your_dev_service_role_key
```

## 3. Development Mode

The application will automatically use development tables when:
- `NODE_ENV=development` OR
- `DEV_MODE=true`

## 4. Development Tables

Development uses separate tables with `_dev` suffix:
- `config_dev` instead of `config`
- `rounds_dev` instead of `rounds`
- `players_dev` instead of `players`
- `cards_dev` instead of `cards`
- `users_dev` instead of `users`

## 5. Running Development

```bash
npm run dev
```

## 6. Safety Features

- Development environment is completely isolated from production
- Uses different Supabase project
- Uses different table names
- No risk of affecting production data
