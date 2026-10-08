'use client';

import { create } from 'zustand';
import { EVENT_CATEGORIES, isCustomCategory, type DefaultEventCategory, type CustomEventCategory } from './categories';

export const CATEGORY_PREFERENCES_STORAGE_KEY = 'daymo:category-preferences:v1';

// Additional pastel colors that complement the eight existing category chips.
export const SUGGESTED_CATEGORY_COLORS = [
  '#B5A4DF', '#87B9D6', '#E7AD9C', '#A4C7A0', '#D6ADD0',
  '#D8C28D', '#87C1B9', '#C8AAC1', '#AAB8D8', '#D7B29A',
] as const;
export const VALID_HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export type CustomCategory = { id: CustomEventCategory; label: string; color: string };
type Preferences = {
  labels: Partial<Record<DefaultEventCategory, string>>;
  colors: Partial<Record<DefaultEventCategory, string>>;
  customCategories: CustomCategory[];
};
type CategoryPreferencesState = Preferences & {
  hydrate: () => void;
  setLabel: (category: DefaultEventCategory, label: string) => void;
  setColor: (category: DefaultEventCategory, color: string) => void;
  addCustomCategory: (label: string, color: string) => CustomCategory;
  updateCustomCategory: (id: CustomEventCategory, patch: Partial<Pick<CustomCategory, 'label' | 'color'>>) => void;
  reset: () => void;
};

function isDefaultCategory(key: string): key is DefaultEventCategory {
  return EVENT_CATEGORIES.some((category) => category === key);
}
function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 30);
}
function cleanPreferences(value: unknown): Preferences {
  const labels: Preferences['labels'] = {};
  const colors: Preferences['colors'] = {};
  const customCategories: CustomCategory[] = [];
  if (typeof value !== 'object' || value === null) return { labels, colors, customCategories };
  const raw = value as Record<string, unknown>;
  const rawLabels = raw.labels && typeof raw.labels === 'object' ? raw.labels as Record<string, unknown> : {};
  const rawColors = raw.colors && typeof raw.colors === 'object' ? raw.colors as Record<string, unknown> : {};
  for (const key of EVENT_CATEGORIES) {
    const label = rawLabels[key];
    const color = rawColors[key];
    if (typeof label === 'string' && normalizeName(label)) labels[key] = normalizeName(label);
    if (typeof color === 'string' && VALID_HEX_COLOR.test(color)) colors[key] = color;
  }
  const seen = new Set<string>();
  const customs = Array.isArray(raw.customCategories) ? raw.customCategories : [];
  for (const item of customs) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;
    if (!isCustomCategory(candidate.id) || seen.has(candidate.id)) continue;
    if (typeof candidate.label !== 'string' || !normalizeName(candidate.label)) continue;
    if (typeof candidate.color !== 'string' || !VALID_HEX_COLOR.test(candidate.color)) continue;
    seen.add(candidate.id);
    customCategories.push({
      id: candidate.id, label: normalizeName(candidate.label), color: candidate.color,
    });
  }
  return { labels, colors, customCategories };
}
function savePreferences(preferences: Preferences): void {
  try { localStorage.setItem(CATEGORY_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences)); } catch {}
}
export function getSuggestedCategoryColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((color) => color.toLowerCase()));
  return SUGGESTED_CATEGORY_COLORS.find((color) => !used.has(color.toLowerCase()))
    ?? SUGGESTED_CATEGORY_COLORS[usedColors.length % SUGGESTED_CATEGORY_COLORS.length];
}

export const useCategoryPreferences = create<CategoryPreferencesState>((set, get) => ({
  labels: {},
  colors: {},
  customCategories: [],
  hydrate: () => {
    try {
      const value = localStorage.getItem(CATEGORY_PREFERENCES_STORAGE_KEY);
      set(cleanPreferences(value ? JSON.parse(value) : null));
    } catch { set({ labels: {}, colors: {}, customCategories: [] }); }
  },
  setLabel: (category, label) => set((state) => {
    if (!isDefaultCategory(category)) return state;
    const labels = { ...state.labels };
    const nextLabel = normalizeName(label);
    if (nextLabel) labels[category] = nextLabel;
    else delete labels[category];
    savePreferences({ labels, colors: state.colors, customCategories: state.customCategories });
    return { labels };
  }),
  setColor: (category, color) => set((state) => {
    if (!isDefaultCategory(category) || !VALID_HEX_COLOR.test(color)) return state;
    const colors = { ...state.colors, [category]: color };
    savePreferences({ labels: state.labels, colors, customCategories: state.customCategories });
    return { colors };
  }),
  addCustomCategory: (label, color) => {
    const cleaned = normalizeName(label);
    if (!cleaned) throw new Error('카테고리 이름을 입력해 주세요.');
    if (!VALID_HEX_COLOR.test(color)) throw new Error('올바른 색상을 선택해 주세요.');
    if (get().customCategories.some((item) => item.label.toLowerCase() === cleaned.toLowerCase())) {
      throw new Error('같은 이름의 추가 카테고리가 이미 있습니다.');
    }
    const category: CustomCategory = {
      id: `custom-${crypto.randomUUID().replace(/-/g, '')}`,
      label: cleaned,
      color,
    };
    set((state) => {
      const customCategories = [...state.customCategories, category];
      savePreferences({ labels: state.labels, colors: state.colors, customCategories });
      return { customCategories };
    });
    return category;
  },
  updateCustomCategory: (id, patch) => {
    if (!isCustomCategory(id)) return;
    const current = get().customCategories.find((item) => item.id === id);
    if (!current) return;
    const label = patch.label === undefined ? current.label : normalizeName(patch.label);
    const color = patch.color ?? current.color;
    if (!label) throw new Error('카테고리 이름을 입력해 주세요.');
    if (!VALID_HEX_COLOR.test(color)) throw new Error('올바른 색상을 선택해 주세요.');
    if (get().customCategories.some((item) => item.id !== id && item.label.toLowerCase() === label.toLowerCase())) {
      throw new Error('같은 이름의 추가 카테고리가 이미 있습니다.');
    }
    set((state) => {
      const customCategories = state.customCategories.map((item) => item.id === id ? { ...item, label, color } : item);
      savePreferences({ labels: state.labels, colors: state.colors, customCategories });
      return { customCategories };
    });
  },
  // Reset only the original eight presets; never silently delete user-created categories.
  reset: () => set((state) => {
    savePreferences({ labels: {}, colors: {}, customCategories: state.customCategories });
    return { labels: {}, colors: {} };
  }),
}));
