'use client';
import { t } from '@/lib/i18n';

import dynamic from 'next/dynamic';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '@/store';
import { normalizeCategory } from '@/lib/calendar/categories';
import { messages } from '@/lib/i18n';
import { shiftAssignmentToCalendarEvent, toLocalDateKey } from '@/lib/shifts';
import { openShiftManager } from '@/lib/shifts/ui';
import { openQuickAdd } from '@/lib/quickAdd';

const FullCalendar = dynamic(() => import('@fullcalendar/react'), { ssr: false });
const FullCalendarAny: any = FullCalendar;

export default function CalendarView() {
  const events = useEvents();
  const search = useStore((s) => s.search).toLowerCase();
  const updateTask = useStore((s) => s.updateTask);
  const addRange = useStore((s) => s.addRange);
  const updateRange = useStore((s) => s.updateRange);
  const toggleChecked = useStore((s) => s.toggleChecked);
  const createTask = useStore((s) => s.createTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const calendars = useStore((s) => s.calendars);
  const hideDone = useStore((s) => s.hideDone);
  const shiftTypes = useStore((s) => s.shiftTypes);
  const shiftAssignments = useStore((s) => s.shiftAssignments);
  const calendarRef = useRef<a���q�^