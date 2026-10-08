import type { ShiftAssignment, ShiftType } from '@/types';

export interface ShiftAssignmentInput {
  date: string;
  shiftTypeId: string;
}

export interface ShiftTypeInput {
  code: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  crossesMidnight: boolean;
  isOff?: boolean;
  enabled?: boolean;
  sortOrder?: number;
}

export interface ShiftProvider {
  listShiftTypes(): Promise<ShiftType[]>;
  createShiftType(input: ShiftTypeInput): Promise<ShiftType>;
  updateShiftType(id: string, patch: Partial<ShiftTypeInput>): Promise<ShiftType>;
  deleteShiftType(id: string): Promise<void>;
  listShiftAssignments(from?: string, to?: string): Promise<ShiftAssignment[]>;
  setShiftAssignment(input: ShiftAssignmentInput): Promise<ShiftAssignment>;
  setShiftAssignments(inputs: ShiftAssignmentInput[]): Promise<ShiftAssignment[]>;
  applyShiftAssignmentChanges(upserts: ShiftAssignmentInput[], deleteDates: string[]): Promise<ShiftAssignment[]>;
  deleteShiftAssignment(date: string): Promise<void>;
}
