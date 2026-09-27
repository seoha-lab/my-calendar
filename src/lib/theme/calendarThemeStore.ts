'use client';
import { create } from 'zustand';
import { DEFAULT_CALENDAR_THEME, getCalendarTheme } from './themes';
export const CALENDAR_THEME_STORAGE_KEY = 'clarity:calendar-theme';
type State = { themeId: string; hydrate: () => void; selectTheme: (id: string) => boolean };
export const useCalendarTheme = create<State>((set) => ({
  themeId: DEFAULT_CALENDAR_THEME.id,
  hydrate: () => {
    try { set({ themeId: getCalendarTheme(localStorage.getItem(CALENDAR_THEME_STORAGE_KEY)).id }); } catch {}
  },
  selectTheme: (id) => {
    const themeId = getCalendarTheme(id).id;
    set({ themeId });
    try { localStorage.setItem(CALENDAR_THEME_STORAGE_KEY, themeId); return true; } catch { return false; }
  },
}));
