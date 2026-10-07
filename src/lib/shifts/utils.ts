import type { ShiftAssignment, ShiftType } from '@/types';

export type ShiftInterval = { start: Date; end: Date };

function parseDateKey(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid local date: ${date}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) {
    throw new Error(`Invalid local date: ${date}`);
  }
  return { year, month, day };
}

function parseTime(value: string | null): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? '');
  if (!match) throw new Error(`Invalid shift time: ${value ?? ''}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid shift time: ${value}`);
  return { hour, minute };
}

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addLocalDays(date: string, amount: number): string {
  const { year, month, day } = parseDateKey(date);
  return toLocalDateKey(new Date(year, month - 1, day + amount));
}

/** Converts a local shift-start date into a real local-time interval. OFF returns null. */
export function getShiftInterval(date: string, shiftType: ShiftType): ShiftInterval | null {
  parseDateKey(date);
  if (shiftType.isOff) return null;
  const startTime = parseTime(shiftType.startTime);
  const endTime = parseTime(shiftType.endTime);
  const { year, month, day } = parseDateKey(date);
  const start = new Date(year, month - 1, day, startTime.hour, startTime.minute);
  const end = new Date(year, month - 1, day + (shiftType.crossesMidnight ? 1 : 0), endTime.hour, endTime.minute);
  if (end.getTime() <= start.getTime()) throw new Error(`Shift ${shiftType.code} must end after it starts`);
  return { start, end };
}

export function buildShiftPattern(startDate: string, shiftTypeIds: string[], repetitions: number) {
  parseDateKey(startDate);
  if (shiftTypeIds.length === 0) throw new Error('Shift pattern is empty');
  if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error('Repetitions must be a positive integer');
  return Array.from({ length: shiftTypeIds.length * repetitions }, (_, index) => ({
    date: addLocalDays(startDate, index),
    shiftTypeId: shiftTypeIds[index % shiftTypeIds.length],
  }));
}

export function shiftAssignmentToCalendarEvent(assignment: ShiftAssignment, shiftType: ShiftType) {
  const interval = getShiftInterval(assignment.date, shiftType);
  const timeLabel = shiftType.isOff
    ? '근무시간 없음'
    : `${shiftType.startTime}–${shiftType.crossesMidnight ? '익일 ' : ''}${shiftType.endTime}`;
  if (!interval) {
    return {
      id: `shift:${assignment.id}`,
      title: shiftType.code,
      start: assignment.date,
      end: addLocalDays(assignment.date, 1),
      allDay: true,
      editable: false,
      extendedProps: { kind: 'shift', category: 'hospital', assignmentId: assignment.id, shiftTypeId: shiftType.id, shiftDate: assignment.date, shiftCode: shiftType.code, shiftName: shiftType.name, shiftTimeLabel: timeLabel },
    };
  }
  return {
    id: `shift:${assignment.id}`,
    title: shiftType.code,
    // Visual calendar placement stays on the assigned date; busy-time logic still uses getShiftInterval().
    start: assignment.date,
    end: addLocalDays(assignment.date, 1),
    allDay: true,
    editable: false,
    extendedProps: { kind: 'shift', category: 'hospital', assignmentId: assignment.id, shiftTypeId: shiftType.id, shiftDate: assignment.date, shiftCode: shiftType.code, shiftName: shiftType.name, shiftTimeLabel: timeLabel },
  };
}
