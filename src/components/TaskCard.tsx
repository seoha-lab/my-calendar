'use client';
import { t } from '@/lib/i18n';

import CategoryBadge from './CategoryBadge';
import { Link as LinkIcon } from 'lucide-react';
import { Task, Stage } from '@/types';
import { timeBadge } from '@/lib/format';
import { useEffect, useRef } from 'react';

type Props = {
  task: Task;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  showFullDate?: boolean;
};

export default function TaskCard({ task, onToggle, onOpen, showFullDate = false }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement !== el) return;
      if (e.key.toLowerCase() === ' ') {
        e.preventDefault();
        onToggle(task.id);
      } else if (e.key.toLowerCase() === 'l') {
        const event = new CustomEvent('create-followup', { detail: { id: task.id } });
        window.dispatchEvent(event);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [task.id, onToggle]);

  const badge = timeBadge(task, { fullDate: showFullDate });
  const checkedClass = task.checked || task.stage === 'done' ? 'line-through text-gray-400' : '';

  const hueClass = cardHueClassesByStage(task.stage);
  return (
    <div
      ref={ref}
      tabIndex={0}
      className={`rounded-2xl border p-3 focus:ring-2 focus:ring-blue-500 outline-none fc-draggable-task cursor-gra���q�^