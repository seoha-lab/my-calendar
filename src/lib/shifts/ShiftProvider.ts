import type { ShiftAssignment, ShiftType } from '@/types';

export interface ShiftAssignmentInput {
  date: string;
  shiftTypeId: string;
}

export interface ShiftProvider {
  listShiftTypes(): Promise<ShiftType[]>;
  listShiftAssignments(from?: string, to?: string): Promise<ShiftAssignment[]>;
  setShiftAssignment(input: ShiftAssignmentInput): Promise<ShiftAssignment>;
  setShiftAssignments(inputs: ShiftAssignmentInput[]): Promise<ShiftAssignment[]>;
  deleteShiftAssignment(date: string): Promise<void>;
}
