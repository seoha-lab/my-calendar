import type { TextSpan } from './types';

const WEEKDAYS: Record<string, number> = { 일요일: 0, 월요일: 1, 화요일: 2, 수요일: 3, 목요일: 4, 금요일: 5, 토요일: 6 };

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validLocalDate(year: number, month: number, day: number): Date | undefined {
  const result = new Date(year, month - 1, day, 12);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : undefined;
}

export function parseKoreanDate(input: string, referenceDate: Date): { date?: string; span?: TextSpan; ambiguities: string[] } {
  const explicit = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일|(?:(\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일|(?:(\d{4})[./-])?(\d{1,2})[/-](\d{1,2})/.exec(input);
  if (explicit) {
    const year = Number(explicit[1] ?? explicit[4] ?? explicit[7] ?? referenceDate.getFullYear());
    const month = Number(explicit[2] ?? explicit[5] ?? explicit[8]);
    const day = Number(explicit[3] ?? explicit[6] ?? explicit[9]);
    const parsed = validLocalDate(year, month, day);
    if (!parsed) return { ambiguities: ['날짜가 올바르지 않습니다.'] };
    const trailingWeekday = /^\s*(월요일|화요일|수요일|목요일|금요일|토요일|일요일)/.exec(input.slice(explicit.index + explicit[0].length));
    const end = explicit.index + explicit[0].length + (trailingWeekday?.[0].length ?? 0);
    const ambiguities: string[] = [];
    if (trailingWeekday && parsed.getDay() !== WEEKDAYS[trailingWeekday[1]]) ambiguities.push('입력한 날짜와 요일이 일치하지 않습니다.');
    return { date: dateKey(parsed), span: { start: explicit.index, end, text: input.slice(explicit.index, end) }, ambiguities };
  }

  const dayOnly = /(^|\s)(\d{1,2})일(?=$|\s)/.exec(input);
  if (dayOnly) {
    const day = Number(dayOnly[2]);
    const parsed = validLocalDate(referenceDate.getFullYear(), referenceDate.getMonth() + 1, day);
    if (!parsed) return { ambiguities: ['날짜가 올바르지 않습니다.'] };
    ...[truncated]