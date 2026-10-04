import type { EventCategory } from '@/lib/calendar/categories';
import type { FreeTimePreferences } from '@/lib/preferences/freeTime';
import { calculateFreeTime, calculateRemainingMinutes, getCombinedBusyIntervals, isSchedulableTask, rankTasksForScheduling, scheduleTasks, type FreeInterval } from '@/lib/scheduling';
import { addLocalDays, getShiftInterval, toLocalDateKey } from '@/lib/shifts/utils';
import type { ShiftAssignment, ShiftType, Task, TaskPriority } from '@/types';

export type TodayScheduleItem = {
  id: string;
  taskId: string;
  title: string;
  kind: 'event' | 'task';
  start: Date;
  end: Date;
  allDay: boolean;
  category?: EventCategory;
  location?: string;
  completed: boolean;
};

export type TodayTaskItem = {
  task: Task;
  remainingMinutes: number;
  deadline: Date | null;
  deadlineDayOffset: number | null;
  hasTodayRange: boolean;
};

export type TodayShift = {
  assignment?: ShiftAssignment;
  type?: ShiftType;
  interval?: { start: Date; end: Date } | null;
  previousAssignment?: ShiftAssignment;
  previousType?: ShiftType;
  previousInterval?: { start: Date; end: Date } | null;
  status: 'none' | 'off' | 'upcoming' | 'active' | 'ended' | 'previous-active';
};

export type TodayDashboardData = {
  dateKey: string;
  shift: TodayShift;
  schedule: TodayScheduleItem[];
  nextSchedule?: TodayScheduleItem;
  nextScheduleState?: 'upcoming' | 'active';
  urgentTasks: TodayTaskItem[];
  focusTasks: TodayTaskItem[];
  schedulableTasks: TodayTaskItem[];
  shortageTasks: Array<TodayTaskItem & { shortageMinutes: number }>;
  completedTodayCount: number;
  freeTime: FreeInterval[];
  totalFreeMinutes: number;
  remainingFreeTime: FreeInterval[];
  remainingFreeMinutes: number;
  currentFreeTime?: FreeInterval;
  doNowTasks: Array<TodayTaskItem & { fitsCurrentFreeTime: boolean }>;
};

export type TodayDashboardInput = {
  tasks: Task[];
  assignments: ShiftAssignment[];
  shiftTypes: ShiftType[];
  preferences: FreeTimePreferences;
  now: Date;
};

const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

