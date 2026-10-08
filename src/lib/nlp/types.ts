import type { EventCategory } from '@/lib/calendar/categories';
import type { WeeklyRecurrence } from './recurrence';

export type ParsedEvent = {
  kind: 'event';
  title: string;
  timePeriod?: 'morning' | 'lunch' | 'evening' | 'night';
  date?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  category: EventCategory;
  allDay: boolean;
  note?: string;
  recurrence?: WeeklyRecurrence;
  confidence: number;
  ambiguities: string[];
};

export type ParsedShift = {
  kind: 'shift';
  date?: string;
  shiftCode: string;
  category: 'hospital';
  confidence: number;
  ambiguities: string[];
};

export type ParsedKoreanInput = ParsedEvent | ParsedShift;

export type TextSpan = { start: number; end: number; text: string };
