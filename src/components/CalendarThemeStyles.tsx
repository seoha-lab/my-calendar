'use client';
import { useEffect } from 'react';
import { EVENT_CATEGORIES } from '@/lib/calendar/categories';
import { CALENDAR_THEME_STORAGE_KEY, useCalendarTheme } from '@/lib/theme/calendarThemeStore';
import { getCalendarTheme } from '@/lib/theme/themes';
import { eventColors } from '@/lib/theme/contrast';

export default function CalendarThemeStyles() {
  const themeId = useCalendarTheme((state) => state.themeId);
  const hydrate = useCalendarTheme((state) => state.hydrate);
  useEffect(() => {
    hydrate();
    const onStorage = (event: StorageEvent) => {
      if (event.key === CALENDAR_THEME_STORAGE_KEY || event.key === null) hydrate();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [hydrate]);
  const theme = getCalendarTheme(themeId);
  const css = [false, true].map((dark) => EVENT_CATEGORIES.map((category) => {
    const colors = eventColors(theme.categoryColors[category], dark);
    return `${dark ? '.dark ' : ''}.category-${category} { --category-bg: ${colors.background}; --category-accent: ${colors.accent}; --category-text: ${colors.text}; }`;
  }).join('\n')).join('\n');
  return <style>{css}</style>;
}
