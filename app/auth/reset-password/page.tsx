'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (password !== again) { setError('입력한 비밀번호가 서로 다릅니다.'); return; }
    const client = getSupabaseBrowserClient();
    if (!client) { setError('Supabase 연결이 설정되지 않았습니다.'); return; }
    setPending(true);
    try {
      const { data: { user }, error: sessionError } = await client.auth.getUser();
      if (sessionError || !user) throw new Error('비밀번호 재설정 링크가 만료되었습니다. 새 링크를 요청해 주세요.');
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.replace('/account');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '재설정에 실패했습니다.');
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="mx-auto max-w-md py-12 sm:py-20" aria-label="비밀번호 재설정">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm font-semibold text-blue-600">Daymo · 인증 파일럿</p>
        <h1 className="mt-2 text-2xl font-semibold">새 비밀번호 설정</h1>
        <p className="mt-2 text-sm text-gray-500">이메일로 받은 비밀번호 재설정 링크에서 접속해 주세요.</p>
        <form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="flex flex-col gap-1 text-sm">
            <span>새 비밀번호</span>
            <input type="password" className="input" autoComplete="new-password" required minLength={6}
              value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>새 비밀번호 확인</span>
            <input type="password" className="input" autoComplete="new-password" required minLength={6}
              value={again} onChange={(event) => setAgain(event.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button className="btn btn-primary min-h-11 w-full" disabled={pending} type="submit">
            {pending ? '설정 중…' : '비밀번호 변경'}
          </button>
        </form>
        <Link href="/login" className="mt-4 block text-sm text-blue-600 underline">로그인으로 돌아가기</Link>
      </div>
    </section>
  );
}
