import { normalizeCategory, type EventCategory } from '@/lib/calendar/categories';
import { messages } from '@/lib/i18n';
import { useCategoryPreferences } from '@/lib/calendar/categoryPreferences';
export default function CategoryBadge({ category }: { category?: EventCategory }) {
  const key = normalizeCategory(category);
  const labels = useCategoryPreferences((state) => state.labels);
  return <span className={`category-badge category-${key}`}><span className="category-dot" aria-hidden="true" />{labels[key] || messages.categories[key]}</span>;
}
