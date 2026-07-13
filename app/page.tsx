import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './dashboard-client';

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch user profile from DB
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <DashboardClient
      user={{
        id: user.id,
        email: user.email ?? '',
        fullName: profile?.full_name ?? user.user_metadata?.full_name ?? '',
      }}
    />
  );
}
