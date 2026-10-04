import type { CalendarSource, Task, TaskRange } from '@/types';

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'ranges'>;
/** Calendar events keep the existing Task + TaskRange representation. */
export interface CalendarProvider {
  getEvents(from: string, to: string): Promise<Task[]>;
  createEvent(input: TaskInput): Promise<Task>;
  updateEvent(id: string, patch: Partial<Task>): Promise<Task>;
  deleteEvent(id: string): Promise<void>;
}
/** Existing task/timeline capabilities used by the store. */
export interface CalendarService extends CalendarProvider {
  listTasks(): Promise<Task[]>;
  listCalendars(): Promise<CalendarSource[]>;
  createTask(input: TaskInput): Promise<Task>;
  updateTask(id: string, patch: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  toggleCalendarEnabled(id: string, enabled: boolean): Promise<void>;
  addRange(taskId: string, input: Pick<TaskRange, 'start' | 'end' | 'allDay'>): Promise<Task>;
  addRanges(taskId: string, inputs: Pick<TaskRange, 'start' | 'end' | 'allDay'>[]): Promise<Task>;
  addRangesBatch(groups: { taskId: string; ranges: Pick<TaskRange, 'start' | 'end' | 'allDay'>[] }[]): Promise<Task[]>;
  updateRange(id: string, patch: Partial<Pick<TaskRange, 'start' | 'end' | 'allDay'>>): Promise<Task>;
  deleteRange(id: string): Promise<Task>;
}
