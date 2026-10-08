import type { ShiftAssignment } from '@/types';
import type { ShiftAssignmentInput } from './ShiftProvider';
import { addLocalDays } from './utils';

export type StagedShiftChanges = Record<string, string | null>;

export function advanceShiftDate(date: string): string {
  return addLocalDays(date, 1);
}

export function stageShiftChange(
  current: StagedShiftChanges,
  date: string,
  shiftTypeId: string | null,
): { changes: StagedShiftChanges; nextDate: string } {
  return {
    changes: { ...current, [date]: shiftTypeId },
    nextDate: advanceShiftDate(date),
  };
}

export function resolveShiftTypeId(
  date: string,
  persisted: Record<string, ShiftAssignment>,
  staged: StagedShiftChanges,
): string | null | undefined {
  if (Object.prototype.hasOwnProperty.call(staged, date)) return staged[date];
  return persisted[date]?.shiftTypeId;
}

export function materializeShiftChanges(
  staged: StagedShiftChanges,
  persisted: Record<string, ShiftAssignment>,
): { upserts: ShiftAssignmentInput[]; deleteDates: string[] } {
  const upserts: ShiftAssignmentInput[] = [];
  const deleteDates: string[] = [];

  for (const [date, shiftTypeId] of Object.entries(staged)) {
    const existingTypeId = persisted[date]?.shiftTypeId;
    if (shiftTypeId === null) {
      if (existingTypeId) deleteDates.push(date);
      continue;
    }
    if (shiftTypeId !== existingTypeId) upserts.push({ date, shiftTypeId });
  }

  upserts.sort((a, b) => a.date.localeCompare(b.date));
  deleteDates.sort();
  return { upserts, deleteDates };
}
