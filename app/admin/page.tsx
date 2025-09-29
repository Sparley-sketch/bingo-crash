import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/admin/login');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, force_password_change')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    redirect('/admin/login');
  }

  if (profile.role === 'viewer' && profile.force_password_change) {
    redirect('/admin/account');
  }

  const canWrite = profile.role === 'admin';
  return <AdminClient canWrite={canWrite} />;
}
