'use client';

import { AlertTriangle, ArrowLeft, CalendarCheck2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  buildWeeklyOccurrenceDates,
  isEndOnNextDay,
  localDateTimeToISO,
  weeklyRecurrenceLabel,
  type ParsedEvent,
  type ParsedKoreanInput,
  type ParsedShift,
} from '@/lib/nlp';
import { useStore } from '@/store';
import { toast } from '@/lib/toast';
import CategorySelect from './CategorySelect';
import { findConflicts, getCombinedBusyIntervals } from '@/lib/scheduling';
import { getShiftInterval } from '@/lib/shifts';
import type { BusyInterval } from '@/types';

type Props = {
  value: ParsedKoreanInput;
  onChange: (value: ParsedKoreanInput) => void;
  onBack: () => void;
  onSaved: () => void;
};

function allDayRange(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString(), allDay: true };
}

export default function QuickAddPreview({ value, onChange, onBack, onSaved }: Props) {
  const createTask = useStore((s) => s.createTask);
  const addRanges = useStore((s) => s.addRanges);
  const setShiftAssignment = useStore((s) => s.setShiftAssignment);
  const shiftTypes = useStore((s) => s.shiftTypes);
  const tasks = useStore((s) => s.tasks);
  const shiftAssignments = useStore((s) => s.shiftAssignments);

  const [confirmedAmbi���q�^