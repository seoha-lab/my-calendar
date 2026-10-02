import type { ParsedShift } from './types';
import { parseKoreanDate } from './dateParser';

const SHIFT_CODES: Record<string, ParsedShift['shiftCode']> = { D7: 'D7', 데이: 'D7', N7: 'N7', 나이트: 'N7', OFF: 'OFF', 오프: 'OFF' };

export function parseShiftInput(input: string, referenceDate: Date): ParsedShift | undefined {
  const match = /(?:^|\s)(D7|N7|OFF|데이|나이트|오프)(?=\s|$)/i.exec(input);
  if (!match) return undefined;
  const date = parseKoreanDate(input, referenceDate);
  const ambiguities = [...date.ambiguities];
  if (!date.date) ambiguities.push('근무 날짜를 선택해 주세요.');
  return {
    kind: 'shift',
    date: date.date,
    shiftCode: SHIFT_CODES[match[1].toUpperCase()] ?? SHIFT_CODES[match[1]],
    category: 'hospital',
    confidence: date.date && ambiguities.length === 0 ? 1 : 0.65,
    ambiguities,
  };
}

