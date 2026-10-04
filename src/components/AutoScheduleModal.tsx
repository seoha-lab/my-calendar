'use client';

import { AlertTriangle, CalendarClock, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { findConflicts, getCombinedBusyIntervals, scheduleTasks, type BatchScheduleResult } from '@/lib/scheduling';
import { getFreeTimePreferences } from '@/lib/preferences/freeTime';
import { toast } from '@/lib/toast';

function duration(minutes: number) { const hours = Math.floor(minutes / 60); const rest = minutes % 60; return [hours ? `${hours}시간` : '', rest ? `${rest}분` : ''].filter(Boolean).join(' ') || '0분'; }
function dateLabel(date: Date) { return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }); }
function timeLabel(date: Date) { return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }); }

export default function AutoScheduleModal() {
  const tasks = useStore((state) => state.tasks);
  const assignments = useStore((state) => state.shiftAssignments);
  const shiftTypes = useStore((state) => state.shiftTypes);
  const addRangesBatch = useStore((state) => state.addRangesBatch);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<BatchScheduleResult | null>(null);
  const [allowPartial, setAllowPartial] = useState(false);
  const [saving, setSaving] = useState(false);

  const calculate = (taskId?: string) => {
    const all = Object.values(useStore.getState().tasks);
    const selected = taskId ? all.filter((task) => task.id === taskId) : all.filter((task) => !task.checked && task.stage !== 'done' && !!task.deadline && !!task.estimatedMinutes);
    const state = useStore.getState();
    setPreview(scheduleTasks(selected, getCombinedBusyIntervals(Object.values(state.tasks), Object.values(state.shiftAssignments), state.shiftTypes), getFreeTimePreferences(), new Date()));
    setAllowPartial(false);
    setOpen(true);
  };

  useEffect(() => {
    const onOpen = (event: Event) => calculate((event as CustomEvent<{ taskId?: string }>).detail?.taskId);
    window.addEventListener('open-auto-schedule', onOpen as EventListener);
    return () => window.removeEventListener('open-auto-schedule', onOpen as EventListener);
  }, []);

  const save = async () => {
    if (!preview) return;
    const accepted = preview.results.filter((result) => result.blocks.length > 0 && (result.fullyScheduled || allowPartial));
    if (accepted.length === 0) return;
    const currentBusy = getCombinedBusyIntervals(Object.values(tasks), Object.values(assignments), shiftTypes);
    const changed = accepted.some((result) => result.blocks.some((block) => findConflicts(block, currentBusy).hasConflict));
    if (changed) { toast('추천 이후 일정이 변경되어 충돌이 발생했습니다. 다시 계산해 주세요.'); return; }
    setSaving(true);
    try {
      await addRangesBatch(accepted.map((result) => ({ taskId: result.taskId, ranges: result.blocks.map((block) => ({ start: block.start.toISOString(), end: block.end.toISOString(), allDay: false })) })));
      toast(`Task ${accepted.length}개의 시간 블록을 저장했습니다.`);
      setOpen(false);
    } catch (error) { toast((error as Error).message || '자동 배치 저장에 실패했습니다.'); }
    finally { setSaving(false); }
  };

  if (!open) return null;
  const incomplete = preview?.results.some((result) => !result.fullyScheduled && result.blocks.length > 0) ?? false;
  const saveable = preview?.results.some((result) => result.blocks.length > 0 && (result.fullyScheduled || allowPartial)) ?? false;
  return <div role="dialog" aria-modal="true" aria-labelledby="auto-schedule-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3 dark:bg-black/60" onMouseDown={() => setOpen(false)}>
    <div className="card max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto p-4 sm:p-5" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-gray-500">저장 전 Preview</p><h2 id="auto-schedule-title" className="mt-1 flex items-center gap-2 text-lg font-semibold"><CalendarClock className="h-5 w-5" />빈 시간에 자동 배치</h2></div><button className="btn btn-icon btn-ghost" aria-label="닫기" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
      <div className="mt-4 space-y-4">
        {!preview || preview.results.length === 0 ? <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">마감일과 예상 소요시간이 설정된 미완료 Task가 없습니다.</p> : preview.results.map((result) => <section key={result.taskId} className="rounded-xl border border-gray-200 p-3 dark:border-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{result.title}</h3><p className="text-xs text-gray-500">필요 {duration(result.requiredMinutes)} · 배치 {duration(result.scheduledMinutes)}</p></div><span className={`rounded-full px-2 py-1 text-xs font-medium ${result.fullyScheduled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{result.fullyScheduled ? '전체 배치 가능' : `부족 ${duration(result.shortageMinutes)}`}</span></div>
          {result.reason && <p className="mt-3 flex items-center gap-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" />{result.reason}</p>}
          {result.blocks.length > 0 && <div className="mt-3 space-y-2">{result.blocks.map((block, index) => <div key={`${result.taskId}:${index}`} className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"><p className="text-sm font-medium">{dateLabel(block.start)}</p><p className="text-sm tabular-nums">{timeLabel(block.start)}–{timeLabel(block.end)} <span className="text-xs text-gray-500">· {duration(block.minutes)} · Preview</span></p></div>)}</div>}
        </section>)}
      </div>
      {incomplete && <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><input className="mt-0.5" type="checkbox" checked={allowPartial} onChange={(event) => setAllowPartial(event.target.checked)} /><span>전체 배치가 불가능한 Task도 표시된 시간만 일부 배치합니다.</span></label>}
      <div className="mt-5 flex justify-end gap-2"><button className="btn" onClick={() => setOpen(false)}>취소</button><button className="btn btn-primary min-h-11" disabled={!saveable || saving} onClick={() => void save()}>{saving ? '저장 중…' : '이 일정으로 배치'}</button></div>
    </div>
  </div>;
}
