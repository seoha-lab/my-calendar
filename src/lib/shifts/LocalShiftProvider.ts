import { db } from '@/lib/db';
import type { ShiftProvider } from './ShiftProvider';

/** Shift persistence adapter. It keeps UI code away from the SQLite worker. */
export const localShiftProvider: ShiftProvider = {
  listShiftTypes: () => db.listShiftTypes(),
  listShiftAssignments: (from, to) => db.listShiftAssignments(from, to),
  setShiftAssignment: (input) => db.setShiftAssignment(input),
  setShiftAssignments: (inputs) => db.setShiftAssignments(inputs),
  deleteShiftAssignment: (date) => db.deleteShiftAssignment(date),
};
