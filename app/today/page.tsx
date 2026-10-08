import TodayDashboard from '@/components/TodayDashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Today | Daymo', description: '오늘 근무, 일정, 할 일과 빈 시간을 한 화면에서 확인합니다.' };

export default function TodayPage() {
  return <TodayDashboard />;
}
