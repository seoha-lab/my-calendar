import type { TextSpan } from './types';

export type WeeklyRecurrence = {
  frequency: 'weekly';
  weekdays: number[];
  until?: string;
};

const DAY_TO_INDEX: Record<string, number> = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
const LONG_DAY = '(?:월요일|화요일|수요일|목요일|금요일|토요일|일요일)';

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  const long = new RegExp(`매주\\s*(${LONG_DAY}(?:\\s*(?:[,/·]\\s*|\\s+)${LONG_DAY})*)`).exec(input);
  const separated = /매주\s*((?:[월화수목금토일]\s*[,/·]\s*)+[월화수목금토일])/.exec(input);
  const compact = /매춻q^