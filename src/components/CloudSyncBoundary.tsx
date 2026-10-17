'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { db } from '@/lib/db';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/browser';
import { createLocalBackup, restoreLocalBackup } from '@/lib/sync/backup';
import { subscribeToCloudChanges, syncNow } from '@/lib/sync/cloud';
import { useCloudSync } from '@/lib/sync/state';
import { switchPreferenceNamespace } from '@/lib/sync/preferences';
import { useStore } from '@/store';

const LEGACY_CLAIM_KEY = 'daymo:legacy-database-claimed-by';

type AuthUser = { id: string; email?: string };

async function selectUserDatabase(user: AuthUser): Promise<void> {
  const claimedBy = localStorage.getItem(LEGACY_CLAIM_KEY);
  switchPreferenceNamespace(user.id, !claimedBy);
  if (!claimedBy) {
    await db.selectDatabase('legacy');
    const { backup } = await createLocalBackup('legacy-before-account-migration', user.id);
    await db.selectDatabase(user.id);
    // The account database is new at this point. Restore the entire legacy snapshot
    // so customized defaults are preserved as well as tasks and assignments.
    await restoreLocalBackup(backup);
    localStorage.setItem(LEGACY_CLAIM_KEY, user.id);
  } else {
    await db.selectDatabase(user.id);
  }
  localStorage.setItem('daymo:last-auth-user', user.id);
}

export default function CloudSyncBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured());
  const [signedIn, setSignedIn] = useState(false);
  const [accessError, setAccessError] = useState<string>();
  const pathname = usePathname();
  const setSync = useCloudSync((state) => state.setState);
  const refresh = useStore((state) => state.refresh);
  const userRef = useRef<AuthUser | null>(null);

  const runSync = useCallback(async () => {
    const user = userRef.current;
    if (!user || !navigator.onLine) {
      setSync({ status: user ? 'offline' : 'disabled' });
      return;
    }
    setSync({ status: 'syncing', error: undefined, pending: (await db.listSyncOutbox()).length });
    try {
      await syncNow(user);
      await refresh();
      setSync({ status: 'synced', pending: (await db.listSyncOutbox()).length, lastSyncedAt: await db.getSyncState('last-sync-at') });
    } catch (cause) {
      setSync({ status: navigator.onLine ? 'error' : 'offline', pending: (await db.listSyncOutbox()).length, error: cause instanceof Error ? cause.message : String(cause) });
    }
  }, [refresh, setSync]);

  useEffect(() => {
    if (!isSupabaseConfigured()) { void db.selectDatabase('legacy').then(() => setReady(true)); setSync({ status:'disabled' }); return; }
    const client = getSupabaseBrowserClient()!;
    let active = true;
    let activatedUser: string | null | undefined;
    let activationQueue = Promise.resolve();
    let unsubscribeCloud = () => {};
    let interval: ReturnType<typeof setInterval> | undefined;
    const activate = async (user: AuthUser | null) => {
      const nextUser = user?.id ?? null;
      if (activatedUser === nextUser) return;
      activatedUser = nextUser;
      unsubscribeCloud(); clearInterval(interval);
      userRef.current = user;
      if (user) {
        setSignedIn(true);
        setAccessError(undefined);
        setReady(false); setSync({ status:'checking', userId:user.id, email:user.email, error:undefined });
        await selectUserDatabase(user);
        if (!active) return;
        setReady(true);
        await runSync();
        unsubscribeCloud = subscribeToCloudChanges(user, () => void runSync());
        interval = setInterval(() => void runSync(), 30_000);
      } else {
        setSignedIn(false);
        setAccessError(undefined);
        localStorage.removeItem('daymo:last-auth-user');
        if (!active) return;
        setSync({ status:'disabled', userId:undefined, email:undefined, pending:0, error:undefined });
        setReady(true);
      }
    };
    const scheduleActivation = (user: AuthUser | null) => {
      activationQueue = activationQueue.then(() => activate(user)).catch((cause) => {
        if (active) {
          activatedUser = undefined;
          const message = cause instanceof Error ? cause.message : String(cause);
          setAccessError(message);
          setReady(true);
          setSync({ status:'error', error:message });
        }
      });
    };
    void client.auth.getUser().then(({ data }: any) => scheduleActivation(data.user));
    const { data: listener } = client.auth.onAuthStateChange((_event: string, session: any) => { scheduleActivation(session?.user || null); });
    const onOnline = () => void runSync();
    const onVisibility = () => { if (document.visibilityState === 'visible') void runSync(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('daymo-sync-request', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false; unsubscribeCloud(); clearInterval(interval); listener.subscription.unsubscribe();
      window.removeEventListener('online', onOnline); window.removeEventListener('daymo-sync-request', onOnline); document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [runSync, setSync]);

  if (!ready) return <div role="status" className="mx-auto max-w-lg py-24 text-center text-sm text-slate-600">개인 데이터를 안전하게 준비하고 있습니다…</div>;
  const authPage = pathname === '/login' || pathname === '/account' || pathname === '/auth/reset-password';
  if (accessError && !authPage) {
    return (
      <section role="alert" className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">개인 데이터를 열지 못했습니다</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">다른 계정의 데이터가 보이지 않도록 앱을 잠갔습니다. 연결을 확인한 뒤 다시 시도해 주세요.</p>
        <p className="mt-2 break-words text-xs text-red-600">{accessError}</p>
        <button type="button" className="btn btn-primary mt-6 min-h-11 px-6" onClick={() => window.location.reload()}>다시 시도</button>
      </section>
    );
  }
  if (isSupabaseConfigured() && !signedIn && !authPage) {
    return (
      <section className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Daymo에 로그인해 주세요</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">개인 일정과 할 일은 로그인한 계정의 로컬 OPFS와 클라우드에서만 열립니다.</p>
        <Link href="/login" className="btn btn-primary mt-6 min-h-11 px-6">로그인</Link>
      </section>
    );
  }
  return <>{children}</>;
}
