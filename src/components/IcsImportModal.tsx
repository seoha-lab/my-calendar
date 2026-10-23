'use client';

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarPlus, Check, FileUp, Loader2, X } from 'lucide-react';
import CategorySelect from '@/components/CategorySelect';
import { db } from '@/lib/db';
import { parseAppleIcs } from '@/lib/ics/parser';
import type { IcsParseResult, ParsedIcsEvent } from '@/lib/ics/types';
import type { EventCategory } from '@/lib/calendar/categories';
import { createLocalBackup, downloadBackup } from '@/lib/sync/backup';
import { useCloudSync } from '@/lib/sync/state';
import { toast } from '@/lib/toast';
import { useStore } from '@/store';

type Props = { open: boolean; onClose: () => void };

function localDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftedYear(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return localDateInput(date);
}

function eventLabel(event: ParsedIcsEvent): string {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (event.allDay) {
    const endInclusive = new Date(end.getTime() - 1);
    const first = start.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
    const last = endInclusive.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
    return first === last ? `${first} · 종일` : `${first}–${last} · 종일`;
  }
  const day = start.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
  const time = start.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });
  const endTime = end.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });
  const nextDay = start.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) !== end.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  return `${day} · ${time}–${nextDay ? '익일 ' : ''}${endTime}`;
}

