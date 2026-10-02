import type { BusyInterval, ShiftAssignment, ShiftType, Task } from '@/types';
import { getShiftInterval } from '@/lib/shifts/utils';

export function getTaskBusyIntervals(tasks: Task[]): BusyInterval[] {
  return tasks.flatMap((task) => {
    if (task.hiddenOnCalendar) return [];
    const ranges = task.ranges?.length ? task.ranges : (task.start && task.end ? [{ start: task.start, end: task.end }] : []);
    return ranges.flatMap((range) => {
      if (!range.start || !range.end) return [];
      const start = new Date(range.start);
      const end = new Date(range.end);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) return [];
      return [{ source: 'task' as const, sourceId: task.id, title: task.title, category: task.category, start, end }];
    });
  });
}

export function getShiftBusyIntervals(assignments: ShiftAssignment[], shiftTypes: ShiftType[]): BusyInterval[] {
  const types = new Map(shiftTypes.map((type) => [type.id, type]));
  return assignments.flatMap((assignment) => {
    const type = types.get(assignment.shiftTypeId);
    if (!type) return [];
    const interval = getShiftInterval(assignment.date, type);
    return interval ? [{ source: 'shift' as const, sourceId: assignment.id, title: `${type.code} ${type.name}`, category: 'hospital' as const, ...interval }] : [];
  });
}

export function getCombinedBusyIntervals(tasks: Task[], assignments: ShiftAssignment[], shiftTypes: ShiftType[]): BusyInterval[] {
  return [...getTaskBusyIntervals(tasks), ...getShiftBusyIntervals(assignments, shiftTypes)]
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
