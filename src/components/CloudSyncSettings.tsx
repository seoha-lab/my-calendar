'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Cloud, Download, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import { createLocalBackup, downloadBackup, restoreLocalBackup } from '@/lib/sync/backup';
import { useCloudSync } from '@/lib/sync/state';
import { useStore } from '@/store';
import { toast } from '@/lib/toast';

const STATUS_LABEL = { disabled:'로그인 필요', checking:'확인 중', offline:'오프라인 · 변경사항 보관 중', syncing:'동기화 중', synced:'동기화됨', error:'동기화 오류' } as const;

export default function CloudSyncSettings() {
  const sync = useCloudSync();
  const refresh = useStore((state) => state.refresh);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const backup = async () => {
    setBusy(true);
    try {
      const result = await createLocalBackup('manual-download', sync.userId);
      downloadBackup(result.backup);
      toast('백업 파일을 만들었습니다.');
    } catch (error) { toast(error instanceof Error ? error.message : '백업에 실패했습니다.'); }
    finally { setBusy(false); }
  };

  const restore = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      await restoreLocalBackup(JSON.parse(await file.text()));
      await refresh();
      window.dispatchEvent(new Event('daymo-sync-request'));
      toast('백업을 복구했습니다. 동기화를 다시 확인합니다.');
    } catch (error) { toast(error instanceof Error ? error.message : '복구에 실패했습니다.'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <section className="card p-5" aria-labelledby="cloud-sync-heading">
      <div className="flex items-start gap-3">
        <Cloud className="mt-0.5 h-5 w-5 text-blue-600" />
        <div className="min-w-0 flex-1">
          <h2 id="cloud-sync-heading" className="font-semibold">클라우드 동기화와 백업</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">기기 안의 OPFS 데이터는 계속 기본 저장소로 사용하며, 로그인하면 내 Supabase 계정과 안전하게 맞춥니다.</p>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /><strong>{STATUS_LABEL[sync.status]}</strong></div>
            {sync.email && <p className="mt-1 truncate text-xs text-slate-500">{sync.email}</p>}
            {sync.pending > 0 && <p className="mt-1 text-xs">전송 대기 {sync.pending}건</p>}
            {sync.lastSyncedAt && <p className="mt-1 text-xs text-slate-500">마지막 완료 {new Date(sync.lastSyncedAt).toLocaleString('ko-KR')}</p>}
            {sync.error && <p role="alert" className="mt-2 text-xs text-red-600">{sync.error}</p>}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {sync.userId ? <button type="button" className="btn min-h-11" onClick={() => window.dispatchEvent(new Event('daymo-sync-request'))} disabled={sync.status === 'syncing'}><RefreshCw className="h-4 w-4" /> 지금 동기화</button> : <Link href="/login" className="btn min-h-11">로그인</Link>}
            <button type="button" className="btn min-h-11" onClick={() => void backup()} disabled={busy}><Download className="h-4 w-4" /> 백업 다운로드</button>
            <button type="button" className="btn min-h-11" onClick={() => fileRef.current?.click()} disabled={busy}><Upload className="h-4 w-4" /> 백업 복구</button>
          </div>
          <input ref={fileRef} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => void restore(event.target.files?.[0])} />
          <p className="mt-3 text-xs leading-5 text-slate-500">최초 동기화와 복구 직전에는 앱 내부에도 자동 백업이 남습니다. 복구는 현재 기기의 데이터를 바꾸므로 다운로드 백업을 별도로 보관하는 것을 권장합니다.</p>
        </div>
      </div>
    </section>
  );
}
