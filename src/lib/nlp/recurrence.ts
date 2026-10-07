import type { TextSpan } from './types';

export type WeeklyRecurrence = {
  frequency: 'weekly';
  weekdays: number[];
  until?: string;
};

const DAY_TO_INDEX: Record<string, number> = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
const LONG_DAY = '(?:월요일|화요일|수요일|목요일|금요일|토요일|일요일)';

function dateKey(date: Date): string {
  return String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function parseDateKey(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : undefined;
}

function extractWeekdayTokens(raw: string): number[] {
  const tokens = raw.match(/(월|화|수|목|금|토|일)(?:요일)?/g) ?? [];
  return [...new Set(tokens.map((token) => DAY_TO_INDEX[token[0]]).filter((value) => value !== undefined))];
}

export function parseWeeklyRecurrence(input: string): { recurrence?: WeeklyRecurrence; span?: TextSpan } {
  const long = new RegExp('매주\\s*(' + LONG_DAY + '(?:\\s*(?:[,/·]\\s*|\\s+)' + LONG_DAY + ')*)').exec(input);
  const separated = /매주\s*((?:[월화수목금토일]\s*[,/·]\s*)+[월화수목금토일])/.exec(input);
  const compact = /매주\s*([월화수목금토일]{1,7})(?!요일)/.exec(input);
  const match = long ?? separated ?? compact;
  if (!match) return {};
  const weekdays = extractWeekdayTokens(match[1]);
  if (!weekdays.length) return {};
  return { recurrence: { frequency: 'weekly', weekdays }, span: { start: match.index, end: match.index + match[0].length, text: match[0] } };
}

export function firstWeeklyOccurrenceDate(weekdays: number[], referenceDate: Date, startTime?: string): string | undefined {
  const allowed = new Set(weekdays);
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() + offset, 12);
    if (!allowed.has(candidate.getDay())) continue;
    if (offset === 0 && startTime) {
      const [hour, minute] = startTime.split(':').map(Number);
      const occurrence = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), hour, minute);
      if (occurrence.getTime() <= referenceDate.getTime()) continue;
    }
    return dateKey(candidate);
  }
  return undefined;
}

export function buildWeeklyOccurrenceDates(startDate: string, untilDate: string, weekdays: number[], limit = 500): string[] {
  const start = parseDateKey(startDate);
  const until = parseDateKey(untilDate);
  if (!start || !until || until.getTime() < start.getTime() || !weekdays.length) return [];
  const allowed = new Set(weekdays);
  const result: string[] = [];
  for (let cursor = new Date(start); cursor.getTime() <= until.getTime() && result.length < limit; cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 12)) {
    if (allowed.has(cursor.getDay())) result.push(dateKey(cursor));
  }
  return result;
}

export function weeklyRecurrenceLabel(weekdays: number[]): string {
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  return '매주 ' + weekdays.map((day) => names[day]).join('·');
}
