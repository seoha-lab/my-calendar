'use client';

import { EVENT_CATEGORIES } from '@/lib/calendar/categories';
import { CATEGORY_PREFERENCES_STORAGE_KEY, useCategoryPreferences } from '@/lib/calendar/categoryPreferences';
import { getFreeTimePreferences, setFreeTimePreferences } from '@/lib/preferences/freeTime';
import { CALENDAR_THEME_STORAGE_KEY, useCalendarTheme } from '@/lib/theme/calendarThemeStore';
import { DEFAULT_CALENDAR_THEME, getCalendarTheme } from '@/lib/theme/themes';
import { applyTheme, getStoredTheme } from '@/lib/theme';
import type { SyncedCategory, SyncedPreferences } from './types';

const DEFAULT_LABELS: Record<string, string> = {
  hospital: '병원', lecture: '강의', graduate: '대학원', research: '연구',
  study: '공부', exercise: '운동', personal: '개인', other: '기타',
};
const PREFERENCE_KEYS = [
  CATEGORY_PREFERENCES_STORAGE_KEY, CALENDAR_THEME_STORAGE_KEY, 'clarity:theme',
  'clarity:hide-done', 'clarity:free-time-preferences', 'daymo:preferences-updated-at',
] as const;

export function switchPreferenceNamespace(userId: string | null, preserveCurrent = false): void {
  const previous = localStorage.getItem('daymo:last-preferences-user');
  if (previous && previous !== userId) {
    const values = Object.fromEntries(PREFERENCE_KEYS.map((key) => [key, localStorage.getItem(key)]));
    localStorage.setItem(`daymo:preferences:${previous}`, JSON.stringify(values));
  }
  const saved = userId ? localStorage.getItem(`daymo:preferences:${userId}`) : null;
  if (previous !== userId && !(preserveCurrent && !previous && !saved)) {
    for (const key of PREFERENCE_KEYS) localStorage.removeItem(key);
    if (saved) {
      try {
        const values = JSON.parse(saved) as Record<string, string | null>;
        for (const key of PREFERENCE_KEYS) if (typeof values[key] === 'string') localStorage.setItem(key, values[key]!);
      } catch {}
    }
  }
  if (userId) localStorage.setItem('daymo:last-preferences-user', userId);
  else localStorage.removeItem('daymo:last-preferences-user');
  useCategoryPreferences.getState().hydrate();
  useCalendarTheme.getState().hydrate();
}

export function readSyncedPreferences(): SyncedPreferences {
  return {
    theme: getStoredTheme() ?? 'light',
    calendarTheme: localStorage.getItem(CALENDAR_THEME_STORAGE_KEY) || DEFAULT_CALENDAR_THEME.id,
    hideDone: localStorage.getItem('clarity:hide-done') === '1',
    freeTime: getFreeTimePreferences(),
  };
}

export function applySyncedPreferences(value: SyncedPreferences): void {
  if (value.theme) applyTheme(value.theme);
  if (value.calendarTheme) {
    const id = getCalendarTheme(value.calendarTheme).id;
    localStorage.setItem(CALENDAR_THEME_STORAGE_KEY, id);
    useCalendarTheme.getState().selectTheme(id);
  }
  if (typeof value.hideDone === 'boolean') localStorage.setItem('clarity:hide-done', value.hideDone ? '1' : '0');
  if (value.freeTime) setFreeTimePreferences(value.freeTime);
}

export function readSyncedCategories(now = new Date().toISOString()): SyncedCategory[] {
  const state = useCategoryPreferences.getState();
  const theme = getCalendarTheme(localStorage.getItem(CALENDAR_THEME_STORAGE_KEY));
  let updatedAt = now;
  let categoryTimestamps: Record<string, string> = {};
  let needsTimestampPersistence = false;
  try {
    const raw = JSON.parse(localStorage.getItem(CATEGORY_PREFERENCES_STORAGE_KEY) || '{}');
    if (typeof raw.updatedAt === 'string') updatedAt = raw.updatedAt;
    else needsTimestampPersistence = true;
    if (raw.categoryTimestamps && typeof raw.categoryTimestamps === 'object') categoryTimestamps = raw.categoryTimestamps;
  } catch {}
  const builtins = EVENT_CATEGORIES.map((id) => ({
    id,
    label: state.labels[id] || DEFAULT_LABELS[id],
    color: state.colors[id] || theme.categoryColors[id],
    isBuiltin: true,
    updatedAt: categoryTimestamps[id] || updatedAt,
  }));
  const categories = [...builtins, ...state.customCategories.map((category) => ({ ...category, isBuiltin: false, updatedAt: categoryTimestamps[category.id] || updatedAt }))];
  if (categories.some((category) => !categoryTimestamps[category.id])) needsTimestampPersistence = true;
  if (needsTimestampPersistence) {
    const persistedTimestamps = Object.fromEntries(categories.map((category) => [category.id, category.updatedAt]));
    const value = { labels: state.labels, colors: state.colors, customCategories: state.customCategories, categoryTimestamps: persistedTimestamps, updatedAt };
    localStorage.setItem(CATEGORY_PREFERENCES_STORAGE_KEY, JSON.stringify(value));
  }
  return categories;
}

export function applySyncedCategories(categories: SyncedCategory[]): void {
  const current = useCategoryPreferences.getState();
  const labels: Record<string, string> = {};
  const colors: Record<string, string> = {};
  const categoryTimestamps: Record<string, string> = {};
  const customCategories: { id: `custom-${string}`; label: string; color: string }[] = [];
  for (const category of categories) {
    if (category.deletedAt) continue;
    categoryTimestamps[category.id] = category.updatedAt;
    if ((EVENT_CATEGORIES as readonly string[]).includes(category.id)) {
      labels[category.id] = category.label;
      colors[category.id] = category.color;
    } else if (category.id.startsWith('custom-')) {
      customCategories.push({ id: category.id as `custom-${string}`, label: category.label, color: category.color });
    }
  }
  const newest = categories.reduce((value, category) => category.updatedAt > value ? category.updatedAt : value, '');
  const value = { labels, colors, customCategories, categoryTimestamps, updatedAt: newest || new Date().toISOString() };
  localStorage.setItem(CATEGORY_PREFERENCES_STORAGE_KEY, JSON.stringify(value));
  current.hydrate();
}
