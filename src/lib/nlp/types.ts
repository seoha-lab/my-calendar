import type { EventCategory } from '@/lib/calendar/categories';

export type ParsedEvent = {
  kind: 'event';
  title: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  category: EventCategory;
  allDay: boolean;
  note?: string;
  confidence: number;
  ambiguities: string[];
};

export type ParsedShift = {
  kind: 'shift';
  date?: string;
  shiftCode: 'D7' | 'N7' | 'OFF';
  category: 'hospital';
  confidence: number;
  ambiguities: string[];
};

export type ParsedKoreanInput = ParsedEvent | ParsedShift;

export type TextSpan = { start: number; end: number; text: string };

