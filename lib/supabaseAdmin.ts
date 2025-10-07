import { createClient } from '@supabase/supabase-js';
import { supabaseConfig, isDevelopment } from './config';

export const supabaseAdmin = createClient(supabaseConfig.url, supabaseConfig.serviceKey, {
  auth: { persistSession: false },
  global: { headers: { 'X-Client-Info': isDevelopment ? 'bingo-crash-admin-dev' : 'bingo-crash-admin' } }
});
