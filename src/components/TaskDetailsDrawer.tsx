'use client';
import { t, interpolate, relativeTime } from '@/lib/i18n';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/store';
import { toast } from '@/lib/toast';
import { Task, SubTask, Stage } from '@/types';
import { format } from '@/lib/i18n/date';
import { isSameDay, isSameYear, isToday, isTomorrow, isYesterday, isWithinInterval, differenceInMinutes } from 'date-fns';
import { Trash2, Copy, X, Plus, Zap, Loader2 } from 'lucide-react';
import CategorySelect from './CategorySelect';
import DateTimePicker from '@/components/DateTimePicker';
import { SUBTASKS_SYSTEM_PROMPT } from '@/lib/prompts';
import { LS_AI_KEY, LS_AI_MODEL, DEFAULT_MODEL_ID } from '@/lib/ai';
import { findConflicts, getCombinedBusyIntervals } from '@/lib/scheduling';
import TaskSchedulingFields from '@/components/TaskSchedulingFields';

type Props = { open: boolean; taskId?: string | null; highlightRangeId?: string; onClose: () => void };

// Colors removed

export default function TaskDetailsDrawer({ open, taskId, highlightRangeId, onClose }: Props) {
  const task = useStore((s) => (taskId ? s.tasks[taskId] : undefined));
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const deleteRange = useStore((s) => s.deleteRange);
  const createTask = useStore((s) => s.createTask);

  const [local, setLocal] = useState<Task | undefined>(task);
  const [deleteTargetRangeId, setDeleteTargetRangeId] = useState<string | null>(null);
  const [saving, setSaving] = useState<'idle'|'saving'|'saved'>('idle');
  const lastSaved = useRef<string>('');
  // Only reset local state when switching tasks; avoid overriding while typing
  useEffect(() => setLocal(task), [taskId]);

  // initialize lastSaved signature when opening or task changes
  useEffect(() => {
    if (task) {
      lastSaved.current = JSON.stringify(sanitize(task));
    }
  }, [taskId]);

  const linked = u...[truncated]