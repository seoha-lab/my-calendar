import type { ParsedShift } from './types';
import { parseKoreanDate } from './dateParser';

const SHIFT_CODES: Record<string, string> = {
  D: 'D', E: 'E', N: 'N', D2: 'D2', D7: 'D7', N7: 'N7', OFF: 'OFF',
  데이: 'D', 이브닝: 'E', 나이트: 'N', 오프: 'OFF',
};

export function parseShiftInput(input: string, referenceDate: Date): ParsedShift | undefined {
  const match = /(?:^|\s)(D2|D7|N7|OFF|D|E|N|데이|이브닝|나이트|오프)(?=\s|$)/i.exec(input);
  if (!match) return undefined;
  const raw = match[1];
  const code = SHIFT_CODES[raw.toUpperCase()] ?? SHIFT_CODES[raw];
  const date = parseKoreanDate(input, referenceDate);
  const ambiguities = [...date.ambiguities];
  if (!date.date) ambiguities.push('근무 날짜를 선택해 주세요.');
  return {
    kind: 'shift',
    date: date.date,
    shiftCode: code,
    category: 'hospital',
    confidence: date.date && ambiguities.length === 0 ? 1 : 0.65,
    ambiguities,
  };
}
