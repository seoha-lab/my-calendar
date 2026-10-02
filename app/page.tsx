'use client';
import { t } from '@/lib/i18n';

import { useEffect, useRef, useState } from 'react';
import CalendarView from '@/components/CalendarView';
import TaskBoard from '@/components/TaskBoard';
import { useStore } from '@/store';
import Footer from '@/components/Footer';
import FreeTimePanel from '@/components/FreeTimePanel';
import { toLocalDateKey } from '@/lib/shifts';

export default function Page() {
  const init = useStore((s) => s.init);
  const createFollowUp = useStore((s) => s.createFollowUp);
  const [split, setSplit] = useState(70); // percent for calendar height (larger calendar)
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()));
  const dragging = useRef(false);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if ((e.target as HTMLElement).id === 'splitter') dragging.current = true; };
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const container = document.getElementById('center-pane');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const pct = Math.min(80, Math.max(20, (y / rect.height) * 100));
      setSplit(pct);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousedown', onDown);
    const onFollow = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail.id;
      createFollowUp(id);
    };
    window.addEventListener('create-followup', onFollow);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('create-followup', onFollow);
    };
  }, [createFollowUp]);

  useEffect(() => {
    const selectDate = (event: Event) => setSelectedDate((event as CustomEvent<{ date: string }>).detail.date);
    window.addEventListener('calendar-date-selected', selectDate as EventListener);
    return () => window.removeEventListener('calendar-date-selected', selectDate as EventListener);
  }, []);

  // Persist split value
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clarity:split');
      if (saved) setSplit(Number(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('clarity:split', String(split)); } catch {}
  }, [split]);

  return (
    <div className="grid grid-cols-1 gap-4 py-4">
      <div id="center-pane" className="flex flex-col gap-2 min-h-[70vh]">
        <div style={{ height: `${split}%` }} className="h-full">
          <CalendarView />
        </div>
        <div id="splitter" className="splitter-handle" aria-label={t("Resize")} />
        <div style={{ height: `${100 - split}%` }} className="h-full">
          <TaskBoard />
        </div>
      </div>
      <FreeTimePanel date={selectedDate} />
      <div>
        <Footer />
      </div>
    </div>
  );
}
