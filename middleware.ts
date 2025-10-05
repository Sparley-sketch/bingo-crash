import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  // This refreshes the session if needed and adds the session cookie
  await supabase.auth.getSession();
  return res;
}

export const config = {
  matcher: ['/admin/:path*', '/api/config/:path*', '/api/admin/:path*'],
};
