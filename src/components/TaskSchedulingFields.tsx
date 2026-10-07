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
    <div><p className="text-sm font-medium">계획 정보</p><p className="text-xs text-gray-500">시간 없는 마감일은 활동 종료시간을 q^