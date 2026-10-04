import { db } from '@/lib/db';
import { normalizeCategory } from './categories';
import type { CalendarService } from './CalendarProvider';

/** Only this adapter accesses the SQLite worker. Remote sync is future work. */
export const localCalendarProvider: CalendarService = {
  async getEvents(from, to) {
    const start = Date.parse(from);
    const end = Date.parse(to);
    return (await db.listTasks()).filter((task) => !task.hiddenOnCalendar &&
      (task.ranges?.length ? task.ranges : [task]).some((range) =>
        range.start && range.end && Date.parse(range.start) < end && Date.parse(range.end) > start));
  },
  createEvent: (input) => localCalendarProvider.createTask({ ...input, isEvent: true }),
  updateEvent: (id, patch) => localCalendarProvider.updateTask(id, patch),
  deleteEvent: (id) => db.deleteTask(id),
  listTasks: () => db.listTasks(),
  listCalendars: () => db.listCalendars(),
  createTask: (input) => db.createTask({ ...input, category: normalizeCategory(input.category) }),
  updateTask: (id, patch) => db.updateTask(id, patch.category === undefined ? patch : { ...patch, category: normalizeCategory(patch.category) }),
  deleteTask: (id) => db.deleteTask(id),
  toggleCalendarEnabled: (id, enabled) => db.toggleCalendarEnabled(id, enabled),
  addRange: (id, input) => db.addRange(id, input),
  addRanges: (id, inputs) => db.addRanges(id, inputs),
  addRangesBatch: (groups) => db.addRangesBatch(groups),
  updateRange: (id, patch) => db.updateRange(id, patch),
  deleteRange: (id) => db.deleteRange(id),
};
