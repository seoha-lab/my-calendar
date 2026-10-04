import type { BusyInterval, Task, TaskPriority } from '@/types';
import type { FreeTimePreferences } from '@/lib/preferences/freeTime';
import { addLocalDays, toLocalDateKey } from '@/lib/shifts/utils';
import { calculateFreeTime } from './intervals';

export type ScheduledBlock = { taskId: string; start: Date; end: Date; minutes: number };
export type TaskScheduleResult = {
  taskId: string;
  title: string;
  requiredMinutes: number;
  scheduledMinutes: number;
  shortageMinutes: number;
  blocks: ScheduledBlock[];
  fullyScheduled: boolean;
  reason?: string;
};
export type BatchScheduleResult = { results: TaskScheduleResult[]; fullyScheduled: boolean };

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export function calculateScheduledMinutes(task: Task): number {
  const ranges = task.ranges?.length ? task.ranges : (task.start && task.end ? [{ start: task.start, end: task.end }] : []);
  return ranges.reduce((total, range) => {
    const duration = (new Date(range.end).getTime() - new Date(range.start).getTime()) / 60000;
    return total + (Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0);
  }, 0);
}

export function calculateRemainingMinutes(task: Task): number {
  return Math.max(0, (task.estimatedMinutes ?? 0) - calculateScheduledMinutes(task));
}

export function rankTasksForScheduling(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const priority = PRIORITY_ORDER[a.priority ?? 'medium'] - PRIORITY_ORDER[b.priority ?? 'medium'];
    if (priority) return priority;
    const aDeadline = Date.parse(a.deadline ?? '');
    const bDeadline = Date.parse(b.deadline ?? '');
    const deadline = (Number.isFinite(aDeadline) ? aDeadline : Number.POSITIVE_INFINITY)
      - (Number.isFinite(bDeadline) ? bDeadline : Number.POSITIVE_INFINITY);
    if (deadline) return deadline;
    return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  });
}

export function isSchedulableTask(task: Task, now: Date): { ok: boolean; reason?: string } {
  if (task.checked || task.stage === 'done') return { ok: false, reason: '완료된 Task입니다.' };
  if (!task.estimatedMinutes || task.estimatedMinutes <= 0) return { ok: false, reason: '예상 소요시간이 없습니다.' };
  if (!task.deadline) return { ok: false, reason: '마감일이 없습니다.' };
  const deadline = new Date(task.deadline);
  if (!Number.isFinite(deadline.getTime())) return { ok: false, reason: '마감일을 확인해 주세요.' };
  if (deadline <= now) return { ok: false, reason: '마감 시간이 이미 지났습니다.' };
  if (calculateRemainingMinutes(task) <= 0) return { ok: false, reason: '필요한 시간이 이미 모두 배치되었습니다.' };
  return { ok: true };
}

export function scheduleTasks(tasks: Task[], busyIntervals: BusyInterval[], preferences: FreeTimePreferences, now = new Date()): BatchScheduleResult {
  const virtualBusy = [...busyIntervals];
  const results = rankTasksForScheduling(tasks).map((task) => {
    const requiredMinutes = calculateRemainingMinutes(task);
    const eligibility = isSchedulableTask(task, now);
    if (!eligibility.ok) return { taskId: task.id, title: task.title, requiredMinutes, scheduledMinutes: 0, shortageMinutes: requiredMinutes, blocks: [], fullyScheduled: false, reason: eligibility.reason };
    const deadline = new Date(task.deadline!);
    const blocks: ScheduledBlock[] = [];
    let remaining = requiredMinutes;
    let date = toLocalDateKey(now);
    const deadlineDate = toLocalDateKey(deadline);
    let guard = 0;
    while (date <= deadlineDate && remaining > 0 && guard < 3660) {
      const result = calculateFreeTime({ date, busyIntervals: virtualBusy, dayStart: preferences.dayStartTime, dayEnd: preferences.dayEndTime, minimumMinutes: preferences.minimumFreeMinutes });
      for (const free of result.free) {
        let start = free.start;
        if (date === toLocalDateKey(now) && start < now) start = new Date(Math.ceil(now.getTime() / 60000) * 60000);
        const endLimit = new Date(Math.min(free.end.getTime(), deadline.getTime()));
        const available = Math.floor((endLimit.getTime() - start.getTime()) / 60000);
        if (available < preferences.minimumFreeMinutes) continue;
        const minutes = Math.min(remaining, available);
        if (minutes < preferences.minimumFreeMinutes) continue;
        const end = new Date(start.getTime() + minutes * 60000);
        blocks.push({ taskId: task.id, start: new Date(start), end, minutes });
        remaining -= minutes;
        if (remaining === 0) break;
      }
      date = addLocalDays(date, 1);
      guard += 1;
    }
    for (const [index, block] of blocks.entries()) virtualBusy.push({ source: 'task', sourceId: `preview:${task.id}:${index}`, title: task.title, category: task.category, start: block.start, end: block.end });
    const scheduledMinutes = blocks.reduce((sum, block) => sum + block.minutes, 0);
    return { taskId: task.id, title: task.title, requiredMinutes, scheduledMinutes, shortageMinutes: Math.max(0, requiredMinutes - scheduledMinutes), blocks, fullyScheduled: scheduledMinutes === requiredMinutes };
  });
  return { results, fullyScheduled: results.every((result) => result.fullyScheduled) };
}
