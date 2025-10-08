// Environment configuration
export const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true';
export const isDev = isDevelopment; // Alias for compatibility

// Supabase configuration based on environment
export const supabaseConfig = {
  url: isDevelopment 
    ? (process.env.NEXT_PUBLIC_SUPABASE_URL_DEV || process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    : (process.env.NEXT_PUBLIC_SUPABASE_URL || ''),
  
  anonKey: isDevelopment 
    ? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
    : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
  
  serviceKey: isDevelopment 
    ? (process.env.SUPABASE_SERVICE_ROLE_KEY_DEV || process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    : (process.env.SUPABASE_SERVICE_ROLE_KEY || '')
};

// Table names based on environment
export const tableNames = {
  config: isDevelopment ? 'config_dev' : 'config',
  rounds: isDevelopment ? 'rounds_dev' : 'rounds',
  players: isDevelopment ? 'players_dev' : 'players',
  cards: isDevelopment ? 'cards_dev' : 'cards',
  users: isDevelopment ? 'users_dev' : 'users'
};

// Development-specific settings
export const devSettings = {
  enableDebugLogs: isDevelopment,
  allowAllOperations: isDevelopment,
  useLocalStorage: isDevelopment
};


