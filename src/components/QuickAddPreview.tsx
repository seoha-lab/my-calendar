'use client';

import { AlertTriangle, ArrowLeft, CalendarCheck2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { buildWeeklyOccurrenceDates, localDateTimeToISO, isEndOnNextDay, weeklyRecurrenceLabel, type ParsedEvent, type ParsedKoreanInput, type ParsedShift } from '@/lib/nlp';
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

export default function QuickAddPreview({ value, onChange, onBack, onSaved }: Props) {
  const createTask = useStore((state) => state.createTask);
  const addRanges = useStore((state) => state.addRanges);
  const setShiftAssignment = useStore((state) => state.setShiftAssignment);
  const shiftTypes = useStore((state) => state.shiftTypes);
  const tasks = useStore((state) => state.tasks);
  const shiftAssignments = useStore((state) => state.shiftAssignments);
  const [confirmedAmbiguities, setConfirmedAmbiguities] = useState(false);
  const [confirmedConflicts, setConfirmedConflicts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shiftType = useMemo(() => valq^