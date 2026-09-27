import { format as dateFnsFormat } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { DEFAULT_LOCALE, type Locale } from './index';
const koreanPatterns: Record<string, string> = {
  'MMM d': 'M월 d일', 'MMM d, p': 'M월 d일 a h:mm', 'p': 'a h:mm',
  'EEE, MMM d, yyyy': 'yyyy년 M월 d일 EEEE', 'EEE, MMM d': 'M월 d일 EEEE',
  'MMM d, yyyy p': 'yyyy년 M월 d일 a h:mm', 'MMM d p': 'M월 d일 a h:mm',
  'EEE, MMM d • h:mm a': 'M월 d일 EEEE • a h:mm', 'MMMM yyyy': 'yyyy년 M월',
  'h a': 'a h시', 'h:mm a': 'a h:mm',
};
export function format(date: Date | number, pattern: string, locale: Locale = DEFAULT_LOCALE): string {
  return dateFnsFormat(date, locale === 'ko-KR' ? (koreanPatterns[pattern] ?? pattern) : pattern, { locale: locale === 'ko-KR' ? ko : enUS });
}
