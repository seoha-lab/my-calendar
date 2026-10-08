import { EVENT_CATEGORIES, normalizeCategory, isCustomCategory, type EventCategory } from '@/lib/calendar/categories';
import { messages } from '@/lib/i18n';
import { useCategoryPreferences } from '@/lib/calendar/categoryPreferences';
export default function CategorySelect({ value, onChange, label }: { value?: EventCategory; onChange: (category: EventCategory) => void; label?: string }) {
  const labels = useCategoryPreferences((state) => state.labels);
  const customCategories = useCategoryPreferences((state) => state.customCategories);
  const selected = normalizeCategory(value);
  const unrecognized = isCustomCategory(selected) && !customCategories.some((item) => item.id === selected);
  return <label className="flex flex-col gap-1 text-sm">
    <span>{label ?? messages.category}</span>
    <select className="input" value={selected} onChange={(event) => onChange(normalizeCategory(event.target.value))}>
      {EVENT_CATEGORIES.map((category) => <option key={category} value={category}>{labels[category] || messages.categories[category]}</option>)}
      {customCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
      {unrecognized && <option value={selected}>이 브라우저에서 이름을 찾을 수 없는 추가 카테고리</option>}
    </select>
  </label>;
}
