'use client';

import { useMemo, useState } from 'react';
import { Check, Palette, Plus, RotateCcw } from 'lucide-react';
import { EVENT_CATEGORIES, type DefaultEventCategory, type CustomEventCategory } from '@/lib/calendar/categories';
import {
  SUGGESTED_CATEGORY_COLORS,
  getSuggestedCategoryColor,
  useCategoryPreferences,
} from '@/lib/calendar/categoryPreferences';
import { getCalendarTheme } from '@/lib/theme/themes';
import { useCalendarTheme } from '@/lib/theme/calendarThemeStore';
import { messages } from '@/lib/i18n';
import { toast } from '@/lib/toast';

const colorInputClass = 'h-10 w-12 cursor-pointer rounded-md border border-gray-200 bg-white p-1 dark:border-slate-600';

export default function CategorySettings() {
  const labels = useCategoryPreferences((state) => state.labels);
  const colors = useCategoryPreferences((state) => state.colors);
  const customCategories = useCategoryPreferences((state) => state.customCategories);
  const setLabel = useCategoryPreferences((state) => state.setLabel);
  const setColor = useCategoryPreferences((state) => state.setColor);
  const addCustomCategory = useCategoryPreferences((state) => state.addCustomCategory);
  const updateCustomCategory = useCategoryPreferences((state) => state.updateCustomCategory);
  const reset = useCategoryPreferences((state) => state.reset);
  const themeId = useCalendarTheme((state) => state.themeId);
  const theme = getCalendarTheme(themeId);
  const [draftLabels, setDraftLabels] = useState<Partial<Record<DefaultEventCategory, string>>>({});
  const [customDraftLabels, setCustomDraftLabels] = useState<Partial<Record<CustomEventCategory, string>>>({});
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState('');

  const usedColors = useMemo(
    () => [
      ...EVENT_CATEGORIES.map((category) => colors[category] || theme.categoryColors[category]),
      ...customCategories.map((category) => category.color),
    ],
    [colors, theme, customCategories],
  );
  const recommendedColor = getSuggestedCategoryColor(usedColors);
  const newColor = selectedColor || recommendedColor;
  const add = () => {
    try {
      addCustomCategory(newName, newColor);
      setNewName('');
      setSelectedColor('');
      toast('카테고리를 추가했습니다.');
    } catch (error) {
      toast(error instanceof Error ? error.message : '카테고리를 추가하지 못했습니다.');
    }
  };
  const updateName = (id: CustomEventCategory, value: string) => {
    try {
      updateCustomCategory(id, { label: value });
    } catch (error) {
      toast(error instanceof Error ? error.message : '카테고리 이름을 저장하지 못했습니다.');
    }
    setCustomDraftLabels((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  return (
    <section className="card space-y-5 p-4 lg:col-span-2" aria-label="카테고리 편집">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-medium"><Palette className="h-4 w-4 text-gray-500" />카테고리 편집</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">기본 8개 컬러칩을 유지하면서 원하는 카테고리를 추가할 수 있습니다.</p>
        </div>
        <button type="button" className="btn flex min-h-10 items-center gap-1.5" onClick={() => { reset(); setDraftLabels({}); }}>
          <RotateCcw className="h-4 w-4" /> 기본 8개 색상·이름 복원
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">기본 카테고리 8개</h3>
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
                    className={colorInputClass}
                    aria-label={`${messages.categories[category]} 카테고리 색상`}
                    value={colors[category] || theme.categoryColors[category]}
                    onChange={(event) => setColor(category, event.target.value)}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 border-t border-gray-200 pt-5 dark:border-slate-700">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Plus className="h-4 w-4" />새 카테고리 추가</h3>
          <p className="mt-1 text-xs text-gray-500">추천 색상 중 하나를 선택하거나 색상 선택기로 원하는 색을 직접 지정할 수 있습니다.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span>새 카테고리 이름</span>
            <input
              className="input"
              value={newName}
              maxLength={30}
              placeholder="예: 결혼 준비"
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }}
            />
          </label>
          <button className="btn btn-primary flex min-h-11 items-center justify-center gap-2" type="button" disabled={!newName.trim()} onClick={add}>
            <Plus className="h-4 w-4" />카테고리 추가
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">추천 컬러 <span className="text-xs font-normal text-gray-500">(선택하지 않으면 추천 색상 자동 적용)</span></p>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="추천 컬러 선택">
            {SUGGESTED_CATEGORY_COLORS.map((color, index) => (
              <button
                type="button"
                key={color}
                aria-label={`추천 색상 ${index + 1} 선택`}
                aria-pressed={newColor.toLowerCase() === color.toLowerCase()}
                title={color}
                onClick={() => setSelectedColor(color)}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 ${newColor.toLowerCase() === color.toLowerCase() ? 'border-slate-900 ring-2 ring-offset-2 ring-slate-500 dark:border-white' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
              >
                {newColor.toLowerCase() === color.toLowerCase() && <Check className="h-4 w-4 text-slate-900" />}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="color"
            className={colorInputClass}
            value={newColor}
            aria-label="새 카테고리 색상 직접 선택"
            onChange={(event) => setSelectedColor(event.target.value)}
          />
          <span>직접 색상 선택 <span className="font-mono text-xs text-gray-500">{newColor.toUpperCase()}</span></span>
        </label>
      </div>

      {customCategories.length > 0 && (
        <div className="space-y-3 border-t border-gray-200 pt-5 dark:border-slate-700">
          <h3 className="text-sm font-semibold">내가 추가한 카테고리 ({customCategories.length}개)</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {customCategories.map((category) => (
              <div key={category.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-slate-700">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-500">
                  카테고리 이름
                  <input
                    className="input w-full text-sm"
                    aria-label={`${category.label} 카테고리 이름 편집`}
                    maxLength={30}
                    value={customDraftLabels[category.id] ?? category.label}
                    onChange={(event) => setCustomDraftLabels((current) => ({ ...current, [category.id]: event.target.value }))}
                    onBlur={(event) => updateName(category.id, event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                  />
                </label>
                <label className="flex shrink-0 flex-col gap-1 text-xs text-gray-500">
                  표시 색상
                  <input
                    type="color"
                    className={colorInputClass}
                    aria-label={`${category.label} 카테고리 색상 편집`}
                    value={category.color}
                    onChange={(event) => updateCustomCategory(category.id, { color: event.target.value })}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-gray-500">기본값 복원은 기본 8개만 초기화하며, 직접 추가한 카테고리는 그대로 유지합니다. 카테고리 설정은 현재 브라우저에 저장됩니다.</p>
    </section>
  );
}
