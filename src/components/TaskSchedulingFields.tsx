'use client';

import type { Task, TaskPriority } from '@/types';
import { getFreeTimePreferences } from '@/lib/preferences/freeTime';

export type TaskSchedulingValue = Partial<Pick<Task, 'deadline' | 'estimatedMinutes' | 'priority'>>;

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
  const quickMinutes = [30, 60, 90, 120, 180];
  return <section className="space-y-3 rounded-xl bg-gray-50 p-3 dark:bg-slate-800/60">
    <div><p className="text-sm font-medium">계획 정보</p><p className="text-xs text-gray-500">시간 없는 마감일은 활동 종료시간을 사용합니다.</p></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm"><span>마감일</span><input className="input" type="date" value={deadline.date} onChange={(event) => setDeadline(event.target.value)} /></label>
      <label className="flex flex-col gap-1 text-sm"><span>마감 시간</span><input className="input" type="time" disabled={!deadline.date} value={deadline.time} onChange={(event) => setDeadline(deadline.date, event.target.value)} /></label>
      <label className="flex flex-col gap-1 text-sm"><span>예상 소요시간(분)</span><input className="input" type="number" min={5} step={5} value={value.estimatedMinutes ?? ''} onChange={(event) => onChange({ estimatedMinutes: event.target.value ? Math.max(1, Math.round(Number(event.target.value))) : undefined })} placeholder="예: 90" /></label>
      <label className="flex flex-col gap-1 text-sm"><span>우선순위</span><select className="input" value={value.priority ?? 'medium'} onChange={(event) => onChange({ priority: event.target.value as TaskPriority })}><option value="high">높음</option><option value="medium">보통</option><option value="low">낮음</option></select></label>
    </div>
    <div className="flex flex-wrap gap-1.5">{quickMinutes.map((minutes) => <button type="button" key={minutes} className="btn h-8 px-2.5 text-xs" onClick={() => onChange({ estimatedMinutes: minutes })}>{minutes < 60 ? `${minutes}분` : `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}`}</button>)}</div>
  </section>;
}
