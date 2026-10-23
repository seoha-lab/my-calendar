import type { EventCategory } from '@/lib/calendar/categories';

export type IcsSourceCalendar = {
  id: string;
  name: string;
  color?: string;
};

export type ParsedIcsEvent = {
  key: string;
  uid: string;
  recurrenceId: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  recurrenceRule?: string;
  sourceCalendar: string;
  warnings: string[];
  importable: boolean;
};

export type IcsParseOptions = {
  recurringFrom: string;
  recurringTo: string;
  defaultTimeZone?: string;
  maxOccurrences?: number;
};

export type IcsParseResult = {
  calendar: IcsSourceCalendar;
  events: ParsedIcsEvent[];
  warnings: string[];
};

export type IcsImportEventInput = ParsedIcsEvent & {
  category: EventCategory;
  calendarId: string;
};
