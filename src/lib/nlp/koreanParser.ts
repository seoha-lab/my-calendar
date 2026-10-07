import { inferCategory } from './categoryParser';
import { parseKoreanDate } from './dateParser';
import { parseLocation } from './locationParser';
import { parseShiftInput } from './shiftParser';
import { parseKoreanTime } from './timeParser';
import { firstWeeklyOccurrenceDate, parseWeeklyRecurrence } from './recurrence';
import type { ParsedKoreanInput, TextSpan } from './types';

function removeSpans(input: string, spans: (TextSpan | undefined)[]): string {
  const chars = [...input];
  for (const span of spans.filter(Boolean) as TextSpan[]) for (let i = span.start; i < span.end; i += 1) chars[i] = ' ';
  return chars.join('').replace(/\s+/g, ' ').replace(/^[,./~\-–—\s]+|[,./~\-–—\s]+$/g, '').trim();
}

function addHour(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  return `${String((hour + 1) % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseKoreanInput(input: string, referenceDate = new Date()): ParsedKoreanInput {
  const trimmed = input.trim();
  const shift = parseShiftInput(trimmed, referenceDate);
  if (shift) return shift;
  const recurrence = parseWeeklyRecurrence(trimmed);
  const time = parseKoreanTime(trimmed);
  const parsedDate = parseKoreanDate(trimmed, referenceDate);
  const date = recurrence.recurrence
    ? { date: firstWeeklyOccurrenceDate(recurrence.recurrence.weekdays, referenceDate, time.startTime), span: undefined, ambiguities: [] as string[] }
    : parsedDate;
  const locq^