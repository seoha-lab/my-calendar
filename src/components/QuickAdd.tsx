'use client';
import { t, interpolate } from '@/lib/i18n';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { containsKorean, parseKoreanInput, parseQuickInput, extractDateTimeHints, type ParsedHint, type ParsedKoreanInput } from '@/lib/nlp';
import { z } from 'zod';
import { useStore } from '@/store';
import { toast } from '@/lib/toast';
import { LS_AI_KEY, LS_AI_MODEL, DEFAULT_MODEL_ID } from '@/lib/ai';
import { CalendarClock, Loader2, Trash2, Wand2, ListPlus, Plus } from 'lucide-react';
import CategorySelect from './CategorySelect';
import type { EventCategory } from '@/lib/calendar/categories';
import DateTimePicker from '@/components/DateTimePicker';
import QuickAddPreview from '@/components/QuickAddPreview';
import TaskSchedulingFields, { type TaskSchedulingValue } from '@/components/TaskSchedulingFields';

const schema = z.object({ title: z.string().min(1) });

type Props = { open: boolean; onClose: () => void; initialText?: string; initialMode?: 'quick'|'notes' };

export default function QuickAdd({ open, onClose, initialText = '', initialMode = 'quick' }: Props) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<EventCategory>('other');
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState<ParsedHint[]>([]);
  const [mode, setMode] = useState<'quick'|'notes'>('quick');
  const [preview, setPreview] = useState<ParsedKoreanInput | null>(null);
  const [showPlanning,q^