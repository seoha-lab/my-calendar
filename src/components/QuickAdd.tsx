'use client';
import { t, interpolate } from '@/lib/i18n';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { containsKorean, parseKoreanInput, parseQuickInput, extractDateTimeHints, type ParsedHint, type ParsedKoreanInput } from '@/lib/nlp';
import { z } from 'zod';
import { useStore } from '@/store';
import { toast } from '@/lib/toast';
import { LS_AI_KEY, LS_AI_MODEL, DEFAULT_MODEL_ID } from '@/lib/ai';
import { Loader2, Trash2, Wand2, ListPlus, Plus } from 'lucide-react';
import CategorySelect from './CategorySelect';
import type { EventCategory } from '@/lib/calendar/categories';
import DateTimePicker from '@/components/DateTimePicker';
import QuickAddPreview from '@/components/QuickAddPreview';
import TaskSchedulingFields, { type TaskSchedulingValue } from '@/components/TaskSchedulingFields';

const schema = z.object({ title: z.string().min(1) });

type Props = { open: boolean; onClose: () => void; initialText?: string; initialMode?: 'quick'|'notes'; initialSheet?: 'event'|'task'; initialDate?: string; initialDirect?: boolean };

export default function QuickAdd({ open, onClose, initialText = '', initialMode = 'quick', initialSheet = 'event', initialDate, initialDirect = false }: Props) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<EventCategory>('other');
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState<ParsedHint[]>([]);
  const [mode, setMode] = useState<'quick'|'notes'>('quick');
  const [preview, setPreview] = useState<ParsedKoreanInput | null>(null);
  const [showPlanning, setShowPlanning] = useState(false);
  const [planning, setPlanning] = useState<TaskSchedulingValue>({ priority: 'medium' });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const createTask = useStore((s) => s.createTask);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrl...[truncated]