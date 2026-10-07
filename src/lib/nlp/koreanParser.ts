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
  const location = parseLocation(trimmed);
  const title = removeSpans(trimmed, [recurrence.span, date.span, time.span, location.span]);
  const ambiguities = [...date.ambiguities, ...time.ambiguities];
  if (!date.date) ambiguities.push(recurrence.recurrence ? '반복 일정의 첫 날짜를 정할 수 없습니다.' : '날짜를 선택해 주세요.');
  if (!time.startTime && !time.timePeriod) ambiguities.push('시작 시간을 선택해 주세요.');
  if (!title) ambiguities.push('일정 제목을 입력해 주세요.');
  return {
    kind: 'event',
    title,
    timePeriod: time.timePeriod,
    date: date.date,
    startTime: time.startTime,
    endTime: time.endTime ?? (time.startTime ? addHour(time.startTime) : undefined),
    location: location.location,
    category: inferCategory(trimmed),
    allDay: false,
    recurrence: recurrence.recurrence,
    confidence: Math.max(0.2, 1 - ambiguities.length * 0.2),
    ambiguities: [...new Set(ambiguities)],
  };
}
