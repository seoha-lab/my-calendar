'use client';
import { useEffect } from 'react';
import { EVENT_CATEGORIES } from '@/lib/calendar/categories';
import { CALENDAR_THEME_STORAGE_KEY, useCalendarTheme } from '@/lib/theme/calendarThemeStore';
import { getCalendarTheme } from '@/lib/theme/themes';
import { eventColors } from '@/lib/theme/contrast';
import { CATEGORY_PREFERENCES_STORAGE_KEY, useCategoryPreferences } from '@/lib/calendar/categoryPreferences';

export default function CalendarThemeStyles() {
  const themeId = useCalendarTheme((state) => state.themeId);
  const hydrate = useCalendarTheme((state) => state.hydrate);
  const customColors = useCategoryPreferences((state) => state.colors);
  const customCategories = useCategoryPreferences((state) => state.customCategories);
  const hydrateCategoryPreferences = useCategoryPreferences((state) => state.hydrate);
  useEffect(() => {
    hydrate();
    hydrateCategoryPreferences();
    const onStorage = (event: StorageEvent) => {
      if (event.key === CALENDAR_THEME_STORAGE_KEY || event.key === null) hydrate();
      if (event.key === CATEGORY_PREFERENCES_STORAGE_KEY || event.key === null) hydrateCategoryPreferences();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [hydrate, hydrateCategoryPreferences]);
  const theme = getCalendarTheme(themeId);
  const css = [false, true].map((dark) => {
    const baseCss = EVENT_CATEGORIES.map((category) => {
      const colors = eventColors(customColors[category] || theme.categoryColors[category], dark);
      return `${dark ? '.dark ' : ''}.category-${category} { --category-bg: ${colors.background}; --category-accent: ${colors.accent}; --category-text: ${colors.text}; }`;
    });
    const additionalCss = customCategories.map((category) => {
      const colors = eventColors(category.color, dark);
      return `${dark ? '.dark ' : ''}.category-${category.id} { --category-bg: ${colors.background}; --category-accent: ${colors.accent}; --category-text: ${colors.text}; }`;
    });
    return [...baseCss, ...additionalCss].join('\n');
  }).join('\n');
  return <style>{css}</style>;
}
