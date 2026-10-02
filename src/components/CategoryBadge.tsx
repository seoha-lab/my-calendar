import { normalizeCategory, type EventCategory } from '@/lib/calendar/categories';
import { messages } from '@/lib/i18n';
export default function CategoryBadge({ category }: { category?: EventCategory }) {
  const key = normalizeCategory(category);
  return <span className={`category-badge category-${key}`}><span className="category-dot" aria-hidden="true" />{messages.categories[key]}</span>;
}
