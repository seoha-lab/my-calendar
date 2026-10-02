import type { EventCategory } from '@/lib/calendar/categories';

const CATEGORY_RULES: { category: EventCategory; keywords: string[] }[] = [
  { category: 'graduate', keywords: ['대학원 수업', '대학원', '세미나'] },
  { category: 'hospital', keywords: ['병원', '근무', '응급실', 'D7', 'N7', '데이', '나이트'] },
  { category: 'lecture', keywords: ['강의안', '강의', '수업', '학생', '교수'] },
  { category: 'research', keywords: ['논문', '연구', '분석', '통계', 'IRB'] },
  { category: 'study', keywords: ['시험', '공부', '암기', '복습'] },
  { category: 'exercise', keywords: ['수영', '운동', '헬스', '러닝'] },
  { category: 'personal', keywords: ['약속', '친구', '식사', '데이트'] },
];

export function inferCategory(text: string): EventCategory {
  const normalized = text.toLocaleLowerCase('ko-KR');
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase('ko-KR')))) return rule.category;
  }
  return 'other';
}

