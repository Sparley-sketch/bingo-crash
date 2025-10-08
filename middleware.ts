import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_DEV || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    return res;
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // This refreshes the session if needed and adds the session cookie
  await supabase.auth.getSession();
  return res;
}

export const config = {
  matcher: ['/admin/:path*', '/api/config/:path*', '/api/admin/:path*'],
};
