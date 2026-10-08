import type { DefaultEventCategory } from '../calendar/categories';
export type CalendarTheme = { id: string; name: string; categoryColors: Record<DefaultEventCategory, string> };
export const CALENDAR_THEMES = [
  { id: 'soft-pastel', name: 'Soft Pastel', categoryColors: { hospital: '#D8A2A2', lecture: '#A9C9E8', graduate: '#C8B6D9', research: '#9FC5C1', study: '#F2DFA7', exercise: '#8EA66B', personal: '#F3C6A8', other: '#C9C7C1' } },
  { id: 'muted-sage-blue', name: 'Muted Sage & Blue', categoryColors: { hospital: '#C78383', lecture: '#91B9D6', graduate: '#AAA0C8', research: '#6FA5A2', study: '#D8BD78', exercise: '#8EA66B', personal: '#EAB9A1', other: '#AEB7B3' } },
  { id: 'clear-pastel', name: 'Clear Pastel', categoryColors: { hospital: '#E8A9B0', lecture: '#9BC4E2', graduate: '#B9A7DE', research: '#8CC7BC', study: '#F1D889', exercise: '#A8C686', personal: '#F4BFA6', other: '#C4C9CE' } },
] as const satisfies readonly CalendarTheme[];
export type CalendarThemeId = typeof CALENDAR_THEMES[number]['id'];
export const DEFAULT_CALENDAR_THEME = CALENDAR_THEMES[0];
export function getCalendarTheme(id: unknown): CalendarTheme {
  return CALENDAR_THEMES.find((theme) => theme.id === id) ?? DEFAULT_CALENDAR_THEME;
}
