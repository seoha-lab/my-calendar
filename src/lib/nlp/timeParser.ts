import type { TextSpan } from './types';

type TimeResult = { value?: string; ambiguous?: string };
export type KoreanTimePeriod = 'morning' | 'lunch' | 'evening' | 'night';

const PERIODS: Record<string, KoreanTimePeriod> = {
  '아침': 'morning',
  '점심': 'lunch',
  '저녁': 'evening',
  '밤': 'night',
};

function hhmm(hour: number, minute: number) { return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`; }

function convert(period: string | undefined, hour: number, minute: number, raw: string): TimeResult {
  if (hour > 23 || minute > 59) return { ambiguous: '시간이 올바르지 않습니다.' };
  if (period === '오전') return { value: hhmm(hour === 12 ? 0 : hour, minute) };
  if (period === '오후') return { value: hhmm(hour === 12 ? 12 : hour + 12, minute) };
  if (period === '아침') return hour >= 1 && hour <= 11 ? { value: hhmm(hour, minute) } : { ambiguous: `${raw.trim()}의 시간이 올바르지 않습니다.` };
  if (period === '점심') {
    if (hour === 12) return { value: hhmm(12, minute) };
    return hour >= 1 && hour <= 5 ? { value: hhmm(hour + 12, minute) } : { ambiguous: `${raw.trim()}의 시간이 올바르지 않습니다.` };
  }
  if (period === '저녁') return { value: hhmm(hour < 12 ? hour + 12 : hour, minute) };
  if (period === '밤') return { value: hhmm(hour >= 6 && hour < 12 ? hour + 12 : hour, minute) };
  if (hour >= 13 || hour === 0) return { value: hhmm(hour, minute) };
  return { ambiguous: `${raw.trim()}가 오전인지 오후인지 확인이 필요합니다.` };
}

function parseToken(token: string, inheritedPeriod?: string): TimeResult {
  const normalized = token.trim().replace(/에$/, '');
  if (normalized === '정오') return { value: '12:00' };
  if (normalized === '자정') return { value: '00:00' };
  const colon = /^(\d{1,2}):(\d{2})$/.exec(normalized);
  if (colon) {
    const hour = Number(colon[1]);
    const minute = Number(colon[2]);
    return hour <= 23 && minute <= 59 ? { value: hhmm(hour, minute) } : { ambiguous: '시간이 올바르지 않습니다.' };
  }
  const korean = /^(오전|오후|아침|점심|저녁|밤)?\s*(\d{1,2})시(?:\s*(\d{1,2})분)?$/.exec(normalized);
  if (!korean) return {};
  return convert(korean[1] ?? inheritedPeriod, Number(korean[2]), Number(korean[3] ?? 0), normalized);
}

export function parseKoreanTime(input: string): { startTime?: string; endTime?: string; timePeriod?: KoreanTimePeriod; span?: TextSpan; ambiguities: string[] } {
  const colonRange = /\b(\d{1,2}:\d{2})\s*[-~～–—]\s*(\d{1,2}:\d{2})\b/.exec(input);
  const koreanRange = /((?:오전|오후|아침|점심|저녁|밤)?\s*\d{1,2}시(?:\s*\d{1,2}분)?|정오|자정)\s*(?:부터|~|～|[-–—]|에서)\s*((?:오전|오후|아침|점심|저녁|밤)?\s*\d{1,2}시(?:\s*\d{1,2}분)?|정오|자정)\s*(?:까지)?/.exec(input);
  const range = colonRange ?? koreanRange;
  if (range) {
    const period = /^(오전|오후|아침|점심|저녁|밤)/.exec(range[1].trim())?.[1];
    const start = parseToken(range[1]);
    const end = parseToken(range[2], period);
    const timePeriod = period ? PERIODS[period] : undefined;
    return { startTime: start.value, endTime: end.value, ...(timePeriod ? { timePeriod } : {}), span: { start: range.index, end: range.index + range[0].length, text: range[0] }, ambiguities: [start.ambiguous, end.ambiguous].filter(Boolean) as string[] };
  }
  const single = /(오전|오후|아침|점심|저녁|밤)\s*\d{1,2}시(?:\s*\d{1,2}분)?(?:에)?|\b\d{1,2}:\d{2}\b|\d{1,2}시(?:\s*\d{1,2}분)?(?:에)?|정오|자정/.exec(input);
  if (single) {
    const period = /^(아침|점심|저녁|밤)/.exec(single[0].trim())?.[1];
    const start = parseToken(single[0]);
    const timePeriod = period ? PERIODS[period] : undefined;
    return { startTime: start.value, ...(timePeriod ? { timePeriod } : {}), span: { start: single.index, end: single.index + single[0].length, text: single[0] }, ambiguities: start.ambiguous ? [start.ambiguous] : [] };
  }
  const periodOnly = /(아침|점심|저녁|밤)(?:에)?(?=\s|$)/.exec(input);
  if (!periodOnly) return { ambiguities: [] };
  return {
    timePeriod: PERIODS[periodOnly[1]],
    span: { start: periodOnly.index, end: periodOnly.index + periodOnly[0].length, text: periodOnly[0] },
    ambiguities: [`${periodOnly[1]}으로 인식했지만 정확한 시간을 입력해 주세요.`],
  };
}
