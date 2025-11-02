import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function verifyAdminAuth(req: NextRequest): Promise<NextResponse | null> {
  try {
    const supabase = createServerComponentClient({ cookies });

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.warn('Authentication failed: No session or session error', sessionError);
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profileData || profileData.role !== 'admin') {
      console.warn('Authorization failed: User is not an admin or profile not found', profileError);
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    return null; // Authentication and authorization successful
  } catch (error) {
    console.error('Error in verifyAdminAuth:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}