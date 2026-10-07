'use client';

import type { Task, TaskPriority } from '@/types';
import { getFreeTimePreferences } from '@/lib/preferences/freeTime';

export type TaskSchedulingValue = Partial<Pick<Task, 'deadline' | 'priority'>>;

function localDeadline(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function deadlineParts(value?: string) {
  if (!value) return { date: '', time: '' };
  const date = new Date(value);
  return { date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` };
}

export default function TaskSchedulingFields({ value, onChange }: { value: TaskSchedulingValue; onChange: (patch: TaskSchedulingValue) => void }) {
  const deadline = deadlineParts(value.deadline);
  const setDeadline = (date: string, time?: string) => onChange({ deadline: date ? localDeadline(date, time || deadline.time || getFreeTimePreferences().dayEndTime) : undefined });
  return <section className="space-y-3 rounded-xl bg-gray-50 p-3 dark:bg-slate-800/60">
    <div><p className="text-sm font-medium">계획 정보</p><p className="text-xs text-gray-500">마감일과 우선순위만 선택하면 됩니다.</p></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm"><span>마감일</span><input className="input" type="date" value={deadline.date} onChange={(event) => setDeadline(event.target.value)} /></label>
      <label className="flex flex-col gap-1 text-sm"><span>마감 시간</span><input className="input" type="time" disabled={!deadline.date} value={deadline.time} onChange={(event) => setDeadline(deadline.date, event.target.value)} /></label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2"><span>우선순위</span><select className="input" value={value.priority ?? 'medium'} onChange={(event) => onChange({ priority: event.target.value as TaskPriority })}><option value="high">높음</option><option value="medium">보통</option><option value="low">낮음</option></select></label>
    </div>
  </section>;
}