export default function IcsImportModal({ open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = useStore((state) => state.refresh);
  const syncUserId = useCloudSync((state) => state.userId);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [from, setFrom] = useState(() => shiftedYear(-5));
  const [to, setTo] = useState(() => shiftedYear(5));
  const [result, setResult] = useState<IcsParseResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<EventCategory>('personal');
  const [separateCalendar, setSeparateCalendar] = useState(true);
  const [downloadSafetyBackup, setDownloadSafetyBackup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const available = useMemo(() => result?.events.filter((event) => event.importable && !duplicates.has(event.key)) ?? [], [duplicates, result]);
  const selectedEvents = useMemo(() => available.filter((event) => selected.has(event.key)), [available, selected]);

  const preview = async (text: string) => {
    setBusy(true);
    setError(undefined);
    try {
      const parsed = parseAppleIcs(text, { recurringFrom: from, recurringTo: to, defaultTimeZone: 'Asia/Seoul' });
      const existing = new Set(await db.listImportedEventKeys());
      setResult(parsed);
      setDuplicates(existing);
      setSelected(new Set(parsed.events.filter((event) => event.importable && !existing.has(event.key)).map((event) => event.key)));
    } catch (caught) {
      setResult(null);
      setSelected(new Set());
      setError(caught instanceof Error ? caught.message : 'ICS 파일을 읽지 못했습니다.');
    } finally { setBusy(false); }
  };

  const chooseFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError('20MB 이하의 ICS 파일을 선택해 주세요.');
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    setRawText(text);
    await preview(text);
    if (fileRef.current) fileRef.current.value = '';
  };

  const importSelected = async () => {
    if (!result || selectedEvents.length === 0) return;
    setBusy(true);
    setError(undefined);
    try {
      const safety = await createLocalBackup('before-apple-ics-import', syncUserId);
      if (downloadSafetyBackup) downloadBackup(safety.backup);
      const calendarId = separateCalendar ? result.calendar.id : 'local';
      const imported = await db.importIcsEvents(
        { id: calendarId, title: separateCalendar ? result.calendar.name : '내 일정', enabled: true, kind: 'local' },
        selectedEvents.map((event) => ({ ...event, category, calendarId })),
      );
      await refresh();
      window.dispatchEvent(new Event('daymo-sync-request'));
      const skipped = imported.skipped ? `, 중복 ${imported.skipped}개 제외` : '';
      toast(`Apple Calendar 일정 ${imported.created}개를 가져왔습니다${skipped}.`);
      const allImported = new Set([...duplicates, ...selectedEvents.map((event) => event.key)]);
      setDuplicates(allImported);
      setSelected(new Set());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '가져오기에 실패했습니다. 변경사항은 저장되지 않았습니다.');
    } finally { setBusy(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="ics-import-title">
      <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-3xl sm:rounded-2xl dark:bg-slate-950">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5 dark:border-slate-800">
          <div className="min-w-0">
            <h2 id="ics-import-title" className="flex items-center gap-2 font-semibold"><CalendarPlus className="h-5 w-5" /> Apple Calendar ICS 가져오기</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">미리보기에서 선택한 일정만 기존 데이터에 추가합니다.</p>
          </div>
          <button type="button" className="btn btn-icon min-h-11 min-w-11" onClick={onClose} aria-label="ICS 가져오기 닫기"><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center dark:border-slate-700">
            <input ref={fileRef} className="sr-only" type="file" accept=".ics,text/calendar" onChange={(event) => void chooseFile(event.target.files?.[0])} />
            <button type="button" className="btn min-h-11" onClick={() => fileRef.current?.click()} disabled={busy}><FileUp className="h-4 w-4" /> .ics 파일 선택</button>
            <p className="mt-2 text-xs text-slate-500">{fileName || 'Apple Calendar에서 내보낸 파일을 선택해 주세요.'}</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-sm"><span className="mb-1 block text-slate-600 dark:text-slate-300">반복 일정 시작</span><input className="input w-full" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-600 dark:text-slate-300">반복 일정 종료</span><input className="input w-full" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
            <button type="button" className="btn min-h-11 self-end" disabled={!rawText || busy} onClick={() => void preview(rawText)}>기간 다시 적용</button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">단일 일정은 모두 읽고, 무기한 반복 일정은 위 기간 안에서 펼칩니다. RRULE·EXDATE·RECURRENCE-ID 원문도 함께 보존합니다.</p>

          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</p>}
          {busy && !result && <div className="mt-6 flex items-center justify-center gap-2 py-8 text-sm text-slate-500" role="status"><Loader2 className="h-4 w-4 animate-spin" /> 파일을 분석하고 있습니다…</div>}

          {result && <>
            <section className="mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-900" aria-label="캘린더 분류와 색상 매핑">
              <div className="flex flex-wrap items-center gap-2">
                {result.calendar.color && <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: result.calendar.color }} aria-label={`원본 색상 ${result.calendar.color}`} />}
                <strong className="text-sm">{result.calendar.name}</strong>
                <span className="text-xs text-slate-500">원본 일정 {result.events.length}개 · 중복 {result.events.filter((event) => duplicates.has(event.key)).length}개</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CategorySelect value={category} onChange={setCategory} label="Daymo 카테고리·색상" />
                <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700"><input type="checkbox" checked={separateCalendar} onChange={(event) => setSeparateCalendar(event.target.checked)} /> 원본 캘린더 이름으로 분류</label>
              </div>
            </section>

            {(result.warnings.length > 0) && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">{result.warnings.map((warning) => <p key={warning}>• {warning}</p>)}</div>}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">가져오기 미리보기 <span className="text-sm font-normal text-slate-500">{selectedEvents.length}개 선택</span></h3>
              <div className="flex gap-2"><button type="button" className="btn min-h-10" onClick={() => setSelected(new Set(available.map((event) => event.key)))}>모두 선택</button><button type="button" className="btn min-h-10" onClick={() => setSelected(new Set())}>선택 해제</button></div>
            </div>
            <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {result.events.length === 0 && <p className="p-5 text-center text-sm text-slate-500">이 기간에 가져올 일정이 없습니다.</p>}
              {result.events.map((event) => {
                const duplicate = duplicates.has(event.key);
                const disabled = duplicate || !event.importable;
                return <label key={event.key} className={`flex gap-3 p-3 sm:p-4 ${disabled ? 'bg-slate-50 text-slate-500 dark:bg-slate-900' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
                  <input className="mt-1 h-5 w-5 shrink-0" type="checkbox" checked={selected.has(event.key)} disabled={disabled} onChange={(change) => setSelected((current) => { const next = new Set(current); if (change.target.checked) next.add(event.key); else next.delete(event.key); return next; })} aria-label={`${event.title} 가져오기`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2"><strong className="break-words text-sm">{event.title}</strong>{duplicate && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] dark:bg-slate-700">이미 가져옴</span>}{event.recurrenceRule && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 dark:bg-blue-950 dark:text-blue-200">반복</span>}</span>
                    <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{eventLabel(event)}</span>
                    {event.location && <span className="mt-1 block text-xs text-slate-500">장소 · {event.location}</span>}
                    {event.description && <span className="mt-1 line-clamp-2 block text-xs text-slate-500">{event.description}</span>}
                    {event.warnings.map((warning) => <span key={warning} className="mt-1 block text-xs text-amber-700 dark:text-amber-300">⚠ {warning}</span>)}
                  </span>
                </label>;
              })}
            </div>
          </>}
        </div>

        <footer className="border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <label className="mb-3 flex min-h-10 items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={downloadSafetyBackup} onChange={(event) => setDownloadSafetyBackup(event.target.checked)} /> 가져오기 직전 백업 파일 다운로드</label>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <button type="button" className="btn min-h-11" onClick={onClose} disabled={busy}>취소</button>
            <button type="button" className="btn-primary min-h-11" onClick={() => void importSelected()} disabled={busy || selectedEvents.length === 0}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} 선택한 {selectedEvents.length}개 가져오기</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
