import { db } from '@/lib/db';
import type { ShiftProvider } from './ShiftProvider';

/** Shift persistence adapter. It keeps UI code away from the SQLite worker. */
export const localShiftProvider: ShiftProvider = {
  listShiftTypes: () => db.listShiftTypes(),
  createShiftType: (input) => db.createShiftType(input),
  updateShiftType: (id, patch) => db.updateShiftType(id, patch),
  deleteShiftType: (id) => db.deleteShiftType(id),
  listShiftAssignments: (from, to) => db.listShiftAssignments(from, to),
  setShiftAssignment: (input) => db.setShiftAssignment(input),
  setShiftAssignments: (inputs) => db.setShiftAssignments(inputs),
  applyShiftAssignmentChanges: (upserts, deleteDates) => db.applyShiftAssignmentChanges(upserts, deleteDates),
  deleteShiftAssignment: (date) => db.deleteShiftAssignment(date),
};
