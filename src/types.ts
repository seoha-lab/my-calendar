import type { EventCategory } from '@/lib/calendar/categories';

export type Stage = 'todo' | 'done';

export interface SubTask { id: string; title: string; done: boolean; }

export interface Task {
  id: string;
  title: string;
  category?: EventCategory; // Legacy records default to other; colors belong to the UI theme.
  description?: string;
  location?: string;
  stage: Stage;
  checked: boolean;
  completedAt?: string;    // ISO when marked done
  start?: string;           // ISO
  end?: string;             // ISO
  allDay?: boolean;
  isEvent?: boolean;        // whether to show on calendar
  hiddenOnCalendar?: boolean;
  linkedTo?: string[];      // bidirectional links
  parentId?: string | null; // original task if follow-up
  subTasks?: SubTask[];
  // Multiple scheduled ranges for timeline (optional; falls back to start/end)
  ranges?: TaskRange[];
  createdAt: string;        // ISO
  updatedAt: string;        // ISO
  calendarId: string;       // FK to CalendarSource.id
  order?: number;           // order within stage (optional)
}

export interface CalendarSource {
  id: string;               // 'local' or 'google:<id>'
  title: string;
  enabled: boolean;         // hide/show toggle
  readOnly?: boolean;
  kind: 'local' | 'google';
}

export interface ExportRange {
  from: string; // ISO date/datetime
  to: string;   // ISO date/datetime
}

// A discrete scheduled span for a task
export interface TaskRange {
  id: string;
  taskId: string;
  start: string; // ISO
  end: string;   // ISO
  allDay?: boolean;
  createdAt?: string; // ISO
  updatedAt?: string; // ISO
}

export interface ShiftType {
  id: string;
  code: string;
  name: string;
  startTime: string | null; // local HH:mm
  endTime: string | null;   // local HH:mm
  crossesMidnight: boolean;
  isOff: boolean;
  enabled: boolean;
  sortOrder: number;
}

export interface ShiftAssignment {
  id: string;
  date: string; // YYYY-MM-DD, interpreted as the local shift start date
  shiftTypeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusyInterval {
  source: 'task' | 'shift';
  sourceId: string;
  start: Date;
  end: Date;
}
