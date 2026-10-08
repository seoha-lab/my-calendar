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
  const allDayMatch = /(하루\s*종일|하루종일|종일)/.exec(trimmed);
  const allDaySpan = allDayMatch ? { start: allDayMatch.index, end: allDayMatch.index + allDayMatch[0].length, text: allDayMatch[0] } : undefined;
  const time = allDayMatch ? { startTime: undefined, endTime: undefined, timePeriod: undefined, span: allDaySpan, ambiguities: [] as string[] } : parseKoreanTime(trimmed);
  const parsedDate = parseKoreanDate(trimmed, referenceDate);
  const date = recurrence.recurrence
    ? { date: firstWeeklyOccurrenceDate(recurrence.recurrence.weekdays, referenceDate, time.startTime), span: undefined, ambiguities: [] as string[] }
    : parsedDate;
  const location = parseLocation(trimmed);
  const title = removeSpans(trimmed, [recurrence.span, date.span, time.span, location.span, allDaySpan]);
  const ambiguities = [...date.ambi...[truncated]