'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type State = 'loading' | 'ready' | 'failed';

export default function AccountPage() {
  const router = useRouter();
  const [state, setState] = useState<State>('loading');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [profileCheck, setProfileCheck] = useState<'loading' | 'passed' | 'failed'>('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();
    if (!client) { setState('failed'); setError('Supabase 설정이 없습니다.'); return; }
    void (async () => {
      try {
        // getUser validates the session with the Auth server; getSession alone is not sufficient.
        const { data: { user }, error: authError } = await client.auth.getUser();
        if (!active) return;
        if (authError || !user) { router.replace('/login'); return; }
        setEmail(user.email || '');
        setIdentifier(user.id);
        setState('ready');
        const { data, error: databaseError } = await client.from('profiles')
          .select('id, created_at').eq('id', user.id).maybeSingle();
        if (!active) return;
        setProfileCheck(!databaseError && data?.id === user.id ? 'passed' : 'failed');
      } catch (cause) {
        if (!active) return;
        setState('failed');
        setError(cause instanceof Error ? cause.message : '계정을 확인하지 못했습니다.');
      }
    })();
    return () => { active = false; };
  }, [router]);

  const signOut = async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setBusy(true);
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) { setError(signOutError.message); setBusy(false); return; }
    setEmail('');
    setIdentifier('');
    router.replace('/login');
    router.refresh();
  };

  return (
    <section className="mx-auto max-w-lg py-12 sm:py-20" aria-label="파일럿 인증 계정 확인">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm font-semibold text-blue-600">Daymo · 인증 파일럿</p>
        <h1 className="mt-2 text-2xl font-semibold">로그인 상태</h1>
        {state === 'loading' && <p role="status" className="mt-5 text-sm">계정을 확인하고 있습니다…</p>}
        {state === 'ready' && (
          <div className="mt-5 space-y-3">
            <p className="text-sm"><strong>이메일:</strong> {email}</p>
            <p className="break-all text-xs text-gray-500"><strong>사용자 ID:</strong> {identifier}</p>
            <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800 dark:bg-slate-800 dark:text-white">
              {profileCheck === 'loading' ? '개인 DB 권한 검사 중…' :
               profileCheck === 'passed' ? '로그인 및 본인 프로필 읽기 확인 완료' :
               '개인 프로필 DB 조회 실패 · 추가 보안 점검 필요'}
            </p>
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              현재는 로그인 테스트 전용입니다. 기존 일정·근무표는 아직 클라우드로 이전되지 않았으며,
              두 기기 동기화도 비활성화 상태입니다.
            </p>
            <button disabled={busy} onClick={() => void signOut()} type="button" className="btn btn-primary min-h-11 w-full">
              {busy ? '로그아웃 중…' : '로그아웃'}
            </button>
          </div>
        )}
        {state === 'failed' && <p role="alert" className="mt-5 text-sm text-red-600">{error}</p>}
        {error && state === 'ready' && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        <Link href="/login" className="mt-4 block text-sm text-blue-600 underline">로그인 화면으로</Link>
      </div>
    </section>
  );
}
