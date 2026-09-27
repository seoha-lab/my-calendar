import { EVENT_CATEGORIES, normalizeCategory, type EventCategory } from '@/lib/calendar/categories';
import { messages } from '@/lib/i18n';
export default function CategorySelect({ value, onChange }: { value?: EventCategory; onChange: (category: EventCategory) => void }) {
  return <label className="flex flex-col gap-1 text-sm">
    <span>{messages.category}</span>
    <select className="input" value={normalizeCategory(value)} onChange={(event) => onChange(normalizeCategory(event.target.value))}>
      {EVENT_CATEGORIES.map((category) => <option key={category} value={category}>{messages.categories[category]}</option>)}
    </select>
  </label>;
}
