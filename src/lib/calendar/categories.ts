export const EVENT_CATEGORIES = ['hospital', 'lecture', 'graduate', 'research', 'study', 'exercise', 'personal', 'other'] as const;
export type DefaultEventCategory = typeof EVENT_CATEGORIES[number];
export type CustomEventCategory = `custom-${string}`;
export type EventCategory = DefaultEventCategory | CustomEventCategory;

// Custom IDs are generated from UUIDs and safe to embed in CSS class names.
const CUSTOM_CATEGORY_ID = /^custom-[a-f0-9]{32}$/;
export function isCustomCategory(value: unknown): value is CustomEventCategory {
  return typeof value === 'string' && CUSTOM_CATEGORY_ID.test(value);
}
export function normalizeCategory(value: unknown): EventCategory {
  if (isCustomCategory(value)) return value;
  return EVENT_CATEGORIES.find((category) => category === value) ?? 'other';
}
