'use client';

import { create } from 'zustand';
import { EVENT_CATEGORIES, type EventCategory } from './categories';

export const CATEGORY_PREFERENCES_STORAGE_KEY = 'daymo:category-preferences:v1';

type Preferences = {
  labels: Partial<Record<EventCategory, string>>;
  colors: Partial<Record<EventCategory, string>>;
};

type CategoryPreferencesState = Preferences & {
  hydrate: () => void;
  setLabel: (category: EventCategory, label: string) => void;
  setColor: (category: EventCategory, color: string) => void;
  reset: () => void;
};

const VALID_HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function allowedCategory(key: string): key is EventCategory {
  return EVENT_CATEGORIES.some((category) => category === key);
}

function cleanPreferences(value: unknown): Preferences {
  const labels: Preferences['labels'] = {};
  const colors: Preferences['colors'] = {};
  if (typeof value !== 'object' || value === null) return { labels, colors };
  const raw = value as Record<string, unknown>;
  const rawLabels = raw.labels && typeof raw.labels === 'object' ? raw.labels as Record<string, unknown> : {};
  const rawColors = raw.colors && typeof raw.colors === 'object' ? raw.colors as Record<string, unknown> : {};
  for (const key of EVENT_CATEGORIES) {
    const label = rawLabels[key];
    const color = rawColors[key];
    if (typeof label === 'string' && label.trim().length > 0 && label.trim().length <= 30) labels[key] = label.trim();
    if (typeof color === 'string' && VALID_HEX_COLOR.test(color)) colors[key] = color;
  }
  return { labels, colors };
}

function savePreferences(preferences: Preferences): void {
  try { localStorage.setItem(CATEGORY_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences)); } catch {}
}

export const useCategoryPreferences = create<CategoryPreferencesState>((set) => ({
  labels: {},
  colors: {},
  hydrate: () => {
    try {
      const value = localStorage.getItem(CATEGORY_PREFERENCES_STORAGE_KEY);
      set(cleanPreferences(value ? JSON.parse(value) : null));
    } catch { set({ labels: {}, colors: {} }); }
  },
  setLabel: (category, label) => set((state) => {
    if (!allowedCategory(category)) return state;
    const labels = { ...state.labels };
    if (label.trim()) labels[category] = label.trim().slice(0, 30);
    else delete labels[category];
    savePreferences({ labels, colors: state.colors });
    return { labels };
  }),
  setColor: (category, color) => set((state) => {
    if (!allowedCategory(category) || !VALID_HEX_COLOR.test(color)) return state;
    const colors = { ...state.colors, [category]: color };
    savePreferences({ labels: state.labels, colors });
    return { colors };
  }),
  reset: () => {
    try { localStorage.removeItem(CATEGORY_PREFERENCES_STORAGE_KEY); } catch {}
    set({ labels: {}, colors: {} });
  },
}));
