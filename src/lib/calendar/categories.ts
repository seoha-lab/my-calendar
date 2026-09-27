export const EVENT_CATEGORIES = ['hospital', 'lecture', 'graduate', 'research', 'study', 'exercise', 'personal', 'other'] as const;
export type EventCategory = typeof EVENT_CATEGORIES[number];
export function normalizeCategory(value: unknown): EventCategory {
  return EVENT_CATEGORIES.find((category) => category === value) ?? 'other';
}
