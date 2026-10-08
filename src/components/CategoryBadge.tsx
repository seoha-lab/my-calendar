import { normalizeCategory, type EventCategory } from '@/lib/calendar/categories';
import { messages } from '@/lib/i18n';
import { useCategoryPreferences } from '@/lib/calendar/categoryPreferences';
export default function CategoryBadge({ category }: { category?: EventCategory }) {
  const key = normalizeCategory(category);
  const labels = useCategoryPreferences((state) => state.labels);
  const customCategories = useCategoryPreferences((state) => state.customCategories);
  const label = customCategories.find((item) => item.id === key)?.label ?? (key in labels ? labels[key as keyof typeof labels] : undefined) ?? (key in messages.categories ? messages.categories[key as keyof typeof messages.categories] : '추가 카테고리');
  return <span className={`category-badge category-${key}`}><span className="category-dot" aria-hidden="true" />{label}</span>;
}
