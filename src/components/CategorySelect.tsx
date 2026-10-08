import { EVENT_CATEGORIES, normalizeCategory, type EventCategory } from '@/lib/calendar/categories';
import { messages } from '@/lib/i18n';
import { useCategoryPreferences } from '@/lib/calendar/categoryPreferences';
export default function CategorySelect({ value, onChange, label }: { value?: EventCategory; onChange: (category: EventCategory) => void; label?: string }) {
  const labels = useCategoryPreferences((state) => state.labels);
  return <label className="flex flex-col gap-1 text-sm">
    <span>{label ?? messages.category}</span>
    <select className="input" value={normalizeCategory(value)} onChange={(event) => onChange(normalizeCategory(event.target.value))}>
      {EVENT_CATEGORIES.map((category) => <option key={category} value={category}>{labels[category] || messages.categories[category]}</option>)}
    </select>
  </label>;
}
