import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Add security headers
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // For admin routes, add additional security headers
  if (req.nextUrl.pathname.startsWith('/admin')) {
    res.headers.set('X-XSS-Protection', '1; mode=block');
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co;");
  }
  
  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_DEV || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    return res;
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Temporarily disabled middleware session validation for admin routes
  // The AdminWrapper.tsx handles authentication on the server side
  // The backend API endpoints are protected with verifyAdminAuth()
  // This prevents middleware conflicts with the login flow
  // if (req.nextUrl.pathname.startsWith('/admin') && 
  //     !req.nextUrl.pathname.includes('/admin/login') && 
  //     !req.nextUrl.pathname.includes('/admin/forbidden')) {
  //   // Session validation logic temporarily disabled
  // }
  
  // This refreshes the session if needed and adds the session cookie
  await supabase.auth.getSession();
  return res;
}

export const config = {
  matcher: [
     '/admin',
     '/admin/((?!login|forbidden).*)',
     // Admin API endpoints are now protected by backend authentication
     // No need to include them in middleware matcher
  ],
};
