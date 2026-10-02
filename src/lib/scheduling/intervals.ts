import type { BusyInterval } from '@/types';

export type ConflictResult = { hasConflict: boolean; conflicts: BusyInterval[] };
export type FreeInterval = { start: Date; end: Date; durationMinutes: number };
export type FreeTimeResult = { window: { start: Date; end: Date }; busy: BusyInterval[]; free: FreeInterval[]; totalFreeMinutes: number };

export function intervalsOverlap(a: Pick<BusyInterval, 'start' | 'end'>, b: Pick<BusyInterval, 'start' | 'end'>): boolean {
  return a.start < b.end && b.start < a.end;
}

export function findConflicts(candidate: Pick<BusyInterval, 'start' | 'end'>, busyIntervals: BusyInterval[], exclude?: { source?: BusyInterval['source']; sourceId?: string }): ConflictResult {
  if (!(candidate.start < candidate.end)) return { hasConflict: false, conflicts: [] };
  const conflicts = busyIntervals.filter((interval) => {
    if (!(interval.start < interval.end)) return false;
    if (exclude?.sourceId && interval.sourceId === exclude.sourceId && (!exclude.source || interval.source === exclude.source)) return false;
    return intervalsOverlap(candidate, interval);
  });
  return { hasConflict: conflicts.length > 0, conflicts };
}

export function createLocalWindow(date: string, dayStart: string, dayEnd: string): { start: Date; end: Date } {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const startMatch = /^(\d{2}):(\d{2})$/.exec(dayStart);
  const endMatch = /^(\d{2}):(\d{2})$/.exec(dayEnd);
  if (!dateMatch || !startMatch || !endMatch) throw new Error('날짜와 활동 가능 시간을 확인해 주세요.');
  const parts = [Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])] as const;
  const start = new Date(parts[0], parts[1], parts[2], Number(startMatch[1]), Number(startMatch[2]));
  const end = new Date(parts[0], parts[1], parts[2], Number(endMatch[1]), Number(endMatch[2]));
  if (!(start < end)) throw new Error('활동 종료 시간은 시작 시간보다 늦어야 합니다.');
  return { start, end };
}

export function clipBusyIntervals(intervals: BusyInterval[], window: { start: Date; end: Date }): BusyInterval[] {
  return intervals.flatMap((interval) => {
    const start = new Date(Math.max(interval.start.getTime(), window.start.getTime()));
    const end = new Date(Math.min(interval.end.getTime(), window.end.getTime()));
    return start < end ? [{ ...interval, start, end }] : [];
  });
}

export function mergeBusyIntervals(intervals: BusyInterval[]): BusyInterval[] {
  const sorted = intervals.filter((item) => item.start < item.end).sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
  const merged: BusyInterval[] = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval });
    } else if (interval.end > previous.end) {
      previous.end = new Date(interval.end);
      previous.title = `${previous.title} 외`;
    }
  }
  return merged;
}

export function calculateFreeTime(input: { date: string; busyIntervals: BusyInterval[]; dayStart: string; dayEnd: string; minimumMinutes: number }): FreeTimeResult {
  const window = createLocalWindow(input.date, input.dayStart, input.dayEnd);
  const busy = mergeBusyIntervals(clipBusyIntervals(input.busyIntervals, window));
  const free: FreeInterval[] = [];
  let cursor = window.start;
  for (const interval of busy) {
    if (cursor < interval.start) {
      const durationMinutes = Math.round((interval.start.getTime() - cursor.getTime()) / 60000);
      if (durationMinutes >= input.minimumMinutes) free.push({ start: new Date(cursor), end: new Date(interval.start), durationMinutes });
    }
    if (interval.end > cursor) cursor = interval.end;
  }
  if (cursor < window.end) {
    const durationMinutes = Math.round((window.end.getTime() - cursor.getTime()) / 60000);
    if (durationMinutes >= input.minimumMinutes) free.push({ start: new Date(cursor), end: new Date(window.end), durationMinutes });
  }
  return { window, busy, free, totalFreeMinutes: free.reduce((sum, interval) => sum + interval.durationMinutes, 0) };
}
