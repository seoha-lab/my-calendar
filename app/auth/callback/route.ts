import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  // Whitelist in-app redirect paths; never redirect to an arbitrary external URL.
  const requestedNext = url.searchParams.get('next');
  const next = requestedNext === '/auth/reset-password' ? requestedNext : '/account';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin));
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(new URL('/login?error=not_configured', url.origin));

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/login?error=confirmation_failed', url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
