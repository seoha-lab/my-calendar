'use client';
import { CALENDAR_THEMES } from '@/lib/theme/themes';
import { useCalendarTheme } from '@/lib/theme/calendarThemeStore';
import { EVENT_CATEGORIES } from '@/lib/calendar/categories';
import { messages } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { useCategoryPreferences } from '@/lib/calendar/categoryPreferences';
export default function CalendarThemeSettings() {
  const themeId = useCalendarTheme((state) => state.themeId);
  const selectTheme = useCalendarTheme((state) => state.selectTheme);
  const labels = useCategoryPreferences((state) => state.labels);
  const colors = useCategoryPreferences((state) => state.colors);
  return <fieldset className="card p-4 space-y-3 lg:col-span-2">
    <legend className="font-medium px-1">{messages.calendarTheme}</legend>
    <p className="text-sm text-gray-600 dark:text-gray-300">{messages.themeDescription}</p>
    <div className="grid gap-3 md:grid-cols-3">
      {CALENDAR_THEMES.map((theme) => <label key={theme.id} className={`cursor-pointer rounded-xl p-3 border ${theme.id === themeId ? 'border-slate-500 dark:border-slate-300' : 'border-gray-200 dark:border-slate-700'}`}>
        <span className="flex items-center gap-2 text-sm font-medium">
          <input type="radio" name="calendar-theme" aria-label={theme.name} value={theme.id} checked={theme.id === themeId} onChange={() => {
            if (!selectTheme(theme.id)) toast(messages.themeSaveError);
          }} />{theme.name}
        </span>
        <span className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
          {EVENT_CATEGORIES.map((category) => <span key={category} className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ background: colors[category] || theme.categoryColors[category] }} aria-hidden="true" />
            {labels[category] || messages.categories[category]}
          </span>)}
        </span>
      </label>)}
    </div>
  </fieldset>;
}
