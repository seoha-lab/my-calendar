import { ko } from './ko';
import { en } from './en';
export type Locale = 'ko-KR' | 'en-US';
export const DEFAULT_LOCALE: Locale = 'ko-KR';
export const dictionaries = { 'ko-KR': ko, 'en-US': en };
export const messages = dictionaries[DEFAULT_LOCALE];

import { koUI } from "./ko";
import { enUI } from "./en";
export function t(key: keyof typeof enUI, locale: Locale = DEFAULT_LOCALE): string { return (locale === "ko-KR" ? koUI : enUI)[key]; }

import { enTemplates } from './en';
import { koTemplates } from './ko';
export function interpolate(key: keyof typeof enTemplates, values: Record<string, string | number>, locale: Locale = DEFAULT_LOCALE): string {
  return (locale === 'ko-KR' ? koTemplates : enTemplates)[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''));
}
export function relativeTime(value: number, unit: Intl.RelativeTimeFormatUnit): string {
  return new Intl.RelativeTimeFormat(DEFAULT_LOCALE).format(value, unit);
}
