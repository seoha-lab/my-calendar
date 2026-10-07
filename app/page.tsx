'use client';

import { useEffect, useState } from 'react';
import CalendarView from '@/components/CalendarView';
import TaskBoard from '@/components/TaskBoard';
import { useStore } from '@/store';
import Footer from '@/components/Footer';
import FreeTimePanel from '@/components/FreeTimePanel';
import { toLocalDateKey } from '@/lib/shifts';

export default function Page() {
  const init = useStore((state) => state.init);
  const createFollowUp = useStore((state) => state.createFollowUp);
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()));

  useEffect(() => { void init(); }, [init]);

  useEffect(() => {
    const onFollow = (event: Event) => {
      const id = (event as CustomEvent<{ id: string }>).detail.id;
      void createFollowUp(id);
    };
    const selectDate = (event: Event) => setSelectedDate((event as CustomEvent<{ date: string }>).detail.date);
    window.addEventListener('create-followup', onFollow);
    window.addEventListener('calendar-date-selected', selectDate as EventListener);
    return () => {
      window.removeEventListener('create-followup', onFollow);
      window.removeEventListener('calendar-date-selected', selectDate as EventListener);
    };
  }, [createFollowUp]);

  return (
    <div className="grid grid-cols-1 gap-5 py-2 sm:py-4">
      <section aria-label="월간 캘린더" className="h-[calc(100dvh-8rem)] min-h-[640px] sm:min-h-[700px]">
        <CalendarView />
      </section>

      <FreeTimePanel date={selectedDate} />

      <details className="card overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">할 일 보드 보기</summary>
        <div className="min-h-[420px] border-t border-gray-100 p-2 dark:border-slate-800">
          <TaskBoard />
        </div>
      </details>

      <Footer />
    </div>
  );
}