function localDayStart(dateKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error(`Invalid local date: ${dateKey}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function taskRanges(task: Task): Array<{ id?: string; start: string; end: string; allDay?: boolean }> {
  return task.ranges?.length ? task.ranges : (task.start && task.end ? [{ start: task.start, end: task.end, allDay: task.allDay }] : []);
}

function overlaps(start: Date, end: Date, windowStart: Date, windowEnd: Date): boolean {
  return start < windowEnd && windowStart < end;
}

function validDeadline(task: Task): Date | null {
  if (!task.deadline) return null;
  const deadline = new Date(task.deadline);
  return Number.isFinite(deadline.getTime()) ? deadline : null;
}

function dayOffset(dateKey: string, value: Date): number {
  const start = localDayStart(dateKey);
  const target = localDayStart(toLocalDateKey(value));
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

function taskRank(a: TodayTaskItem, b: TodayTaskItem): number {
  const priority = PRIORITY_ORDER[a.task.priority ?? 'medium'] - PRIORITY_ORDER[b.task.priority ?? 'medium'];
  if (priority) return priority;
  const aDeadline = a.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
  const bDeadline = b.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
  return aDeadline - bDeadline || a.task.createdAt.localeCompare(b.task.createdAt) || a.task.id.localeCompare(b.task.id);
}

export function getTodaySchedule(tasks: Task[], dateKey: string): TodayScheduleItem[] {
  const windowStart = localDayStart(dateKey);
  const windowEnd = localDayStart(addLocalDays(dateKey, 1));
  return tasks.flatMap((task) => {
    if (task.hiddenOnCalendar) return [];
    return taskRanges(task).flatMap((range, index) => {
      const start = new Date(range.start);
      const end = new Date(range.end);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || !overlaps(start, end, windowStart, windowEnd)) return [];
      return [{
        id: `${task.id}:${range.id ?? index}`,
        taskId: task.id,
        title: task.title,
        kind: task.isEvent ? 'event' as const : 'task' as const,
        start,
        end,
        allDay: Boolean(range.allDay),
        category: task.category,
        location: task.location,
        completed: task.checked || task.stage === 'done',
      }];
    });
  }).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title, 'ko'));
}

export function getUpcomingSchedule(schedule: TodayScheduleItem[], now: Date): { item?: TodayScheduleItem; state?: 'upcoming' | 'active' } {
  const timed = schedule.filter((item) => !item.allDay && item.end > now);
  const active = timed.find((item) => item.start <= now && now < item.end);
  if (active) return { item: active, state: 'active' };
  const upcoming = timed.find((item) => item.start > now);
  return upcoming ? { item: upcoming, state: 'upcoming' } : {};
}

export function getTodayShift(dateKey: string, assignments: ShiftAssignment[], shiftTypes: ShiftType[], now: Date): TodayShift {
  const assignmentByDate = new Map(assignments.map((item) => [item.date, item]));
  const typeById = new Map(shiftTypes.map((item) => [item.id, item]));
  const assignment = assignmentByDate.get(dateKey);
  const type = assignment ? typeById.get(assignment.shiftTypeId) : undefined;
  const interval = type ? getShiftInterval(dateKey, type) : undefined;
  const previousAssignment = assignmentByDate.get(addLocalDays(dateKey, -1));
  const previousType = previousAssignment ? typeById.get(previousAssignment.shiftTypeId) : undefined;
  const previousInterval = previousType?.crossesMidnight ? getShiftInterval(previousAssignment!.date, previousType) : undefined;
  const previousActive = previousInterval && previousInterval.start <= now && now < previousInterval.end;
  let status: TodayShift['status'] = 'none';
  if (interval && interval.start <= now && now < interval.end) status = 'active';
  else if (previousActive) status = 'previous-active';
  else if (type?.isOff) status = 'off';
  else if (interval && now < interval.start) status = 'upcoming';
  else if (interval && now >= interval.end) status = 'ended';
  return { assignment, type, interval, previousAssignment, previousType, previousInterval, status };
}

export function getRemainingFreeTime(free: FreeInterval[], now: Date, minimumMinutes: number): { intervals: FreeInterval[]; totalMinutes: number; current?: FreeInterval } {
  const currentSource = free.find((interval) => interval.start <= now && now < interval.end);
  const intervals = free.flatMap((interval) => {
    const start = interval.start < now ? new Date(Math.ceil(now.getTime() / 60_000) * 60_000) : interval.start;
    const durationMinutes = Math.floor((interval.end.getTime() - start.getTime()) / 60_000);
    return durationMinutes >= minimumMinutes ? [{ start: new Date(start), end: new Date(interval.end), durationMinutes }] : [];
  });
  const current = currentSource ? intervals.find((interval) => interval.start <= new Date(Math.ceil(now.getTime() / 60_000) * 60_000) && interval.end.getTime() === currentSource.end.getTime()) : undefined;
  return { intervals, totalMinutes: intervals.reduce((sum, interval) => sum + interval.durationMinutes, 0), current };
}

export function buildTodayDashboard(input: TodayDashboardInput): TodayDashboardData {
  const { tasks, assignments, shiftTypes, preferences, now } = input;
  const dateKey = toLocalDateKey(now);
  const schedule = getTodaySchedule(tasks, dateKey);
  const upcoming = getUpcomingSchedule(schedule, now);
  const busyIntervals = getCombinedBusyIntervals(tasks, assignments, shiftTypes);
  const free = calculateFreeTime({ date: dateKey, busyIntervals, dayStart: preferences.dayStartTime, dayEnd: preferences.dayEndTime, minimumMinutes: preferences.minimumFreeMinutes });
  const remainingFree = getRemainingFreeTime(free.free, now, preferences.minimumFreeMinutes);
  const incomplete = tasks.filter((task) => !task.checked && task.stage !== 'done');
  const todayTaskIds = new Set(schedule.filter((item) => item.kind === 'task').map((item) => item.taskId));
  const taskItems = incomplete.map((task): TodayTaskItem => {
    const deadline = validDeadline(task);
    return { task, deadline, remainingMinutes: calculateRemainingMinutes(task), deadlineDayOffset: deadline ? dayOffset(dateKey, deadline) : null, hasTodayRange: todayTaskIds.has(task.id) };
  });
  const urgentTasks = taskItems.filter((item) => item.deadlineDayOffset != null && item.deadlineDayOffset <= 3).sort((a, b) => (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0) || taskRank(a, b));
  const schedulableTasks = rankTasksForScheduling(incomplete.filter((task) => isSchedulableTask(task, now).ok)).map((task) => taskItems.find((item) => item.task.id === task.id)!).filter(Boolean);
  const simulation = scheduleTasks(schedulableTasks.map((item) => item.task), busyIntervals, preferences, now);
  const shortageById = new Map(simulation.results.filter((result) => !result.fullyScheduled && result.shortageMinutes > 0).map((result) => [result.taskId, result.shortageMinutes]));
  const shortageTasks = schedulableTasks.flatMap((item) => shortageById.has(item.task.id) ? [{ ...item, shortageMinutes: shortageById.get(item.task.id)! }] : []);
  const focusTasks = taskItems.filter((item) => item.hasTodayRange || item.deadlineDayOffset != null && item.deadlineDayOffset <= 3 || item.task.priority === 'high' || item.remainingMinutes > 0 && Boolean(item.deadline)).sort(taskRank);
  const doNowTasks = remainingFree.current ? schedulableTasks.slice(0, 3).map((item) => ({ ...item, fitsCurrentFreeTime: item.remainingMinutes <= remainingFree.current!.durationMinutes })) : [];
  const completedTodayCount = tasks.filter((task) => task.checked && task.completedAt && toLocalDateKey(new Date(task.completedAt)) === dateKey).length;
  return {
    dateKey,
    shift: getTodayShift(dateKey, assignments, shiftTypes, now),
    schedule,
    nextSchedule: upcoming.item,
    nextScheduleState: upcoming.state,
    urgentTasks,
    focusTasks,
    schedulableTasks,
    shortageTasks,
    completedTodayCount,
    freeTime: free.free,
    totalFreeMinutes: free.totalFreeMinutes,
    remainingFreeTime: remainingFree.intervals,
    remainingFreeMinutes: remainingFree.totalMinutes,
    currentFreeTime: remainingFree.current,
    doNowTasks,
  };
}
