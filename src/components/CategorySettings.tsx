'use client';

import { useState } from 'react';
import { Palette, RotateCcw } from 'lucide-react';
import { EVENT_CATEGORIES, type EventCategory } from '@/lib/calendar/categories';
import { useCategoryPreferences } from '@/lib/calendar/categoryPreferences';
import { getCalendarTheme } from '@/lib/theme/themes';
import { useCalendarTheme } from '@/lib/theme/calendarThemeStore';
import { messages } from '@/lib/i18n';

export default function CategorySettings() {
  const labels = useCategoryPreferences((state) => state.labels);
  const colors = useCategoryPreferences((state) => state.colors);
  const setLabel = useCategoryPreferences((state) => state.setLabel);
  const setColor = useCategoryPreferences((state) => state.setColor);
  const reset = useCategoryPreferences((state) => state.reset);
  const themeId = useCalendarTheme((state) => state.themeId);
  const theme = getCalendarTheme(themeId);
  const [draftLabels, setDraftLabels] = useState<Partial<Record<EventCategory, string>>>({});

  return (
    <section className="card space-y-3 p-4 lg:col-span-2" aria-label="카테고리 편집">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-medium"><Palette className="h-4 w-4 text-gray-500" />카테고리 편집</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">기존 카테고리 8개의 이름과 색상을 바꿀 수 있습니다. 일정과 할 일은 그대로 유지됩니다.</p>
        </div>
        <button type="button" className="btn flex min-h-10 items-center gap-1.5" onClick={() => { reset(); setDraftLabels({}); }}>
          <RotateCcw className="h-4 w-4" /> 기본값 복원
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {EVENT_CATEGORIES.map((category) => {
          const displayedLabel = labels[category] || messages.categories[category];
          return (
            <div key={category} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-slate-700">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-500">
                카테고리 이름
                <input
                  className="input w-full text-sm"
                  aria-label={`${messages.categories[category]} 카테고리 이름`}
                  maxLength={30}
                  value={draftLabels[category] ?? displayedLabel}
                  onChange={(event) => setDraftLabels((current) => ({ ...current, [category]: event.target.value }))}
                  onBlur={(event) => {
                    setLabel(category, event.target.value || messages.categories[category]);
                    setDraftLabels((current) => {
                      const next = { ...current };
                      delete next[category];
                      return next;
                    });
                  }}
                  onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                />
              </label>
              <label className="flex shrink-0 flex-col gap-1 text-xs text-gray-500">
                표시 색상
                <input
                  type="color"
                  className="h-10 w-12 cursor-pointer rounded-md border border-gray-200 bg-white p-1 dark:border-slate-600"
                  aria-label={`${messages.categories[category]} 카테고리 색상`}
                  value={colors[category] || theme.categoryColors[category]}
                  onChange={(event) => setColor(category, event.target.value)}
                />
              </label>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500">변경 사항은 이 브라우저에 자동 저장됩니다. 카테고리 자체를 삭제하거나 새로 추가하지는 않습니다.</p>
    </section>
  );
}
