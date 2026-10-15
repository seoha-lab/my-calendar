'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Authentication-only Preview mode, intentionally hiding all pre-migration
 * local calendar data. Never mix different signed-in accounts with the
 * existing shared-per-origin SQLite OPFS store.
 */
export default function AuthPreviewGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const allowed = path === '/login' || path === '/account' || path === '/auth/reset-password';
  if (allowed) return <>{children}</>;

  return (
    <section className="mx-auto max-w-xl py-14 sm:py-24">
      <div className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
        <p className="text-sm font-semibold text-blue-600">Daymo · 로그인 파일럿</p>
        <h1 className="mt-2 text-2xl font-semibold">Daymo 계정 로그인 테스트</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
          이 개발용 페이지에서는 이메일 인증 및 개인 DB 접근제어만 검증합니다.
          브라우저에 저장한 기존 일정·할 일·근무표는 열지 않습니다.
          클라우드 이전·기기간 동기화·자동 백업은 아직 제공되지 않습니다.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login" className="btn btn-primary min-h-11 px-5">로그인 및 가입</Link>
          <Link href="/account" className="btn min-h-11 px-5">로그인 상태 확인</Link>
        </div>
      </div>
    </section>
  );
}
