import { create } from 'zustand';
import { calendarService } from '@/lib/calendar';
import { shiftService, type ShiftAssignmentInput, type ShiftTypeInput } from '@/lib/shifts';
import { addDays, addHours } from 'date-fns';
import { CalendarSource, ShiftAssignment, ShiftType, Stage, Task } from '@/types';

type State = {
  tasks: Record<string, Task>;
  calendars: CalendarSource[];
  shiftTypes: ShiftType[];
  shiftAssignments: Record<string, ShiftAssignment>;
  selectedTaskId?: string | null;
  initialized: boolean;
  search: string;
  hideDone: boolean;
};

type Actions = {
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshShifts: () => Promise<void>;
  setSelected: (id: string | null) => void;
  setSearch: (q: string) => void;
  setHideDone: (v: boolean) => void;
  toggleHideDone: () => void;
  createTask: (input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Task>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  moveStage: (id: string, stage: Stage, beforeId?: string, afterId?: string) => Promise<void>;
  toggleChecked: (id: string) => Promise<void>;
  toggleIsEvent: (id: string) => Promise<void>;
  toggleCalendarEnabled: (calendarId: string, enabled: boolean) => Promise<void>;
  createFollowUp: (id: string) => Promise<Task>;
  tasksByStage: (stage: Stage) => Task[];
  // Timeline ranges
  addRange: (taskId: string, input: { start: string; end: string; allDay?: boolean }) => Promise<Task>;
  addRanges: (taskId: string, inputs: { start: string; end: string; allDay?: boolean }[]) => Promise<Task>;
  addRangesBatch: (groups: { taskId: string; ranges: { start: string; end: string; allDay?: boolean }[] }[]) => Promise<Task[]>;
  updateRange: (rangeId: string, patch: { start?: string; end?: string; allDay?: boolean }) => Promise<Task>;
  deleteRange: (rangeId: string) => Promise<Task>;
  createShiftType: (input: ShiftTypeInput) => Promise<ShiftType>;
  updateShiftType: (id: string, patch: Partial<ShiftTypeInput>) => Promise<ShiftType>;
  deleteShiftType: (id: string) => Promise<void>;
  setShiftAssignment: (input: ShiftAssignmentInput) => Promise<ShiftAssignment>;
  setShiftAssignments: (inputs: ShiftAssignmentInput[]) => Promise<ShiftAssignment[]>;
  applyShiftAssignmentChanges: (upserts: ShiftAssignmentInput[], deleteDates: string[]) => Promise<ShiftAssignment[]>;
  deleteShiftAssignment: (date: string) => Promise<void>;
};

export const useStore = create<State & Actions>((set, get) => ({
  tasks: {},
  calendars: [],
  shiftTypes: [],
  shiftAssignments: {},
  selectedTaskId: null,
  initialized: false,
  search: '',
  hideDone: false,

  init: async () => {
    // Load preference
    try { const saved = localStorage.getItem('clarity:hide-done'); if (saved != null) set({ hideDone: saved === '1' }); } catch {}
    await get().refresh();
    set({ initialized: true });
  },

  refresh: async () => {
    const [tasks, calendars, shiftTypes, shiftAssignments] = await Promise.all([
      calendarService.listTasks(),
      calendarService.listCalendars(),
      shiftService.listShiftTypes(),
      shiftService.listShiftAssignments(),
    ]);
    const map: Record<string, Task> = {};
    for (const t of tasks) {
      // Migrate any legacy 'in-progress' to 'todo'
      if ((t as any).stage === 'in-progress') {
        const migrated = { ...t, stage: 'todo' as Stage };
        map[t.id] = migrated;
        void calendarService.updateTask(t.id, { stage: 'todo' as Stage }).catch(() => {});
      } else {
        map[t.id] = t;
      }
    }
    set({ tasks: map, calendars, shiftTypes, shiftAssignments: Object.fromEntries(shiftAssignments.map((assignment) => [assignment.date, assignment])) });
  },

  refreshShifts: async () => {
    const [shiftTypes, shiftAssignments] = await Promise.all([shiftService.listShiftTypes(), shiftService.listShiftAssignments()]);
    set({ shiftTypes, shiftAssignments: Object.fromEntries(shiftAssignments.map((assignment) => [assignment.date, assignment])) });
  },

  setSelected: (id) => set({ selectedTaskId: id }),

  setSearch: (q) => set({ search: q }),

  setHideDone: (v) => { set({ hideDone: v }); try { localStorage.setItem('clarity:hide-done', v ? '1' : '0'); } catch {} },
  toggleHideDone: () => { const v = !get().hideDone; set({ hideDone: v }); try { localStorage.setItem('clarity:hide-done', v ? '1' : '0'); } catch {} },

  createTask: async (input) => {
    const task = await calendarService.createTask(input);
    set((s) => ({ tasks: { ...s.tasks, [task.id]: task } }));
    return task;
  },

  updateTask: async (id, patch) => {
    const t = await calendarService.updateTask(id, patch);
    set((s) => ({ tasks: { ...s.tasks, [id]: t } }));
    return t;
  },

  deleteTask: async (id) => {
    await calendarService.deleteTask(id);
    set((s) => {
      const copy = { ...s.tasks };
      delete copy[id];
      return { tasks: copy };
    });
  },

  moveStage: async (id, stage, beforeId, afterId) => {
    // simple reordering by average order or by createdAt fallback
    const state = get();
    const list = Object.values(state.tasks).filter((t) => t.stage === stage && t.id !== id).sort(orderComparator);
    let beforeOrder = beforeId ? state.tasks[beforeId]?.order ?? undefined : undefined;
    let afterOrder = afterId ? state.tasks[afterId]?.order ?? undefined : undefined;
    if (beforeId && beforeOrder === undefined) beforeOrder = list.find((t) => t.id === beforeId)?.order;
    if (afterId && afterOrder === undefined) afterOrder = list.find((t) => t.id === afterId)?.order;
    let nextOrder: number | undefined;
    if (beforeOrder != null && afterOrder != null) nextOrder = (beforeOrder + afterOrder) / 2;
    else if (beforeOrder != null) nextOrder = beforeOrder - 1;
    else if (afterOrder != null) nextOrder = afterOrder + 1;
    else nextOrder = list.length > 0 ? (list[list.length - 1].order ?? list.length) + 1 : 0;
    await get().updateTask(id, { stage, order: nextOrder });
  },

  toggleChecked: async (id) => {
    const t = get().tasks[id];
    if (!t) return;
    const checked = !t.checked;
    const patch: Partial<Task> = { checked };
    if (checked) patch.stage = 'done';
    else if (!checked && t.stage === 'done') patch.stage = 'todo';
    // manage completedAt timestamp
    patch.completedAt = checked ? new Date().toISOString() : undefined;
    await get().updateTask(id, patch);
  },

  toggleIsEvent: async (id) => {
    const t = get().tasks[id];
    if (!t) return;
    const isEvent = !t.isEvent;
    let patch: Partial<Task> = { isEvent };
    if (isEvent && !t.start) {
      const now = new Date();
      patch = { ...patch, start: now.toISOString(), end: addHours(now, 1).toISOString() };
    }
    await get().updateTask(id, patch);
  },

  toggleCalendarEnabled: async (calendarId, enabled) => {
    await calendarService.toggleCalendarEnabled(calendarId, enabled);
    await get().refresh();
  },

  createFollowUp: async (id) => {
    const original = get().tasks[id];
    if (!original) throw new Error('Task not found');
    const start = original.start ? addDays(new Date(original.start), 1) : undefined;
    const end = original.end ? addDays(new Date(original.end), 1) : (start ? addHours(start, 2) : undefined);
    const follow: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
      title: original.title,
      category: original.category,
      description: original.description,
      stage: original.stage,
      checked: false,
      start: start?.toISOString(),
      end: end?.toISOString(),
      allDay: original.allDay,
      isEvent: original.isEvent,
      hiddenOnCalendar: original.hiddenOnCalendar,
      linkedTo: [original.id, ...(original.linkedTo ?? [])],
      parentId: original.parentId ?? original.id,
      subTasks: original.subTasks,
      calendarId: original.calendarId,
      order: (original.order ?? 0) + 0.1,
    };
    const created = await get().createTask(follow);
    // link both ways
    await get().updateTask(original.id, { linkedTo: [...new Set([...(original.linkedTo ?? []), created.id])] });
    return created;
  },

  tasksByStage: (stage) => {
    return Object.values(get().tasks).filter((t) => t.stage === stage).sort(orderComparator);
  },

  // --- Ranges (timeline) ---
  addRange: async (taskId, input) => {
    const t = await calendarService.addRange(taskId, input);
    set((s) => ({ tasks: { ...s.tasks, [taskId]: t } }));
    return t;
  },
  addRanges: async (taskId, inputs) => {
    const task = await calendarService.addRanges(taskId, inputs);
    set((state) => ({ tasks: { ...state.tasks, [taskId]: task } }));
    return task;
  },
  addRangesBatch: async (groups) => {
    const updated = await calendarService.addRangesBatch(groups);
    set((state) => ({ tasks: { ...state.tasks, ...Object.fromEntries(updated.map((task) => [task.id, task])) } }));
    return updated;
  },
  updateRange: async (rangeId, patch) => {
    const t = await calendarService.updateRange(rangeId, patch);
    set((s) => ({ tasks: { ...s.tasks, [t.id]: t } }));
    return t;
  },
  deleteRange: async (rangeId) => {
    const t = await calendarService.deleteRange(rangeId);
    set((s) => ({ tasks: { ...s.tasks, [t.id]: t } }));
    return t;
  },

  createShiftType: async (input) => {
    const shiftType = await shiftService.createShiftType(input);
    set((state) => ({ shiftTypes: [...state.shiftTypes, shiftType].sort((a, b) => (a.sortOrder - b.sortOrder) || a.code.localeCompare(b.code)) }));
    return shiftType;
  },
  updateShiftType: async (id, patch) => {
    const shiftType = await shiftService.updateShiftType(id, patch);
    set((state) => ({ shiftTypes: state.shiftTypes.map((item) => item.id === id ? shiftType : item).sort((a, b) => (a.sortOrder - b.sortOrder) || a.code.localeCompare(b.code)) }));
    return shiftType;
  },
  deleteShiftType: async (id) => {
    await shiftService.deleteShiftType(id);
    set((state) => ({ shiftTypes: state.shiftTypes.filter((item) => item.id !== id) }));
  },

  setShiftAssignment: async (input) => {
    const assignment = await shiftService.setShiftAssignment(input);
    set((state) => ({ shiftAssignments: { ...state.shiftAssignments, [assignment.date]: assignment } }));
    return assignment;
  },
  setShiftAssignments: async (inputs) => {
    const assignments = await shiftService.setShiftAssignments(inputs);
    set((state) => {
      const next = { ...state.shiftAssignments };
      for (const assignment of assignments) next[assignment.date] = assignment;
      return { shiftAssignments: next };
    });
    return assignments;
  },
  applyShiftAssignmentChanges: async (upserts, deleteDates) => {
    const assignments = await shiftService.applyShiftAssignmentChanges(upserts, deleteDates);
    set((state) => {
      const next = { ...state.shiftAssignments };
      for (const date of deleteDates) delete next[date];
      for (const assignment of assignments) next[assignment.date] = assignment;
      return { shiftAssignments: next };
    });
    return assignments;
  },

  deleteShiftAssignment: async (date) => {
    await shiftService.deleteShiftAssignment(date);
    set((state) => {
      const next = { ...state.shiftAssignments };
      delete next[date];
      return { shiftAssignments: next };
    });
  },
}));

function orderComparator(a: Task, b: Task): number {
  const ao = a.order ?? 0;
  const bo = b.order ?? 0;
  if (ao !== bo) return ao - bo;
  return a.createdAt.localeCompare(b.createdAt);
}
