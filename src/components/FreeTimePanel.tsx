'use client';

import { Clock3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store';
import { calculateFreeTime, getCombinedBusyIntervals } from '@/lib/scheduling';
import { DEFAULT_FREE_TIME_PREFERENCES, FREE_TIME_PREFERENCES_EVENT, getFreeTimePreferences, type FreeTimePreferences } from '@/lib/preferences/freeTime';
import { toLocalDateKey } from '@/lib/shifts';

function formatTime(date: Date) { return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }); }
function formatDuration(minutes: number) { const hours = Math.floor(minutes / 60); const rest = minutes % 60; return [hours ? `${hours}시간` : '', rest ? `${rest}분` : ''].filter(Boolean).join(' '); }

export default function FreeTimePanel({ date }: { date?: string }) {
  const tasks = useStore((state) => state.tasks);
  const assignments = useStore((state) => state.shiftAssignments);
  const shiftTypes = useStore((state) => state.shiftTypes);
  const [preferences, setPreferences] = useState<FreeTimePreferences>(DEFAULT_FREE_TIME_PREFERENCES);
  const targetDate = date || toLocalDateKey(new Date());
  useEffect(() => {
    setPreferences(getFreeTimePreferences());
    const update = (event: Event) => setPreferences((event as CustomEvent<FreeTimePreferences>).detail || getFreeTimePreferences());
    window.addEventListener(FREE_TIME_PREFERENCES_EVENT, update as EventListener);
    return () => window.removeEventListener(FREE_TIME_PREFERENCES_EVENT, update as EventListener);
  }, []);
  const result = useMemo(() => calculateFreeTime({
    date: targetDate,
    busyIntervals: getCombinedBusyIntervals(Object.values(tasks), Object.values(assignments), shiftTypes),
    dayStart: preferences.dayStartTime,
    dayEnd: preferences.dayEndTime,
    minimumMinutes: preferences.minimumFreeMinutes,
  }), [targetDate, tasks, assignments, shiftTypes, preferences]);
  const today = targetDate === toLocalDateKey(new Date());
  return <section className="card p-4" aria-label="빈 시간">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="flex items-center gap-2 font-medium"><Clock3 className="h-4 w-4 text-gray-500" />{today ? '오늘의 빈 시간' : `${targetDate} 빈 시간`}</h2><p className="mt-0.5 text-xs text-gray-500">{preferences.dayStartTime}–{preferences.dayEndTime} · {preferences.minimumFreeMinutes}분 이상</p></div>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">총 {formatDuration(result.totalFreeMinutes) || '0분'}</p>
    </div>
    {result.free.length > 0 ? <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{result.free.map((interval) => <div key={interval.start.toISOString()} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-slate-800"><p className="font-medium tabular-nums">{formatTime(interval.start)}–{formatTime(interval.end)}</p><p className="text-xs text-gray-500 dark:text-gray-400">{formatDuration(interval.durationMinutes)}</p></div>)}</div> : <p className="mt-3 text-sm text-gray-500">설정한 범위에 표시할 빈 시간이 없습니다.</p>}
  </section>;
}
