'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Mode = 'login' | 'signup' | 'recovery';

function explainError(message: string): string {
  if (/invalid login credentials/i.test(message)) return '이메일이나 비밀번호를 확인해 주세요.';
  if (/email not confirmed/i.test(message)) return '메일함에서 이메일 인증을 먼저 완료해 주세요.';
  if (/email rate limit|rate limit|too many requests/i.test(message)) return '메일 발송 제한에 도달했습니다. 잠시 후 다시 시도해 주세요.';
  if (/password/i.test(message) && /weak|short|length/i.test(message)) return '더 안전한 비밀번호를 입력해 주세요.';
  if (/fetch|network/i.test(message)) return '네트워크 연결을 확인해 주세요.';
  return message || '인증 요청에 실패했습니다.';
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('error')) setError('인증 링크가 유효하지 않거나 만료되었습니다. 다시 요청해 주세요.');
    const client = getSupabaseBrowserClient();
    if (!client) return;
    void client.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/account');
    }).catch(() => {});
  }, [router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const client = getSupabaseBrowserClient();
    if (!client) { setError('Supabase 연결 정보가 설정되지 않았습니다.'); return; }
    setPending(true);
    try {
      if (mode === 'login') {
        const { error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        router.replace('/account');
        router.refresh();
      } else if (mode === 'signup') {
        const { data, error: authError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin + '/auth/callback' },
        });
        if (authError) throw authError;
        if (data.session) {
          router.replace('/account');
          router.refresh();
        } else {
          setMessage('가입 요청을 받았습니다. 인증 메일이 도착하면 링크를 눌러 주세요. 메일이 오지 않으면 발송 설정을 확인해야 합니다.');
        }
      } else {
        const { error: authError } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + '/auth/callback?next=%2Fauth%2Freset-password',
        });
        if (authError) throw authError;
        setMessage('계정이 등록되어 있다면 비밀번호 재설정 메일이 발송됩니다.');
      }
    } catch (caught) {
      setError(explainError(caught instanceof Error ? caught.message : '인증에 실패했습니다.'));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md px-4 py-12 sm:py-20" aria-label="Daymo 계정 인증">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
        <p className="text-sm font-semibold text-blue-600">Daymo · 로그인 파일럿</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
          {mode === 'login' ? '이메일 로그인' : mode === 'signup' ? '계정 만들기' : '비밀번호 재설정'}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          인증 기능 테스트용 화면입니다. 현재 기존 Daymo 일정의 클라우드 동기화 및 복원은 지원하지 않습니다.
        </p>
        <div className="mt-6 flex gap-2" role="group" aria-label="인증 방식">
          <button type="button" aria-pressed={mode === 'login'} className={'btn flex-1 ' + (mode === 'login' ? 'btn-primary' : '')} onClick={() => { setMode('login'); setMessage(''); setError(''); }}>로그인</button>
          <button type="button" aria-pressed={mode === 'signup'} className={'btn flex-1 ' + (mode === 'signup' ? 'btn-primary' : '')} onClick={() => { setMode('signup'); setMessage(''); setError(''); }}>가입</button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="flex flex-col gap-1 text-sm">
            <span>이메일 주소</span>
            <input className="input" type="email" autoComplete="email" required value={email}
              onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com"/>
          </label>
          {mode !== 'recovery' && (
            <label className="flex flex-col gap-1 text-sm">
              <span>비밀번호</span>
              <input className="input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)}/>
            </label>
          )}
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
          <button disabled={pending} className="btn btn-primary w-full min-h-11" type="submit">
            {pending ? '처리 중…' : mode === 'login' ? '로그인' : mode === 'signup' ? '이메일로 가입' : '재설정 메일 보내기'}
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between gap-2 text-sm">
          <button type="button" className="text-blue-600 underline" onClick={() => { setMode(mode === 'recovery' ? 'login' : 'recovery'); setError(''); setMessage(''); }}>
            {mode === 'recovery' ? '로그인으로 돌아가기' : '비밀번호를 잊으셨나요?'}
          </button>
          <Link className="text-gray-500 underline" href="/">파일럿 안내</Link>
        </div>
      </div>
    </section>
  );
}
